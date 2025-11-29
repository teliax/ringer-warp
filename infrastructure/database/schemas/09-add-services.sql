-- Add services column to customers table
-- Tracks which services (VOICE, MESSAGING, TELECOM_DATA) are enabled for each customer

DO $$
BEGIN
    -- Add services JSONB column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'accounts'
        AND table_name = 'customers'
        AND column_name = 'services'
    ) THEN
        ALTER TABLE accounts.customers
        ADD COLUMN services JSONB DEFAULT '{
          "voice": {
            "enabled": false,
            "types": []
          },
          "messaging": {
            "enabled": false,
            "types": []
          },
          "telecom_data": {
            "enabled": false,
            "types": []
          }
        }'::jsonb;

        -- Add index for common queries
        CREATE INDEX idx_customers_services_voice ON accounts.customers
            USING gin ((services->'voice'));
        CREATE INDEX idx_customers_services_messaging ON accounts.customers
            USING gin ((services->'messaging'));
        CREATE INDEX idx_customers_services_data ON accounts.customers
            USING gin ((services->'telecom_data'));

        COMMENT ON COLUMN accounts.customers.services IS 'Enabled services and their types (VOICE, MESSAGING, TELECOM_DATA)';
    END IF;
END $$;

-- Example usage:
/*
UPDATE accounts.customers
SET services = '{
  "voice": {
    "enabled": true,
    "types": ["inbound-local", "inbound-tollfree", "outbound-local", "outbound-tollfree"]
  },
  "messaging": {
    "enabled": true,
    "types": ["a2p-sms", "a2p-mms"]
  },
  "telecom_data": {
    "enabled": true,
    "types": ["cnam", "lrn", "cic"]
  }
}'::jsonb
WHERE ban = 'AC-64428714';
*/
