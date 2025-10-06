# WARP Database Schema Documentation

## Overview

The WARP platform uses CockroachDB as its primary distributed SQL database, with Redis for caching and session management. This document outlines the core database schemas and their relationships.

## Database Architecture

### Primary Database: CockroachDB
- **Purpose**: Persistent storage for all business entities
- **Features**: Distributed SQL, ACID compliance, horizontal scaling
- **Replication**: 3x replication across zones

### Cache Layer: Redis
- **Purpose**: Session state, routing cache, rate limiting
- **Features**: In-memory storage, pub/sub, TTL support

## Core Schemas

### 1. Organizations Schema

```sql
-- Organizations represent carrier accounts
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    fcc_filer_id VARCHAR(50) UNIQUE,
    parent_org_id UUID REFERENCES organizations(id),
    status VARCHAR(50) DEFAULT 'active',
    tier VARCHAR(50) DEFAULT 'standard',
    billing_account_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Organization settings
CREATE TABLE organization_settings (
    org_id UUID PRIMARY KEY REFERENCES organizations(id),
    max_trunks INT DEFAULT 10,
    max_numbers INT DEFAULT 1000,
    max_concurrent_calls INT DEFAULT 10000,
    allowed_regions JSONB DEFAULT '["US"]',
    features JSONB DEFAULT '{}',
    rate_limits JSONB DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Users & Authentication Schema

```sql
-- Users within organizations
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    status VARCHAR(50) DEFAULT 'active',
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    last_login TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- API keys for programmatic access
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID REFERENCES users(id),
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    permissions JSONB DEFAULT '[]',
    rate_limit INT DEFAULT 1000,
    last_used TIMESTAMP,
    expires_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audit log for security
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    user_id UUID REFERENCES users(id),
    api_key_id UUID REFERENCES api_keys(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. SIP Trunks Schema

```sql
-- SIP trunk configurations
CREATE TABLE sip_trunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    auth_type VARCHAR(50) DEFAULT 'digest',
    status VARCHAR(50) DEFAULT 'active',

    -- Capacity limits
    max_channels INT DEFAULT 100,
    channels_in_use INT DEFAULT 0,

    -- Network configuration
    allowed_ips JSONB DEFAULT '[]',
    transport VARCHAR(20) DEFAULT 'UDP',
    nat_enabled BOOLEAN DEFAULT FALSE,

    -- Features
    codecs JSONB DEFAULT '["PCMU", "PCMA", "G722"]',
    dtmf_mode VARCHAR(20) DEFAULT 'RFC2833',
    fax_enabled BOOLEAN DEFAULT FALSE,
    srtp_mode VARCHAR(20) DEFAULT 'optional',

    -- Routing
    inbound_context VARCHAR(100) DEFAULT 'from-trunk',
    outbound_proxy VARCHAR(255),
    failover_trunk_id UUID REFERENCES sip_trunks(id),

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(org_id, name)
);

-- Trunk registration status (updated by Kamailio)
CREATE TABLE trunk_registrations (
    trunk_id UUID PRIMARY KEY REFERENCES sip_trunks(id),
    contact VARCHAR(255),
    received VARCHAR(255),
    user_agent VARCHAR(255),
    expires_at TIMESTAMP,
    last_seen TIMESTAMP DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'offline'
);

-- IP ACL for trunks
CREATE TABLE trunk_acl (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trunk_id UUID NOT NULL REFERENCES sip_trunks(id),
    ip_address INET NOT NULL,
    subnet_mask INT DEFAULT 32,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(trunk_id, ip_address)
);
```

### 4. Phone Numbers (DIDs) Schema

```sql
-- Phone number inventory
CREATE TABLE phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number VARCHAR(20) UNIQUE NOT NULL,
    country_code VARCHAR(5) NOT NULL,
    number_type VARCHAR(20) DEFAULT 'local',

    -- Assignment
    org_id UUID REFERENCES organizations(id),
    trunk_id UUID REFERENCES sip_trunks(id),

    -- Capabilities
    voice_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    mms_enabled BOOLEAN DEFAULT FALSE,
    fax_enabled BOOLEAN DEFAULT FALSE,

    -- Status
    status VARCHAR(50) DEFAULT 'available',
    ported_in BOOLEAN DEFAULT FALSE,
    port_in_date DATE,

    -- Location
    rate_center VARCHAR(100),
    state VARCHAR(2),
    lata VARCHAR(10),

    -- Features
    cnam_enabled BOOLEAN DEFAULT FALSE,
    cnam_display VARCHAR(100),

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- E911 addresses
CREATE TABLE e911_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number_id UUID UNIQUE REFERENCES phone_numbers(id),

    -- Address fields
    customer_name VARCHAR(255) NOT NULL,
    street_number VARCHAR(20) NOT NULL,
    street_name VARCHAR(255) NOT NULL,
    street_suffix VARCHAR(20),
    unit_type VARCHAR(20),
    unit_number VARCHAR(20),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    zip VARCHAR(10) NOT NULL,
    plus_four VARCHAR(4),

    -- Validation
    validated BOOLEAN DEFAULT FALSE,
    validation_date TIMESTAMP,
    msag_valid BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 5. Routing Rules Schema

```sql
-- Dynamic routing rules
CREATE TABLE routing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    trunk_id UUID REFERENCES sip_trunks(id),

    name VARCHAR(255) NOT NULL,
    priority INT DEFAULT 100,
    enabled BOOLEAN DEFAULT TRUE,

    -- Match conditions
    match_type VARCHAR(50) DEFAULT 'prefix',
    match_pattern VARCHAR(255) NOT NULL,
    time_condition JSONB DEFAULT '{}',

    -- Actions
    action VARCHAR(50) NOT NULL,
    destination VARCHAR(255),
    transform_rules JSONB DEFAULT '{}',

    -- Advanced
    weight INT DEFAULT 100,
    max_calls INT,

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- LCR (Least Cost Routing) rates
CREATE TABLE lcr_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carrier_id UUID REFERENCES organizations(id),
    prefix VARCHAR(20) NOT NULL,
    description VARCHAR(255),
    rate DECIMAL(10, 6) NOT NULL,
    effective_date DATE NOT NULL,
    expiry_date DATE,
    priority INT DEFAULT 100,

    UNIQUE(carrier_id, prefix, effective_date)
);
```

### 6. Call Detail Records (CDRs) Schema

```sql
-- Call detail records
CREATE TABLE cdrs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id VARCHAR(255) UNIQUE NOT NULL,

    -- Parties
    org_id UUID NOT NULL REFERENCES organizations(id),
    trunk_id UUID REFERENCES sip_trunks(id),
    from_number VARCHAR(50),
    to_number VARCHAR(50),

    -- Timing
    start_time TIMESTAMP NOT NULL,
    answer_time TIMESTAMP,
    end_time TIMESTAMP,
    duration INT DEFAULT 0,
    billable_duration INT DEFAULT 0,

    -- Routing
    inbound BOOLEAN DEFAULT FALSE,
    source_ip INET,
    destination_ip INET,

    -- Result
    sip_response_code INT,
    termination_cause VARCHAR(100),

    -- Quality metrics
    mos_score DECIMAL(3, 2),
    packet_loss DECIMAL(5, 2),
    jitter_avg INT,
    rtt_avg INT,

    -- Billing
    rate DECIMAL(10, 6),
    cost DECIMAL(10, 4),
    billed BOOLEAN DEFAULT FALSE,

    -- Media
    codecs_used JSONB DEFAULT '[]',
    recording_url VARCHAR(500),

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
) PARTITION BY RANGE (start_time);

-- Create monthly partitions for CDRs
CREATE TABLE cdrs_2025_01 PARTITION OF cdrs
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE cdrs_2025_02 PARTITION OF cdrs
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- Continue for all months...

-- Indexes for CDR queries
CREATE INDEX idx_cdrs_org_id ON cdrs(org_id);
CREATE INDEX idx_cdrs_trunk_id ON cdrs(trunk_id);
CREATE INDEX idx_cdrs_start_time ON cdrs(start_time);
CREATE INDEX idx_cdrs_from_to ON cdrs(from_number, to_number);
```

### 7. Billing Schema

```sql
-- Billing accounts
CREATE TABLE billing_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID UNIQUE NOT NULL REFERENCES organizations(id),

    -- Payment method
    payment_method VARCHAR(50) DEFAULT 'invoice',
    stripe_customer_id VARCHAR(255),

    -- Billing details
    billing_email VARCHAR(255),
    billing_address JSONB,
    tax_id VARCHAR(50),

    -- Credit
    credit_limit DECIMAL(10, 2) DEFAULT 0,
    current_balance DECIMAL(10, 2) DEFAULT 0,
    auto_recharge BOOLEAN DEFAULT FALSE,
    auto_recharge_amount DECIMAL(10, 2),
    auto_recharge_threshold DECIMAL(10, 2),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Usage tracking
CREATE TABLE usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),

    usage_type VARCHAR(50) NOT NULL,
    quantity DECIMAL(15, 4) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    rate DECIMAL(10, 6),
    amount DECIMAL(10, 4),

    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
) PARTITION BY RANGE (period_start);

-- Invoices
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,

    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    subtotal DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,

    status VARCHAR(50) DEFAULT 'draft',
    due_date DATE,
    paid_date DATE,

    line_items JSONB DEFAULT '[]',

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 8. Messaging (SMS/MMS) Schema

```sql
-- Message records
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id VARCHAR(255) UNIQUE NOT NULL,

    -- Parties
    org_id UUID NOT NULL REFERENCES organizations(id),
    from_number VARCHAR(50) NOT NULL,
    to_number VARCHAR(50) NOT NULL,

    -- Content
    message_type VARCHAR(20) DEFAULT 'sms',
    body TEXT,
    media_urls JSONB DEFAULT '[]',
    num_segments INT DEFAULT 1,

    -- Status
    direction VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'queued',
    error_code VARCHAR(20),
    error_message TEXT,

    -- Delivery
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,

    -- Billing
    rate DECIMAL(10, 6),
    cost DECIMAL(10, 4),

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Messaging campaigns
CREATE TABLE messaging_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,

    from_number VARCHAR(50) NOT NULL,
    recipient_list JSONB NOT NULL,

    message_template TEXT NOT NULL,
    media_urls JSONB DEFAULT '[]',

    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    total_recipients INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    delivered_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,

    status VARCHAR(50) DEFAULT 'draft',

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## Redis Cache Schemas

### Session Store
```redis
# User sessions
session:{session_id} -> {
    user_id: UUID,
    org_id: UUID,
    ip: "x.x.x.x",
    expires: timestamp
}

# API key cache
api_key:{key_hash} -> {
    org_id: UUID,
    permissions: [],
    rate_limit: 1000
}
```

### SIP Registration Cache
```redis
# Active registrations
registration:{trunk_id} -> {
    contact: "sip:user@host:port",
    expires: timestamp,
    user_agent: "string"
}

# Online trunk list
trunks:online -> SET of trunk_ids
```

### Routing Cache
```redis
# LCR routes
route:lcr:{prefix} -> [
    {carrier_id: UUID, rate: 0.01, priority: 1},
    {carrier_id: UUID, rate: 0.02, priority: 2}
]

# Custom routing rules
route:custom:{org_id}:{pattern} -> {
    action: "forward",
    destination: "sip:host",
    transform: {}
}
```

### Rate Limiting
```redis
# API rate limiting
rate:api:{api_key}:{window} -> counter
rate:api:{api_key}:quota -> 1000

# Call rate limiting
rate:calls:{trunk_id}:{window} -> counter
rate:calls:{trunk_id}:max -> 100
```

## Database Indexes

```sql
-- Performance-critical indexes
CREATE INDEX idx_trunks_org_status ON sip_trunks(org_id, status);
CREATE INDEX idx_numbers_org_status ON phone_numbers(org_id, status);
CREATE INDEX idx_routing_org_enabled ON routing_rules(org_id, enabled);
CREATE INDEX idx_cdrs_org_time ON cdrs(org_id, start_time DESC);
CREATE INDEX idx_messages_org_time ON messages(org_id, created_at DESC);
CREATE INDEX idx_audit_org_time ON audit_logs(org_id, created_at DESC);
```

## Migration Strategy

1. **Schema Versioning**: Use Flyway or similar for version control
2. **Zero-Downtime Migrations**: Use CockroachDB's online schema changes
3. **Rollback Plan**: Maintain compatibility with n-1 version
4. **Data Validation**: Run validation scripts post-migration

## Backup & Recovery

1. **CockroachDB Backups**:
   - Full backup: Daily at 02:00 UTC
   - Incremental: Every 4 hours
   - Retention: 30 days
   - Location: Google Cloud Storage

2. **Redis Persistence**:
   - AOF enabled with fsync every second
   - RDB snapshots every hour
   - Replication to standby instances

## Security Considerations

1. **Encryption**:
   - Data at rest: AES-256
   - Data in transit: TLS 1.3
   - Column-level encryption for sensitive data

2. **Access Control**:
   - Row-level security for multi-tenancy
   - Separate read/write connection pools
   - Audit logging for all modifications

3. **Compliance**:
   - GDPR-compliant data retention
   - PCI DSS for payment data
   - HIPAA considerations for call recordings