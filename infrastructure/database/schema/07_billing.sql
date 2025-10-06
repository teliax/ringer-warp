-- Billing and Rating Schema
-- Handles customer billing, rating, payments, and invoicing

-- Customer balance and credit
CREATE TABLE billing.account_balance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID UNIQUE NOT NULL REFERENCES accounts.accounts(id),
    
    -- Current balance (negative = customer owes money)
    current_balance DECIMAL(12,2) DEFAULT 0.00,
    
    -- Credit limits
    credit_limit DECIMAL(12,2) DEFAULT 1000.00,
    available_credit DECIMAL(12,2) GENERATED ALWAYS AS (credit_limit + current_balance) STORED,
    
    -- Prepaid balance (if applicable)
    prepaid_balance DECIMAL(12,2) DEFAULT 0.00,
    
    -- Auto-recharge for prepaid
    auto_recharge_enabled BOOLEAN DEFAULT FALSE,
    auto_recharge_threshold DECIMAL(12,2),
    auto_recharge_amount DECIMAL(12,2),
    
    -- Status
    balance_status VARCHAR(50) DEFAULT 'GOOD', -- GOOD, WARNING, SUSPENDED, COLLECTION
    
    -- Timestamps
    last_payment_date TIMESTAMPTZ,
    last_invoice_date TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate plans
CREATE TABLE billing.rate_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Plan type
    plan_type VARCHAR(50) NOT NULL, -- STANDARD, CUSTOM, WHOLESALE
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    available_for_new_customers BOOLEAN DEFAULT TRUE,
    
    -- Effective dates
    effective_date DATE NOT NULL,
    expires_date DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer rate plan assignments
CREATE TABLE billing.account_rate_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id),
    rate_plan_id UUID NOT NULL REFERENCES billing.rate_plans(id),
    
    -- Overrides (for custom rates)
    custom_rates JSONB DEFAULT '{}',
    
    -- Commitment
    commitment_amount DECIMAL(12,2), -- Monthly commitment
    commitment_start_date DATE,
    commitment_end_date DATE,
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    deactivated_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(account_id, rate_plan_id) WHERE active = TRUE
);

-- Voice rate deck (customer rates)
CREATE TABLE billing.voice_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rate_plan_id UUID NOT NULL REFERENCES billing.rate_plans(id),
    
    -- Destination
    prefix VARCHAR(20) NOT NULL,
    destination_name VARCHAR(255),
    country_code VARCHAR(3),
    
    -- Rate type
    rate_type VARCHAR(50) NOT NULL, -- TERMINATING, ORIGINATING, TOLL_FREE
    
    -- Jurisdiction-based rates (for US)
    interstate_rate DECIMAL(10,6),
    intrastate_rate DECIMAL(10,6),
    local_rate DECIMAL(10,6),
    
    -- Simple rate (for international)
    flat_rate DECIMAL(10,6),
    
    -- Billing increments
    initial_increment INTEGER DEFAULT 6, -- seconds
    subsequent_increment INTEGER DEFAULT 6,
    
    -- Minimum charge
    minimum_duration INTEGER DEFAULT 6, -- seconds
    connection_fee DECIMAL(10,6) DEFAULT 0.00,
    
    -- Effective dates
    effective_date DATE NOT NULL,
    expires_date DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(rate_plan_id, prefix, rate_type, effective_date)
);

-- SMS/MMS rates
CREATE TABLE billing.messaging_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rate_plan_id UUID NOT NULL REFERENCES billing.rate_plans(id),
    
    -- Message type
    message_type message_type NOT NULL,
    direction message_direction NOT NULL,
    
    -- Country/destination
    country_code VARCHAR(3) NOT NULL,
    
    -- Rates
    rate_per_segment DECIMAL(10,6) NOT NULL,
    
    -- Long code vs short code vs toll-free
    number_type VARCHAR(50), -- LONG_CODE, SHORT_CODE, TOLL_FREE
    
    -- Effective dates
    effective_date DATE NOT NULL,
    expires_date DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(rate_plan_id, message_type, direction, country_code, number_type, effective_date)
);

-- DID/Number rates
CREATE TABLE billing.number_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rate_plan_id UUID NOT NULL REFERENCES billing.rate_plans(id),
    
    -- Number type
    number_type number_type NOT NULL,
    
    -- Location (optional)
    country_code VARCHAR(3) DEFAULT 'USA',
    state VARCHAR(2),
    rate_center VARCHAR(100),
    
    -- Monthly recurring charge
    monthly_rate DECIMAL(10,2) NOT NULL,
    
    -- One-time fees
    setup_fee DECIMAL(10,2) DEFAULT 0.00,
    port_in_fee DECIMAL(10,2) DEFAULT 0.00,
    
    -- Features
    includes_channels INTEGER, -- Concurrent call paths
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices
CREATE TABLE billing.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id),
    
    -- Invoice details
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    
    -- Billing period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Amounts
    subtotal DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(12,2) DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL,
    
    -- Previous balance
    previous_balance DECIMAL(12,2) DEFAULT 0.00,
    payments_received DECIMAL(12,2) DEFAULT 0.00,
    balance_forward DECIMAL(12,2) DEFAULT 0.00,
    
    -- Status
    status VARCHAR(50) DEFAULT 'DRAFT', -- DRAFT, SENT, PAID, PARTIAL, OVERDUE, VOID
    
    -- NetSuite integration
    netsuite_invoice_id VARCHAR(100),
    netsuite_sync_status VARCHAR(50),
    netsuite_sync_error TEXT,
    
    -- Timestamps
    sent_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice line items
CREATE TABLE billing.invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES billing.invoices(id) ON DELETE CASCADE,
    
    -- Item details
    item_type VARCHAR(50) NOT NULL, -- USAGE, MONTHLY, SETUP, CREDIT, ADJUSTMENT
    description TEXT NOT NULL,
    
    -- Quantity and rate
    quantity DECIMAL(12,4) DEFAULT 1,
    unit_price DECIMAL(12,6),
    amount DECIMAL(12,2) NOT NULL,
    
    -- Tax
    taxable BOOLEAN DEFAULT TRUE,
    tax_rate DECIMAL(5,4),
    tax_amount DECIMAL(12,2) DEFAULT 0.00,
    
    -- Reference
    service_type VARCHAR(50), -- VOICE, SMS, DID, etc.
    reference_id UUID, -- Links to source record
    
    -- NetSuite mapping
    netsuite_sku VARCHAR(50),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE billing.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id),
    
    -- Payment details
    payment_date TIMESTAMPTZ NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_method payment_method NOT NULL,
    
    -- Payment reference
    reference_number VARCHAR(100),
    
    -- Credit card info (tokenized)
    card_last_four VARCHAR(4),
    card_type VARCHAR(20), -- VISA, MC, AMEX, DISCOVER
    
    -- ACH info
    bank_name VARCHAR(100),
    account_last_four VARCHAR(4),
    
    -- Processing
    processor VARCHAR(50), -- AUTHORIZE_NET, STRIPE, etc.
    processor_transaction_id VARCHAR(255),
    processor_fee DECIMAL(10,2),
    
    -- Status
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, COMPLETED, FAILED, REFUNDED
    
    -- Application
    unapplied_amount DECIMAL(12,2),
    
    -- Metadata
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment applications (which invoices a payment was applied to)
CREATE TABLE billing.payment_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES billing.payments(id),
    invoice_id UUID NOT NULL REFERENCES billing.invoices(id),
    
    applied_amount DECIMAL(12,2) NOT NULL,
    applied_date TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credits and adjustments
CREATE TABLE billing.credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id),
    
    -- Credit details
    credit_date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    
    -- Reason
    credit_type VARCHAR(50) NOT NULL, -- SERVICE_CREDIT, GOODWILL, DISPUTE, PROMO
    reason TEXT NOT NULL,
    
    -- Reference
    reference_invoice_id UUID REFERENCES billing.invoices(id),
    
    -- Application
    unapplied_amount DECIMAL(12,2),
    
    -- Approval
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tax rates by jurisdiction
CREATE TABLE billing.tax_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Jurisdiction
    country VARCHAR(3) NOT NULL,
    state VARCHAR(2),
    county VARCHAR(100),
    city VARCHAR(100),
    
    -- Tax details
    tax_type VARCHAR(50) NOT NULL, -- SALES, USF, E911, etc.
    tax_rate DECIMAL(6,4) NOT NULL, -- Percentage
    
    -- Fixed fees
    fixed_amount DECIMAL(10,2), -- For E911, etc.
    
    -- Effective dates
    effective_date DATE NOT NULL,
    expires_date DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(country, state, county, city, tax_type, effective_date)
);

-- Usage aggregation for billing (from BigQuery)
CREATE TABLE billing.usage_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id),
    
    -- Period
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    
    -- Voice usage
    voice_minutes_outbound BIGINT DEFAULT 0,
    voice_minutes_inbound BIGINT DEFAULT 0,
    voice_minutes_toll_free BIGINT DEFAULT 0,
    
    -- SMS usage
    sms_segments_outbound BIGINT DEFAULT 0,
    sms_segments_inbound BIGINT DEFAULT 0,
    mms_messages_outbound BIGINT DEFAULT 0,
    mms_messages_inbound BIGINT DEFAULT 0,
    
    -- API usage
    api_requests_lrn BIGINT DEFAULT 0,
    api_requests_cnam BIGINT DEFAULT 0,
    api_requests_lerg BIGINT DEFAULT 0,
    
    -- Calculated amounts
    total_charges DECIMAL(12,2),
    
    -- Status
    processed BOOLEAN DEFAULT FALSE,
    invoice_id UUID REFERENCES billing.invoices(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(account_id, billing_period_start, billing_period_end)
);

-- Indexes
CREATE INDEX idx_account_balance_account ON billing.account_balance(account_id);
CREATE INDEX idx_account_balance_status ON billing.account_balance(balance_status);
CREATE INDEX idx_rate_plans_active ON billing.rate_plans(active);
CREATE INDEX idx_account_rate_plans_account ON billing.account_rate_plans(account_id);
CREATE INDEX idx_voice_rates_lookup ON billing.voice_rates(rate_plan_id, prefix, rate_type);
CREATE INDEX idx_invoices_account ON billing.invoices(account_id);
CREATE INDEX idx_invoices_status ON billing.invoices(status);
CREATE INDEX idx_invoices_date ON billing.invoices(invoice_date);
CREATE INDEX idx_invoice_items_invoice ON billing.invoice_items(invoice_id);
CREATE INDEX idx_payments_account ON billing.payments(account_id);
CREATE INDEX idx_payments_status ON billing.payments(status);
CREATE INDEX idx_payment_applications_payment ON billing.payment_applications(payment_id);
CREATE INDEX idx_credits_account ON billing.credits(account_id);
CREATE INDEX idx_tax_rates_jurisdiction ON billing.tax_rates(country, state, county, city);
CREATE INDEX idx_usage_summary_lookup ON billing.usage_summary(account_id, billing_period_start);

-- Triggers
CREATE TRIGGER update_account_balance_updated_at BEFORE UPDATE ON billing.account_balance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_plans_updated_at BEFORE UPDATE ON billing.rate_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON billing.invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON billing.payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate invoice totals
CREATE OR REPLACE FUNCTION billing.calculate_invoice_total(p_invoice_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE billing.invoices
    SET subtotal = (
            SELECT COALESCE(SUM(amount), 0)
            FROM billing.invoice_items
            WHERE invoice_id = p_invoice_id
        ),
        tax_amount = (
            SELECT COALESCE(SUM(tax_amount), 0)
            FROM billing.invoice_items
            WHERE invoice_id = p_invoice_id
        ),
        total_amount = subtotal + tax_amount + balance_forward
    WHERE id = p_invoice_id;
END;
$$ LANGUAGE plpgsql;

-- Function to apply payment to invoices
CREATE OR REPLACE FUNCTION billing.apply_payment(
    p_payment_id UUID,
    p_invoice_ids UUID[]
)
RETURNS void AS $$
DECLARE
    v_remaining_amount DECIMAL(12,2);
    v_invoice RECORD;
BEGIN
    -- Get payment amount
    SELECT amount INTO v_remaining_amount
    FROM billing.payments
    WHERE id = p_payment_id;
    
    -- Apply to each invoice in order
    FOR v_invoice IN
        SELECT id, total_amount - COALESCE(
            (SELECT SUM(applied_amount)
             FROM billing.payment_applications
             WHERE invoice_id = invoices.id), 0
        ) as amount_due
        FROM billing.invoices
        WHERE id = ANY(p_invoice_ids)
        AND status != 'PAID'
        ORDER BY invoice_date
    LOOP
        IF v_remaining_amount <= 0 THEN
            EXIT;
        END IF;
        
        INSERT INTO billing.payment_applications (
            payment_id, invoice_id, applied_amount
        ) VALUES (
            p_payment_id,
            v_invoice.id,
            LEAST(v_remaining_amount, v_invoice.amount_due)
        );
        
        v_remaining_amount := v_remaining_amount - LEAST(v_remaining_amount, v_invoice.amount_due);
        
        -- Update invoice status if fully paid
        UPDATE billing.invoices
        SET status = CASE
            WHEN total_amount <= (
                SELECT COALESCE(SUM(applied_amount), 0)
                FROM billing.payment_applications
                WHERE invoice_id = v_invoice.id
            ) THEN 'PAID'
            ELSE 'PARTIAL'
        END,
        paid_at = CASE
            WHEN total_amount <= (
                SELECT COALESCE(SUM(applied_amount), 0)
                FROM billing.payment_applications
                WHERE invoice_id = v_invoice.id
            ) THEN NOW()
            ELSE paid_at
        END
        WHERE id = v_invoice.id;
    END LOOP;
    
    -- Update payment with unapplied amount
    UPDATE billing.payments
    SET unapplied_amount = v_remaining_amount,
        status = 'COMPLETED'
    WHERE id = p_payment_id;
END;
$$ LANGUAGE plpgsql;