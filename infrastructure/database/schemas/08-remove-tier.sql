-- Remove tier column from customers table
-- This field is not used in our business logic

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'accounts'
        AND table_name = 'customers'
        AND column_name = 'tier'
    ) THEN
        ALTER TABLE accounts.customers DROP COLUMN tier;
    END IF;
END $$;
