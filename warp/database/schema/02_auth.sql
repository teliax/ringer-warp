-- Authentication and Authorization Schema
-- Handles users, API keys, permissions, and session management

-- Users table (for portal access)
CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    
    -- Authentication
    auth_type auth_type DEFAULT 'PASSWORD',
    password_hash VARCHAR(255), -- For local auth
    oauth_provider VARCHAR(50), -- google, microsoft, etc
    oauth_id VARCHAR(255),
    
    -- User Information
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    avatar_url VARCHAR(500),
    
    -- Access Control
    role user_role DEFAULT 'CUSTOMER',
    is_account_owner BOOLEAN DEFAULT FALSE,
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    
    -- Security
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ,
    
    -- Metadata
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Keys for programmatic access
CREATE TABLE auth.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    
    key_prefix VARCHAR(20) NOT NULL, -- First 8 chars for identification
    key_hash VARCHAR(255) NOT NULL, -- SHA256 hash of full key
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Permissions
    scopes TEXT[], -- Array of permission scopes
    allowed_ips INET[], -- IP whitelist (empty = all allowed)
    
    -- Rate Limiting
    rate_limit_per_second INTEGER DEFAULT 10,
    rate_limit_per_minute INTEGER DEFAULT 100,
    rate_limit_per_hour INTEGER DEFAULT 1000,
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    last_used_ip INET,
    expires_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES auth.users(id),
    
    UNIQUE(key_prefix)
);

-- Permission definitions
CREATE TABLE auth.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL, -- ACCOUNT, BILLING, NUMBERS, ROUTING, etc
    description TEXT,
    
    -- Permission details
    resource VARCHAR(100) NOT NULL, -- accounts, trunks, numbers, etc
    action VARCHAR(50) NOT NULL, -- read, write, delete, execute
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role permissions mapping
CREATE TABLE auth.role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role user_role NOT NULL,
    permission_id UUID NOT NULL REFERENCES auth.permissions(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role, permission_id)
);

-- User sessions (for web portal)
CREATE TABLE auth.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    refresh_token_hash VARCHAR(255) UNIQUE,
    
    -- Session details
    ip_address INET,
    user_agent TEXT,
    
    -- Expiration
    expires_at TIMESTAMPTZ NOT NULL,
    refresh_expires_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log for authentication events
CREATE TABLE auth.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    account_id UUID REFERENCES accounts.accounts(id),
    api_key_id UUID REFERENCES auth.api_keys(id),
    
    event_type VARCHAR(50) NOT NULL, -- LOGIN, LOGOUT, API_CALL, PERMISSION_CHANGE, etc
    event_details JSONB DEFAULT '{}',
    
    ip_address INET,
    user_agent TEXT,
    
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MFA backup codes
CREATE TABLE auth.mfa_backup_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    used_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OAuth state for secure OAuth flows
CREATE TABLE auth.oauth_state (
    state VARCHAR(255) PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    redirect_uri VARCHAR(500) NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- Indexes
CREATE INDEX idx_users_email ON auth.users(email);
CREATE INDEX idx_users_account_id ON auth.users(account_id);
CREATE INDEX idx_api_keys_account_id ON auth.api_keys(account_id);
CREATE INDEX idx_api_keys_key_prefix ON auth.api_keys(key_prefix);
CREATE INDEX idx_api_keys_active ON auth.api_keys(active) WHERE active = TRUE;
CREATE INDEX idx_sessions_user_id ON auth.sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON auth.sessions(token_hash);
CREATE INDEX idx_sessions_expires ON auth.sessions(expires_at);
CREATE INDEX idx_audit_log_user_id ON auth.audit_log(user_id);
CREATE INDEX idx_audit_log_account_id ON auth.audit_log(account_id);
CREATE INDEX idx_audit_log_created_at ON auth.audit_log(created_at);

-- Triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION auth.cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM auth.sessions WHERE expires_at < NOW();
    DELETE FROM auth.oauth_state WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Initial permissions seed data
INSERT INTO auth.permissions (name, category, resource, action) VALUES
-- Account permissions
('accounts.read', 'ACCOUNT', 'accounts', 'read'),
('accounts.write', 'ACCOUNT', 'accounts', 'write'),
('accounts.delete', 'ACCOUNT', 'accounts', 'delete'),
-- Billing permissions
('billing.read', 'BILLING', 'billing', 'read'),
('billing.write', 'BILLING', 'billing', 'write'),
('billing.pay', 'BILLING', 'billing', 'execute'),
-- Number permissions
('numbers.read', 'NUMBERS', 'numbers', 'read'),
('numbers.write', 'NUMBERS', 'numbers', 'write'),
('numbers.port', 'NUMBERS', 'numbers', 'execute'),
-- Trunk permissions
('trunks.read', 'ROUTING', 'trunks', 'read'),
('trunks.write', 'ROUTING', 'trunks', 'write'),
('trunks.delete', 'ROUTING', 'trunks', 'delete'),
-- CDR permissions
('cdr.read', 'REPORTING', 'cdr', 'read'),
('cdr.export', 'REPORTING', 'cdr', 'execute'),
-- API permissions
('api.manage', 'API', 'api_keys', 'write');

-- Map permissions to roles
INSERT INTO auth.role_permissions (role, permission_id)
SELECT 'SUPER_ADMIN', id FROM auth.permissions; -- Super admin gets everything

INSERT INTO auth.role_permissions (role, permission_id)
SELECT 'CUSTOMER', id FROM auth.permissions 
WHERE name IN ('accounts.read', 'billing.read', 'numbers.read', 'trunks.read', 'cdr.read');