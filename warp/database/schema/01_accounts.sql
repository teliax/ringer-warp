-- Customer Account Management Schema
-- This schema handles all customer account data

-- Main accounts table
CREATE TABLE accounts.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ban VARCHAR(50) UNIQUE NOT NULL, -- Billing Account Number
    company_name VARCHAR(255) NOT NULL,
    dba_name VARCHAR(255),
    
    -- Contact Information
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255) NOT NULL,
    primary_contact_phone VARCHAR(50),
    
    -- Address Information
    billing_address_line1 VARCHAR(255),
    billing_address_line2 VARCHAR(255),
    billing_address_city VARCHAR(100),
    billing_address_state VARCHAR(50),
    billing_address_postal VARCHAR(20),
    billing_address_country VARCHAR(2) DEFAULT 'US',
    
    service_address_line1 VARCHAR(255),
    service_address_line2 VARCHAR(255),
    service_address_city VARCHAR(100),
    service_address_state VARCHAR(50),
    service_address_postal VARCHAR(20),
    service_address_country VARCHAR(2) DEFAULT 'US',
    
    -- Account Configuration
    status account_status DEFAULT 'PENDING',
    billing_cycle billing_cycle DEFAULT 'POSTPAID',
    payment_terms VARCHAR(20) DEFAULT 'NET30', -- NET15, NET30, NET60, DUE_ON_RECEIPT
    credit_limit DECIMAL(12,2) DEFAULT 1000.00,
    currency_code VARCHAR(3) DEFAULT 'USD',
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    
    -- Integration IDs
    hubspot_id VARCHAR(100) UNIQUE,
    netsuite_customer_id VARCHAR(100) UNIQUE,
    stripe_customer_id VARCHAR(100) UNIQUE,
    
    -- Billing Configuration
    tax_exempt BOOLEAN DEFAULT FALSE,
    tax_id VARCHAR(50),
    reseller_certificate VARCHAR(100),
    
    -- Features and Limits
    max_concurrent_calls INTEGER DEFAULT 100,
    max_tps INTEGER DEFAULT 10, -- Transactions per second
    allowed_countries TEXT[], -- Array of ISO country codes
    blocked_countries TEXT[], -- Array of ISO country codes
    
    -- Metadata
    tags TEXT[],
    custom_attributes JSONB DEFAULT '{}',
    notes TEXT,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    activated_at TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    terminated_at TIMESTAMPTZ
);

-- Account contacts (multiple contacts per account)
CREATE TABLE accounts.contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    contact_type VARCHAR(50) NOT NULL, -- BILLING, TECHNICAL, ABUSE, NOC, SALES
    
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    title VARCHAR(100),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    mobile VARCHAR(50),
    
    -- Notification preferences
    receive_billing_emails BOOLEAN DEFAULT TRUE,
    receive_technical_alerts BOOLEAN DEFAULT TRUE,
    receive_marketing BOOLEAN DEFAULT FALSE,
    
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Account hierarchy for resellers/sub-accounts
CREATE TABLE accounts.account_hierarchy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_account_id UUID NOT NULL REFERENCES accounts.accounts(id),
    child_account_id UUID NOT NULL REFERENCES accounts.accounts(id),
    
    -- Revenue sharing
    revenue_share_percentage DECIMAL(5,2) DEFAULT 0.00,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(parent_account_id, child_account_id)
);

-- Account documents (contracts, agreements, etc.)
CREATE TABLE accounts.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- CONTRACT, NDA, AGREEMENT, INVOICE, STATEMENT
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    file_path VARCHAR(500), -- GCS path
    file_size BIGINT,
    mime_type VARCHAR(100),
    
    -- Document metadata
    effective_date DATE,
    expiration_date DATE,
    signed_date DATE,
    signed_by VARCHAR(255),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

-- Account feature flags
CREATE TABLE accounts.feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    feature_name VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    configuration JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, feature_name)
);

-- Indexes
CREATE INDEX idx_accounts_ban ON accounts.accounts(ban);
CREATE INDEX idx_accounts_status ON accounts.accounts(status);
CREATE INDEX idx_accounts_company_name ON accounts.accounts(company_name);
CREATE INDEX idx_accounts_hubspot_id ON accounts.accounts(hubspot_id);
CREATE INDEX idx_accounts_created_at ON accounts.accounts(created_at);
CREATE INDEX idx_contacts_account_id ON accounts.contacts(account_id);
CREATE INDEX idx_contacts_email ON accounts.contacts(email);
CREATE INDEX idx_feature_flags_account_feature ON accounts.feature_flags(account_id, feature_name);

-- Triggers
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts.accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON accounts.contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Helper function for updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;