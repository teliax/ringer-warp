-- Enhanced Customer Management Schema
-- Supports KYC, Business Info, HubSpot integration with JSONB extensibility

-- Check if accounts.customers exists, if not create it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'accounts' AND tablename = 'customers') THEN
        CREATE TABLE accounts.customers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            
            -- Core identifiers
            ban VARCHAR(20) UNIQUE NOT NULL,
            company_name VARCHAR(255) NOT NULL,
            legal_name VARCHAR(255),
            
            -- Status
            status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'TRIAL', 'CLOSED')),
            customer_type VARCHAR(20) NOT NULL CHECK (customer_type IN ('PREPAID', 'POSTPAID', 'RESELLER')),
            
            -- Contact (primary contact)
            contact JSONB NOT NULL DEFAULT '{}',
            -- Example: {"name": "John Doe", "email": "john@acme.com", "phone": "+15550123"}
            
            -- Address
            address JSONB NOT NULL DEFAULT '{}',
            -- Example: {"line1": "123 Main St", "city": "NY", "state": "NY", "zip": "10001", "country": "US"}
            
            -- Financial
            credit_limit DECIMAL(12,2),
            current_balance DECIMAL(12,2) DEFAULT 0.00,
            prepaid_balance DECIMAL(12,2) DEFAULT 0.00,
            payment_terms INTEGER DEFAULT 30,
            billing_cycle VARCHAR(20) DEFAULT 'MONTHLY',
            currency VARCHAR(3) DEFAULT 'USD',
            
            -- KYC Data (extensible)
            kyc_data JSONB DEFAULT '{}',
            /*  Example:
                {
                  "carrier_type": "voip",
                  "services_offered": ["voice", "messaging"],
                  "operating_states": ["NY", "CA", "TX"],
                  "interconnection_agreements": "Available upon request",
                  "fcc_filer_id": "123456"
                }
            */
            
            -- Business Info (extensible)
            business_info JSONB DEFAULT '{}',
            /*  Example:
                {
                  "years_in_business": 5,
                  "employees": 25,
                  "annual_revenue_range": "1m-5m",
                  "credit_rating": "good",
                  "estimated_monthly_volume": 100000,
                  "emergency_contact": {
                    "name": "Jane Smith",
                    "phone": "+15559876543",
                    "email": "emergency@acme.com"
                  }
                }
            */
            
            -- External Integrations
            external_ids JSONB DEFAULT '{}',
            /*  Example:
                {
                  "hubspot_company_id": "12345",
                  "netsuite_customer_id": "CUST-001",
                  "salesforce_account_id": "0011234567"
                }
            */
            
            -- Custom Fields (fully extensible)
            custom_fields JSONB DEFAULT '{}',
            
            -- Audit
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_by VARCHAR(100),
            updated_by VARCHAR(100)
        );

        -- Indexes
        CREATE INDEX idx_customers_ban ON accounts.customers(ban);
        CREATE INDEX idx_customers_company_name ON accounts.customers(company_name);
        CREATE INDEX idx_customers_status ON accounts.customers(status);
        CREATE INDEX idx_customers_type ON accounts.customers(customer_type);
        CREATE INDEX idx_customers_created_at ON accounts.customers(created_at DESC);
        
        -- JSONB indexes for common queries
        CREATE INDEX idx_customers_kyc_carrier_type ON accounts.customers USING gin ((kyc_data->'carrier_type'));
        CREATE INDEX idx_customers_external_hubspot ON accounts.customers USING gin ((external_ids->'hubspot_company_id'));
        
        COMMENT ON TABLE accounts.customers IS 'Customer accounts with extensible JSONB fields for KYC, business info, and integrations';
    END IF;
END $$;

-- Customer notes/activities
CREATE TABLE IF NOT EXISTS accounts.customer_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES accounts.customers(id) ON DELETE CASCADE,
    
    note_type VARCHAR(50) NOT NULL, -- 'GENERAL', 'SUPPORT', 'SALES', 'BILLING', 'TECHNICAL'
    subject VARCHAR(255),
    content TEXT NOT NULL,
    
    -- HubSpot sync
    hubspot_engagement_id VARCHAR(100),
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100) NOT NULL,
    
    CONSTRAINT fk_customer_notes_customer FOREIGN KEY (customer_id) REFERENCES accounts.customers(id) ON DELETE CASCADE
);

CREATE INDEX idx_customer_notes_customer ON accounts.customer_notes(customer_id, created_at DESC);
CREATE INDEX idx_customer_notes_type ON accounts.customer_notes(note_type);

-- Sample customer data
INSERT INTO accounts.customers (ban, company_name, legal_name, status, customer_type, contact, address, credit_limit, kyc_data, business_info, external_ids)
VALUES (
    'AC-64428714',
    'Acme Communications',
    'Acme Communications LLC',
    'ACTIVE',
    'POSTPAID',
    '{"name": "John Smith", "email": "john.smith@acme.com", "phone": "+1-555-0123"}'::jsonb,
    '{"line1": "123 Business Ave", "city": "New York", "state": "NY", "zip": "10001", "country": "USA"}'::jsonb,
    5000.00,
    '{"carrier_type": "voip", "services_offered": ["voice", "messaging"], "operating_states": ["NY", "CA", "TX"], "fcc_filer_id": "827364"}'::jsonb,
    '{"years_in_business": 8, "employees": 45, "annual_revenue_range": "5m-10m", "credit_rating": "excellent", "estimated_monthly_volume": 250000}'::jsonb,
    '{"hubspot_company_id": "12345", "netsuite_customer_id": "CUST-001"}'::jsonb
) ON CONFLICT (ban) DO NOTHING;

