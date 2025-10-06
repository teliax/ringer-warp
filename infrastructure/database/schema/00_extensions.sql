-- Enable required PostgreSQL extensions
-- This must be run as superuser or database owner

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- For UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- For encryption functions
CREATE EXTENSION IF NOT EXISTS "hstore";         -- For key-value storage
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- For text search optimization
CREATE EXTENSION IF NOT EXISTS "btree_gist";     -- For exclusion constraints
CREATE EXTENSION IF NOT EXISTS "postgres_fdw";   -- For foreign data wrappers (future use)

-- Create custom types
CREATE TYPE call_direction AS ENUM ('ORIGINATING', 'TERMINATING', 'INTERNAL');
CREATE TYPE call_status AS ENUM ('INITIATED', 'RINGING', 'ANSWERED', 'COMPLETED', 'FAILED', 'BUSY', 'NO_ANSWER', 'CANCELLED');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_type AS ENUM ('sms', 'mms');
CREATE TYPE billing_cycle AS ENUM ('PREPAID', 'POSTPAID', 'HYBRID');
CREATE TYPE payment_method AS ENUM ('CREDIT_CARD', 'ACH', 'WIRE_TRANSFER', 'CRYPTO', 'NET_TERMS');
CREATE TYPE account_status AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED');
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'BILLING', 'SUPPORT', 'CUSTOMER', 'API_ONLY');
CREATE TYPE auth_type AS ENUM ('PASSWORD', 'OAUTH', 'API_KEY', 'SAML', 'LDAP');
CREATE TYPE trunk_auth_type AS ENUM ('IP_ACL', 'SIP_REGISTER', 'BOTH');
CREATE TYPE routing_strategy AS ENUM ('LCR', 'QUALITY', 'ROUND_ROBIN', 'PRIORITY', 'CUSTOM');
CREATE TYPE number_type AS ENUM ('DID', 'TOLL_FREE', 'SHORT_CODE', 'ALPHANUMERIC');
CREATE TYPE number_status AS ENUM ('AVAILABLE', 'RESERVED', 'ACTIVE', 'PORTING_IN', 'PORTING_OUT', 'DISCONNECTED');
CREATE TYPE port_status AS ENUM ('PENDING', 'SUBMITTED', 'FOC_RECEIVED', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- Create schemas for logical separation
CREATE SCHEMA IF NOT EXISTS accounts;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS billing;
CREATE SCHEMA IF NOT EXISTS numbers;
CREATE SCHEMA IF NOT EXISTS routing;
CREATE SCHEMA IF NOT EXISTS cdr;
CREATE SCHEMA IF NOT EXISTS messaging;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS vendor_mgmt;

-- Grant usage on schemas to application role (will be created during deployment)
-- GRANT USAGE ON SCHEMA accounts TO warp_app;
-- GRANT USAGE ON SCHEMA auth TO warp_app;
-- etc...