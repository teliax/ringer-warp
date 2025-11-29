-- Trunk IP ACL Schema for WARP Platform
-- Date: 2025-11-10
-- Purpose: Enable IP-based customer authentication for SIP trunks
-- Related: Customer/Vendor ingress/egress architecture

-- =============================================================================
-- TRUNK GROUPS TABLE
-- =============================================================================
-- Represents a customer's SIP trunk configuration
-- Each trunk belongs to a customer and contains IP ACL entries

CREATE TABLE IF NOT EXISTS accounts.trunk_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES accounts.customers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Authentication method
    auth_type VARCHAR(20) NOT NULL DEFAULT 'IP_ACL'
        CHECK (auth_type IN ('IP_ACL', 'DIGEST', 'BOTH')),

    -- Capacity limits (enforced by Kamailio ratelimit module)
    capacity_cps INTEGER DEFAULT 10 CHECK (capacity_cps > 0),
    capacity_concurrent_calls INTEGER DEFAULT 100 CHECK (capacity_concurrent_calls > 0),

    -- Status
    enabled BOOLEAN DEFAULT true,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    -- Constraints
    UNIQUE(customer_id, name)
);

-- Index for customer lookups
CREATE INDEX idx_trunk_groups_customer ON accounts.trunk_groups(customer_id) WHERE enabled = true;
CREATE INDEX idx_trunk_groups_auth_type ON accounts.trunk_groups(auth_type);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_trunk_groups_timestamp
    BEFORE UPDATE ON accounts.trunk_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE accounts.trunk_groups IS 'Customer SIP trunk configurations with authentication and capacity settings';
COMMENT ON COLUMN accounts.trunk_groups.auth_type IS 'Authentication method: IP_ACL (source IP), DIGEST (username/password), or BOTH';
COMMENT ON COLUMN accounts.trunk_groups.capacity_cps IS 'Maximum calls per second for this trunk';
COMMENT ON COLUMN accounts.trunk_groups.capacity_concurrent_calls IS 'Maximum concurrent calls for this trunk';

-- =============================================================================
-- TRUNK IPs TABLE
-- =============================================================================
-- IP ACL entries for trunk groups
-- Each entry represents an allowed source IP or IP range

CREATE TABLE IF NOT EXISTS accounts.trunk_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trunk_group_id UUID NOT NULL REFERENCES accounts.trunk_groups(id) ON DELETE CASCADE,

    -- IP address configuration
    ip_address INET NOT NULL,
    netmask INTEGER DEFAULT 32 CHECK (netmask >= 0 AND netmask <= 32),

    -- Metadata
    description VARCHAR(255),
    enabled BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    -- Constraints: No duplicate IPs within same trunk group
    UNIQUE(trunk_group_id, ip_address, netmask)
);

-- Indexes for fast IP lookups
CREATE INDEX idx_trunk_ips_trunk_group ON accounts.trunk_ips(trunk_group_id) WHERE enabled = true;
CREATE INDEX idx_trunk_ips_ip ON accounts.trunk_ips(ip_address) WHERE enabled = true;
CREATE INDEX idx_trunk_ips_enabled ON accounts.trunk_ips(enabled);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_trunk_ips_timestamp
    BEFORE UPDATE ON accounts.trunk_ips
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE accounts.trunk_ips IS 'IP ACL whitelist entries for customer SIP trunks';
COMMENT ON COLUMN accounts.trunk_ips.ip_address IS 'Source IP address to allow (INET type supports both IPv4 and IPv6)';
COMMENT ON COLUMN accounts.trunk_ips.netmask IS 'CIDR netmask (32 for single IP, 24 for /24 block, etc.)';

-- =============================================================================
-- PREMIUM CUSTOMER DEDICATED IPs TABLE
-- =============================================================================
-- Tracks dedicated LoadBalancer IPs assigned to premium/enterprise customers

CREATE TABLE IF NOT EXISTS accounts.customer_dedicated_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES accounts.customers(id) ON DELETE CASCADE,

    -- IP configuration
    ip_address INET UNIQUE NOT NULL,
    region VARCHAR(50) NOT NULL,

    -- GCP resource identifiers
    gcp_address_name VARCHAR(100),
    gcp_loadbalancer_name VARCHAR(100),

    -- Status
    status VARCHAR(20) DEFAULT 'PROVISIONING'
        CHECK (status IN ('PROVISIONING', 'ACTIVE', 'DEPROVISIONING', 'DELETED')),
    enabled BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deprovisioned_at TIMESTAMPTZ,

    -- Constraints
    UNIQUE(customer_id, region)  -- One dedicated IP per customer per region
);

CREATE INDEX idx_customer_dedicated_ips_customer ON accounts.customer_dedicated_ips(customer_id) WHERE enabled = true;
CREATE INDEX idx_customer_dedicated_ips_status ON accounts.customer_dedicated_ips(status);

COMMENT ON TABLE accounts.customer_dedicated_ips IS 'Dedicated LoadBalancer IPs for premium/enterprise customers';
COMMENT ON COLUMN accounts.customer_dedicated_ips.ip_address IS 'Dedicated external IP address (destination IP identifies customer)';

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get customer BAN from source IP (for Kamailio permissions module)
CREATE OR REPLACE FUNCTION accounts.get_customer_by_source_ip(source_ip INET)
RETURNS VARCHAR AS $$
DECLARE
    customer_ban VARCHAR(20);
BEGIN
    -- Check if source IP matches any trunk IP ACL
    SELECT c.ban INTO customer_ban
    FROM accounts.trunk_ips ti
    JOIN accounts.trunk_groups tg ON ti.trunk_group_id = tg.id
    JOIN accounts.customers c ON tg.customer_id = c.id
    WHERE ti.enabled = true
      AND tg.enabled = true
      AND c.status = 'active'
      AND (ti.netmask = 32 AND ti.ip_address = source_ip)
         OR (ti.netmask < 32 AND source_ip << set_masklen(ti.ip_address, ti.netmask))
    LIMIT 1;

    RETURN customer_ban;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION accounts.get_customer_by_source_ip IS 'Lookup customer BAN by source IP address (supports CIDR ranges)';

-- Function to get customer BAN from destination IP (for premium customers)
CREATE OR REPLACE FUNCTION accounts.get_customer_by_dest_ip(dest_ip INET)
RETURNS VARCHAR AS $$
DECLARE
    customer_ban VARCHAR(20);
BEGIN
    -- Check if destination IP is a dedicated customer IP
    SELECT c.ban INTO customer_ban
    FROM accounts.customer_dedicated_ips cdi
    JOIN accounts.customers c ON cdi.customer_id = c.id
    WHERE cdi.enabled = true
      AND cdi.status = 'ACTIVE'
      AND cdi.ip_address = dest_ip
      AND c.status = 'active';

    RETURN customer_ban;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION accounts.get_customer_by_dest_ip IS 'Lookup customer BAN by destination IP address (premium tier)';

-- =============================================================================
-- REDIS SYNC FUNCTIONS (for Kamailio permissions module)
-- =============================================================================

-- Function to sync trunk IPs to Redis for Kamailio permissions module
-- Redis key format: address:entry:{id}
-- Hash fields: {grp: 100, ip_addr: "1.2.3.4", mask: 32, port: 5060, proto: "any", tag: "AC-12345"}

CREATE OR REPLACE FUNCTION accounts.sync_trunk_ip_to_redis()
RETURNS TRIGGER AS $$
DECLARE
    redis_key TEXT;
    customer_ban VARCHAR(20);
BEGIN
    -- Get customer BAN for this trunk
    SELECT c.ban INTO customer_ban
    FROM accounts.trunk_groups tg
    JOIN accounts.customers c ON tg.customer_id = c.id
    WHERE tg.id = NEW.trunk_group_id;

    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.enabled THEN
            -- Sync to Redis (would need Redis extension or use application layer)
            -- This is a placeholder for application-level sync
            RAISE NOTICE 'REDIS_SYNC: ADD address:entry:% -> {grp:100, ip_addr:%, mask:%, tag:%}',
                NEW.id, host(NEW.ip_address), NEW.netmask, customer_ban;
        ELSE
            -- Remove from Redis
            RAISE NOTICE 'REDIS_SYNC: DEL address:entry:%', NEW.id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        -- Remove from Redis
        RAISE NOTICE 'REDIS_SYNC: DEL address:entry:%', OLD.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trunk_ip_redis_sync
    AFTER INSERT OR UPDATE OR DELETE ON accounts.trunk_ips
    FOR EACH ROW
    EXECUTE FUNCTION accounts.sync_trunk_ip_to_redis();

COMMENT ON FUNCTION accounts.sync_trunk_ip_to_redis IS 'Trigger to sync trunk IP changes to Redis for Kamailio permissions module (application layer handles actual Redis sync)';

-- =============================================================================
-- SAMPLE DATA (for testing)
-- =============================================================================

-- Uncomment to insert test data:
-- INSERT INTO accounts.trunk_groups (customer_id, name, auth_type, capacity_cps, capacity_concurrent_calls)
-- SELECT id, 'Primary Trunk', 'IP_ACL', 100, 1000
-- FROM accounts.customers
-- WHERE ban = 'TEST-001';

-- INSERT INTO accounts.trunk_ips (trunk_group_id, ip_address, netmask, description)
-- SELECT id, '203.0.113.5'::INET, 32, 'Office IP'
-- FROM accounts.trunk_groups
-- WHERE name = 'Primary Trunk' AND customer_id IN (SELECT id FROM accounts.customers WHERE ban = 'TEST-001');

-- =============================================================================
-- GRANTS
-- =============================================================================

-- Grant access to application user
GRANT SELECT, INSERT, UPDATE, DELETE ON accounts.trunk_groups TO warp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON accounts.trunk_ips TO warp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON accounts.customer_dedicated_ips TO warp_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA accounts TO warp_app;

-- Grant read-only access to reporting user (if exists)
-- GRANT SELECT ON accounts.trunk_groups TO warp_reporting;
-- GRANT SELECT ON accounts.trunk_ips TO warp_reporting;
-- GRANT SELECT ON accounts.customer_dedicated_ips TO warp_reporting;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check trunk configuration
-- SELECT
--     c.ban,
--     c.company_name,
--     tg.name AS trunk_name,
--     tg.auth_type,
--     tg.capacity_cps,
--     COUNT(ti.id) AS ip_count
-- FROM accounts.customers c
-- JOIN accounts.trunk_groups tg ON tg.customer_id = c.id
-- LEFT JOIN accounts.trunk_ips ti ON ti.trunk_group_id = tg.id AND ti.enabled = true
-- WHERE c.status = 'active' AND tg.enabled = true
-- GROUP BY c.ban, c.company_name, tg.name, tg.auth_type, tg.capacity_cps
-- ORDER BY c.ban;

-- Check IP ACL entries
-- SELECT
--     c.ban,
--     tg.name AS trunk_name,
--     ti.ip_address,
--     ti.netmask,
--     ti.description,
--     ti.enabled
-- FROM accounts.trunk_ips ti
-- JOIN accounts.trunk_groups tg ON ti.trunk_group_id = tg.id
-- JOIN accounts.customers c ON tg.customer_id = c.id
-- ORDER BY c.ban, tg.name, ti.ip_address;

-- Test IP lookup functions
-- SELECT accounts.get_customer_by_source_ip('203.0.113.5'::INET);
-- SELECT accounts.get_customer_by_dest_ip('34.44.183.87'::INET);
