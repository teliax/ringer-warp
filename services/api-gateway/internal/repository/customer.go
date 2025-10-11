package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ringer-warp/api-gateway/internal/models"
)

type CustomerRepository struct {
	db *pgxpool.Pool
}

func NewCustomerRepository(db *pgxpool.Pool) *CustomerRepository {
	return &CustomerRepository{db: db}
}

// Create creates a new customer
func (r *CustomerRepository) Create(ctx context.Context, req *models.CreateCustomerRequest) (*models.Customer, error) {
	query := `
		INSERT INTO accounts.customers (
			ban, company_name, legal_name, customer_type, tier,
			contact, address, billing_cycle, payment_terms, currency,
			credit_limit, custom_fields
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
		)
		RETURNING id, ban, company_name, legal_name, customer_type, tier,
		          contact, address, billing_cycle, payment_terms, currency,
		          status, credit_limit, current_balance, prepaid_balance,
		          custom_fields, created_at, updated_at
	`

	customer := &models.Customer{}
	err := r.db.QueryRow(ctx, query,
		req.BAN,
		req.CompanyName,
		req.LegalName,
		req.CustomerType,
		coalesce(req.Tier, "STANDARD"),
		req.Contact,
		req.Address,
		coalesce(req.BillingCycle, "MONTHLY"),
		coalesce(req.PaymentTerms, 30),
		coalesce(req.Currency, "USD"),
		req.CreditLimit,
		req.CustomFields,
	).Scan(
		&customer.ID,
		&customer.BAN,
		&customer.CompanyName,
		&customer.LegalName,
		&customer.CustomerType,
		&customer.Tier,
		&customer.Contact,
		&customer.Address,
		&customer.BillingCycle,
		&customer.PaymentTerms,
		&customer.Currency,
		&customer.Status,
		&customer.CreditLimit,
		&customer.CurrentBalance,
		&customer.PrepaidBalance,
		&customer.CustomFields,
		&customer.CreatedAt,
		&customer.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create customer: %w", err)
	}

	return customer, nil
}

// GetByID retrieves a customer by ID
func (r *CustomerRepository) GetByID(ctx context.Context, id uuid.UUID, includeTrunks, includeDIDs bool) (*models.Customer, error) {
	query := `
		SELECT id, ban, company_name, legal_name, customer_type, tier,
		       contact, address, billing_cycle, payment_terms, currency,
		       status, credit_limit, current_balance, prepaid_balance,
		       custom_fields, created_at, updated_at
		FROM accounts.customers
		WHERE id = $1
	`

	customer := &models.Customer{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&customer.ID,
		&customer.BAN,
		&customer.CompanyName,
		&customer.LegalName,
		&customer.CustomerType,
		&customer.Tier,
		&customer.Contact,
		&customer.Address,
		&customer.BillingCycle,
		&customer.PaymentTerms,
		&customer.Currency,
		&customer.Status,
		&customer.CreditLimit,
		&customer.CurrentBalance,
		&customer.PrepaidBalance,
		&customer.CustomFields,
		&customer.CreatedAt,
		&customer.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get customer: %w", err)
	}

	// Load relationships if requested
	if includeTrunks {
		trunks, err := r.GetCustomerTrunks(ctx, id)
		if err != nil {
			return nil, err
		}
		customer.Trunks = trunks
	}

	if includeDIDs {
		dids, err := r.GetCustomerDIDs(ctx, id)
		if err != nil {
			return nil, err
		}
		customer.DIDs = dids
	}

	return customer, nil
}

// GetByBAN retrieves a customer by BAN
func (r *CustomerRepository) GetByBAN(ctx context.Context, ban string) (*models.Customer, error) {
	query := `
		SELECT id, ban, company_name, legal_name, customer_type, tier,
		       contact, address, billing_cycle, payment_terms, currency,
		       status, credit_limit, current_balance, prepaid_balance,
		       custom_fields, created_at, updated_at
		FROM accounts.customers
		WHERE ban = $1
	`

	customer := &models.Customer{}
	err := r.db.QueryRow(ctx, query, ban).Scan(
		&customer.ID,
		&customer.BAN,
		&customer.CompanyName,
		&customer.LegalName,
		&customer.CustomerType,
		&customer.Tier,
		&customer.Contact,
		&customer.Address,
		&customer.BillingCycle,
		&customer.PaymentTerms,
		&customer.Currency,
		&customer.Status,
		&customer.CreditLimit,
		&customer.CurrentBalance,
		&customer.PrepaidBalance,
		&customer.CustomFields,
		&customer.CreatedAt,
		&customer.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get customer by BAN: %w", err)
	}

	return customer, nil
}

// List retrieves customers with filters
func (r *CustomerRepository) List(ctx context.Context, search, status string, page, perPage int) ([]models.Customer, int, error) {
	// Build query with filters
	baseQuery := `FROM accounts.customers WHERE 1=1`
	countQuery := `SELECT COUNT(*) ` + baseQuery
	selectQuery := `
		SELECT id, ban, company_name, legal_name, customer_type, tier,
		       contact, address, billing_cycle, payment_terms, currency,
		       status, credit_limit, current_balance, prepaid_balance,
		       custom_fields, created_at, updated_at
	` + baseQuery

	args := []interface{}{}
	argPos := 1

	if search != "" {
		baseQuery += fmt.Sprintf(" AND (company_name ILIKE $%d OR ban ILIKE $%d)", argPos, argPos)
		args = append(args, "%"+search+"%")
		argPos++
		selectQuery = `
			SELECT id, ban, company_name, legal_name, customer_type, tier,
			       contact, address, billing_cycle, payment_terms, currency,
			       status, credit_limit, current_balance, prepaid_balance,
			       custom_fields, created_at, updated_at
		` + baseQuery
		countQuery = `SELECT COUNT(*) ` + baseQuery
	}

	if status != "" {
		baseQuery += fmt.Sprintf(" AND status = $%d", argPos)
		args = append(args, status)
		argPos++
		selectQuery = `
			SELECT id, ban, company_name, legal_name, customer_type, tier,
			       contact, address, billing_cycle, payment_terms, currency,
			       status, credit_limit, current_balance, prepaid_balance,
			       custom_fields, created_at, updated_at
		` + baseQuery
		countQuery = `SELECT COUNT(*) ` + baseQuery
	}

	// Get total count
	var total int
	err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count customers: %w", err)
	}

	// Add pagination
	offset := (page - 1) * perPage
	selectQuery += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argPos, argPos+1)
	args = append(args, perPage, offset)

	// Execute query
	rows, err := r.db.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list customers: %w", err)
	}
	defer rows.Close()

	customers := []models.Customer{}
	for rows.Next() {
		var c models.Customer
		err := rows.Scan(
			&c.ID, &c.BAN, &c.CompanyName, &c.LegalName, &c.CustomerType, &c.Tier,
			&c.Contact, &c.Address, &c.BillingCycle, &c.PaymentTerms, &c.Currency,
			&c.Status, &c.CreditLimit, &c.CurrentBalance, &c.PrepaidBalance,
			&c.CustomFields, &c.CreatedAt, &c.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan customer: %w", err)
		}
		customers = append(customers, c)
	}

	return customers, total, nil
}

// Update updates a customer
func (r *CustomerRepository) Update(ctx context.Context, id uuid.UUID, req *models.UpdateCustomerRequest) (*models.Customer, error) {
	// Build dynamic update query
	updates := []string{}
	args := []interface{}{}
	argPos := 1

	if req.CompanyName != nil {
		updates = append(updates, fmt.Sprintf("company_name = $%d", argPos))
		args = append(args, *req.CompanyName)
		argPos++
	}
	if req.LegalName != nil {
		updates = append(updates, fmt.Sprintf("legal_name = $%d", argPos))
		args = append(args, *req.LegalName)
		argPos++
	}
	if req.Tier != nil {
		updates = append(updates, fmt.Sprintf("tier = $%d", argPos))
		args = append(args, *req.Tier)
		argPos++
	}
	if req.Status != nil {
		updates = append(updates, fmt.Sprintf("status = $%d", argPos))
		args = append(args, *req.Status)
		argPos++
	}
	if req.Contact != nil {
		updates = append(updates, fmt.Sprintf("contact = $%d", argPos))
		args = append(args, req.Contact)
		argPos++
	}
	if req.Address != nil {
		updates = append(updates, fmt.Sprintf("address = $%d", argPos))
		args = append(args, req.Address)
		argPos++
	}

	if len(updates) == 0 {
		return r.GetByID(ctx, id, false, false)
	}

	args = append(args, id)
	query := fmt.Sprintf(`
		UPDATE accounts.customers
		SET %s, updated_at = NOW()
		WHERE id = $%d
		RETURNING id, ban, company_name, legal_name, customer_type, tier,
		          contact, address, billing_cycle, payment_terms, currency,
		          status, credit_limit, current_balance, prepaid_balance,
		          custom_fields, created_at, updated_at
	`, join(updates, ", "), argPos)

	customer := &models.Customer{}
	err := r.db.QueryRow(ctx, query, args...).Scan(
		&customer.ID, &customer.BAN, &customer.CompanyName, &customer.LegalName,
		&customer.CustomerType, &customer.Tier, &customer.Contact, &customer.Address,
		&customer.BillingCycle, &customer.PaymentTerms, &customer.Currency,
		&customer.Status, &customer.CreditLimit, &customer.CurrentBalance,
		&customer.PrepaidBalance, &customer.CustomFields, &customer.CreatedAt, &customer.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update customer: %w", err)
	}

	return customer, nil
}

// GetCustomerTrunks retrieves trunks for a customer
func (r *CustomerRepository) GetCustomerTrunks(ctx context.Context, customerID uuid.UUID) ([]models.Trunk, error) {
	query := `
		SELECT id, customer_id, trunk_name, trunk_code, partition_id,
		       inbound_config, outbound_config, codecs,
		       max_concurrent_calls, calls_per_second_limit,
		       status, created_at, updated_at
		FROM voice.trunks
		WHERE customer_id = $1 AND status != 'INACTIVE'
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query, customerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get customer trunks: %w", err)
	}
	defer rows.Close()

	trunks := []models.Trunk{}
	for rows.Next() {
		var t models.Trunk
		err := rows.Scan(
			&t.ID, &t.CustomerID, &t.TrunkName, &t.TrunkCode, &t.PartitionID,
			&t.InboundConfig, &t.OutboundConfig, &t.Codecs,
			&t.MaxConcurrentCalls, &t.CallsPerSecondLimit,
			&t.Status, &t.CreatedAt, &t.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan trunk: %w", err)
		}
		trunks = append(trunks, t)
	}

	return trunks, nil
}

// GetCustomerDIDs retrieves DIDs for a customer
func (r *CustomerRepository) GetCustomerDIDs(ctx context.Context, customerID uuid.UUID) ([]models.DID, error) {
	query := `
		SELECT id, number, customer_id, trunk_id, number_type,
		       voice_enabled, sms_enabled, mms_enabled, status, created_at
		FROM voice.dids
		WHERE customer_id = $1 AND status != 'DISCONNECTED'
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query, customerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get customer DIDs: %w", err)
	}
	defer rows.Close()

	dids := []models.DID{}
	for rows.Next() {
		var d models.DID
		err := rows.Scan(
			&d.ID, &d.Number, &d.CustomerID, &d.TrunkID, &d.NumberType,
			&d.VoiceEnabled, &d.SMSEnabled, &d.MMSEnabled, &d.Status, &d.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan DID: %w", err)
		}
		dids = append(dids, d)
	}

	return dids, nil
}

// Helper functions
func coalesce[T comparable](val T, def T) T {
	var zero T
	if val == zero {
		return def
	}
	return val
}

func join(strs []string, sep string) string {
	result := ""
	for i, s := range strs {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}
