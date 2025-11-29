-- Add missing JSONB columns to match Go model

DO $$
BEGIN
    -- Add kyc_data if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'accounts'
        AND table_name = 'customers'
        AND column_name = 'kyc_data'
    ) THEN
        ALTER TABLE accounts.customers
        ADD COLUMN kyc_data JSONB DEFAULT '{}';
    END IF;

    -- Add business_info if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'accounts'
        AND table_name = 'customers'
        AND column_name = 'business_info'
    ) THEN
        ALTER TABLE accounts.customers
        ADD COLUMN business_info JSONB DEFAULT '{}';
    END IF;

    -- Add external_ids if missing (consolidates hubspot_company_id, etc.)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'accounts'
        AND table_name = 'customers'
        AND column_name = 'external_ids'
    ) THEN
        ALTER TABLE accounts.customers
        ADD COLUMN external_ids JSONB DEFAULT '{}';

        -- Migrate existing external IDs to JSONB
        UPDATE accounts.customers
        SET external_ids = jsonb_build_object(
            'hubspot_company_id', COALESCE(hubspot_company_id, ''),
            'netsuite_customer_id', COALESCE(netsuite_customer_id, ''),
            'salesforce_account_id', COALESCE(salesforce_account_id, '')
        )
        WHERE hubspot_company_id IS NOT NULL
           OR netsuite_customer_id IS NOT NULL
           OR salesforce_account_id IS NOT NULL;
    END IF;
END $$;

-- Add indexes for new JSONB columns
CREATE INDEX IF NOT EXISTS idx_customers_kyc_data ON accounts.customers USING gin (kyc_data);
CREATE INDEX IF NOT EXISTS idx_customers_business_info ON accounts.customers USING gin (business_info);
CREATE INDEX IF NOT EXISTS idx_customers_external_ids ON accounts.customers USING gin (external_ids);
