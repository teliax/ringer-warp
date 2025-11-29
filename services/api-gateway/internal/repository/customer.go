package repository

import (
	"context"
	"fmt"
	"math/rand"
	"time"

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
func (r *CustomerRepository) Create(ctx context.Context, req *models.CreateCustomerRequest, createdBy string) (*models.Customer, error) {
	// Auto-generate BAN (2 letters + 9 digits, e.g., "AC-123456789")
	ban := generateBAN()

	query := `
		INSERT INTO accounts.customers (
			ban, company_name, legal_name, customer_type,
			contact, address, services, kyc_data, business_info, external_ids, custom_fields,
			credit_limit, payment_terms, billing_cycle,
			created_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		RETURNING id, ban, company_name, legal_name, status, customer_type,
		          contact, address, services, kyc_data, business_info, external_ids, custom_fields,
		          credit_limit, current_balance, prepaid_balance, payment_terms, billing_cycle, currency,
		          created_at, updated_at, created_by, updated_by
	`

	customer := &models.Customer{}
	err := r.db.QueryRow(ctx, query,
		ban, req.CompanyName, nullString(req.LegalName), req.CustomerType,
		req.Contact, req.Address, req.Services, req.KYCData, req.BusinessInfo, req.ExternalIDs, req.CustomFields,
		req.CreditLimit, coalesce(req.PaymentTerms, 30), coalesce(req.BillingCycle, "MONTHLY"),
		createdBy,
	).Scan(
		&customer.ID, &customer.BAN, &customer.CompanyName, &customer.LegalName, &customer.Status, &customer.CustomerType,
		&customer.Contact, &customer.Address, &customer.Services, &customer.KYCData, &customer.BusinessInfo, &customer.ExternalIDs, &customer.CustomFields,
		&customer.CreditLimit, &customer.CurrentBalance, &customer.PrepaidBalance, &customer.PaymentTerms, &customer.BillingCycle, &customer.Currency,
		&customer.CreatedAt, &customer.UpdatedAt, &customer.CreatedBy, &customer.UpdatedBy,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create customer: %w", err)
	}

	return customer, nil
}

// List retrieves customers with pagination and filtering
// customerFilter: nil = all customers (SuperAdmin), []uuid = specific customers, empty slice = no access
func (r *CustomerRepository) List(ctx context.Context, customerFilter []uuid.UUID, search string, status string, page, perPage int) ([]models.Customer, int64, error) {
	// Build query with filters
	baseQuery := `FROM accounts.customers WHERE 1=1`
	args := []interface{}{}
	argPos := 1

	// Customer scoping filter (multi-tenant isolation)
	if customerFilter != nil {
		// nil = SuperAdmin (no filter)
		// empty slice = no customers accessible (return nothing)
		// populated slice = filter to these customer IDs
		if len(customerFilter) == 0 {
			// User has no customer access - return empty result
			return []models.Customer{}, 0, nil
		}
		baseQuery += fmt.Sprintf(" AND id = ANY($%d)", argPos)
		args = append(args, customerFilter)
		argPos++
	}

	if search != "" {
		baseQuery += fmt.Sprintf(" AND (company_name ILIKE $%d OR ban ILIKE $%d OR legal_name ILIKE $%d)", argPos, argPos, argPos)
		args = append(args, "%"+search+"%")
		argPos++
	}

	if status != "" {
		baseQuery += fmt.Sprintf(" AND status = $%d", argPos)
		args = append(args, status)
		argPos++
	}

	// Count total
	var total int64
	countQuery := "SELECT COUNT(*) " + baseQuery
	err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count customers: %w", err)
	}

	// Get paginated results
	offset := (page - 1) * perPage
	dataQuery := `
		SELECT id, ban, company_name, legal_name, status, customer_type,
		       contact, address, services, kyc_data, business_info, external_ids, custom_fields,
		       credit_limit, current_balance, prepaid_balance, payment_terms, billing_cycle, currency,
		       created_at, updated_at, created_by, updated_by
	` + baseQuery + ` ORDER BY created_at DESC LIMIT $` + fmt.Sprintf("%d", argPos) + ` OFFSET $` + fmt.Sprintf("%d", argPos+1)

	args = append(args, perPage, offset)

	rows, err := r.db.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list customers: %w", err)
	}
	defer rows.Close()

	customers := []models.Customer{}
	for rows.Next() {
		var c models.Customer
		err := rows.Scan(
			&c.ID, &c.BAN, &c.CompanyName, &c.LegalName, &c.Status, &c.CustomerType,
			&c.Contact, &c.Address, &c.Services, &c.KYCData, &c.BusinessInfo, &c.ExternalIDs, &c.CustomFields,
			&c.CreditLimit, &c.CurrentBalance, &c.PrepaidBalance, &c.PaymentTerms, &c.BillingCycle, &c.Currency,
			&c.CreatedAt, &c.UpdatedAt, &c.CreatedBy, &c.UpdatedBy,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan customer: %w", err)
		}
		customers = append(customers, c)
	}

	return customers, total, nil
}

// GetByID retrieves a customer by ID
func (r *CustomerRepository) GetByID(ctx context.Context, customerID uuid.UUID) (*models.Customer, error) {
	query := `
		SELECT id, ban, company_name, legal_name, status, customer_type,
		       contact, address, services, kyc_data, business_info, external_ids, custom_fields,
		       credit_limit, current_balance, prepaid_balance, payment_terms, billing_cycle, currency,
		       created_at, updated_at, created_by, updated_by
		FROM accounts.customers
		WHERE id = $1
	`

	customer := &models.Customer{}
	err := r.db.QueryRow(ctx, query, customerID).Scan(
		&customer.ID, &customer.BAN, &customer.CompanyName, &customer.LegalName, &customer.Status, &customer.CustomerType,
		&customer.Contact, &customer.Address, &customer.Services, &customer.KYCData, &customer.BusinessInfo, &customer.ExternalIDs, &customer.CustomFields,
		&customer.CreditLimit, &customer.CurrentBalance, &customer.PrepaidBalance, &customer.PaymentTerms, &customer.BillingCycle, &customer.Currency,
		&customer.CreatedAt, &customer.UpdatedAt, &customer.CreatedBy, &customer.UpdatedBy,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get customer: %w", err)
	}

	return customer, nil
}

// GetByHubSpotID retrieves a customer by HubSpot company ID
func (r *CustomerRepository) GetByHubSpotID(ctx context.Context, hubspotCompanyID string) (*models.Customer, error) {
	query := `
		SELECT id, ban, company_name, legal_name, status, customer_type,
		       contact, address, services, kyc_data, business_info, external_ids, custom_fields,
		       credit_limit, current_balance, prepaid_balance, payment_terms, billing_cycle, currency,
		       created_at, updated_at, created_by, updated_by
		FROM accounts.customers
		WHERE external_ids->>'hubspot_company_id' = $1
	`

	customer := &models.Customer{}
	err := r.db.QueryRow(ctx, query, hubspotCompanyID).Scan(
		&customer.ID, &customer.BAN, &customer.CompanyName, &customer.LegalName, &customer.Status, &customer.CustomerType,
		&customer.Contact, &customer.Address, &customer.Services, &customer.KYCData, &customer.BusinessInfo, &customer.ExternalIDs, &customer.CustomFields,
		&customer.CreditLimit, &customer.CurrentBalance, &customer.PrepaidBalance, &customer.PaymentTerms, &customer.BillingCycle, &customer.Currency,
		&customer.CreatedAt, &customer.UpdatedAt, &customer.CreatedBy, &customer.UpdatedBy,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get customer by HubSpot ID: %w", err)
	}

	return customer, nil
}

// GetByBAN retrieves a customer by BAN
func (r *CustomerRepository) GetByBAN(ctx context.Context, ban string) (*models.Customer, error) {
	query := `
		SELECT id, ban, company_name, legal_name, status, customer_type,
		       contact, address, services, kyc_data, business_info, external_ids, custom_fields,
		       credit_limit, current_balance, prepaid_balance, payment_terms, billing_cycle, currency,
		       created_at, updated_at, created_by, updated_by
		FROM accounts.customers
		WHERE ban = $1
	`

	customer := &models.Customer{}
	err := r.db.QueryRow(ctx, query, ban).Scan(
		&customer.ID, &customer.BAN, &customer.CompanyName, &customer.LegalName, &customer.Status, &customer.CustomerType,
		&customer.Contact, &customer.Address, &customer.Services, &customer.KYCData, &customer.BusinessInfo, &customer.ExternalIDs, &customer.CustomFields,
		&customer.CreditLimit, &customer.CurrentBalance, &customer.PrepaidBalance, &customer.PaymentTerms, &customer.BillingCycle, &customer.Currency,
		&customer.CreatedAt, &customer.UpdatedAt, &customer.CreatedBy, &customer.UpdatedBy,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get customer by BAN: %w", err)
	}

	return customer, nil
}

// Update updates a customer
func (r *CustomerRepository) Update(ctx context.Context, customerID uuid.UUID, req *models.UpdateCustomerRequest, updatedBy string) (*models.Customer, error) {
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

	if req.Services != nil {
		updates = append(updates, fmt.Sprintf("services = $%d", argPos))
		args = append(args, req.Services)
		argPos++
	}

	if req.KYCData != nil {
		updates = append(updates, fmt.Sprintf("kyc_data = $%d", argPos))
		args = append(args, req.KYCData)
		argPos++
	}

	if req.BusinessInfo != nil {
		updates = append(updates, fmt.Sprintf("business_info = $%d", argPos))
		args = append(args, req.BusinessInfo)
		argPos++
	}

	if req.ExternalIDs != nil {
		updates = append(updates, fmt.Sprintf("external_ids = $%d", argPos))
		args = append(args, req.ExternalIDs)
		argPos++
	}

	if req.CustomFields != nil {
		updates = append(updates, fmt.Sprintf("custom_fields = $%d", argPos))
		args = append(args, req.CustomFields)
		argPos++
	}

	if len(updates) == 0 {
		// Nothing to update, just return existing customer
		return r.GetByID(ctx, customerID)
	}

	updates = append(updates, fmt.Sprintf("updated_by = $%d", argPos))
	args = append(args, updatedBy)
	argPos++

	updates = append(updates, "updated_at = NOW()")

	args = append(args, customerID)
	query := fmt.Sprintf(`
		UPDATE accounts.customers
		SET %s
		WHERE id = $%d
		RETURNING id, ban, company_name, legal_name, status, customer_type,
		          contact, address, services, kyc_data, business_info, external_ids, custom_fields,
		          credit_limit, current_balance, prepaid_balance, payment_terms, billing_cycle, currency,
		          created_at, updated_at, created_by, updated_by
	`, join(updates, ", "), argPos)

	customer := &models.Customer{}
	err := r.db.QueryRow(ctx, query, args...).Scan(
		&customer.ID, &customer.BAN, &customer.CompanyName, &customer.LegalName, &customer.Status, &customer.CustomerType,
		&customer.Contact, &customer.Address, &customer.Services, &customer.KYCData, &customer.BusinessInfo, &customer.ExternalIDs, &customer.CustomFields,
		&customer.CreditLimit, &customer.CurrentBalance, &customer.PrepaidBalance, &customer.PaymentTerms, &customer.BillingCycle, &customer.Currency,
		&customer.CreatedAt, &customer.UpdatedAt, &customer.CreatedBy, &customer.UpdatedBy,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update customer: %w", err)
	}

	return customer, nil
}

// Helper functions
func nullString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func coalesce[T comparable](val T, defaultVal T) T {
	var zero T
	if val == zero {
		return defaultVal
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

// VerifyCustomerAccess checks if a customer ID is in the accessible list
// Returns error if access denied
// customerFilter: nil = SuperAdmin (all access), []uuid = specific customers
func (r *CustomerRepository) VerifyCustomerAccess(customerID uuid.UUID, customerFilter []uuid.UUID) error {
	// SuperAdmin (nil filter) - always allow
	if customerFilter == nil {
		return nil
	}

	// Empty filter - no customers accessible
	if len(customerFilter) == 0 {
		return fmt.Errorf("access denied: user has no customer access")
	}

	// Check if customerID is in the filter list
	for _, allowedID := range customerFilter {
		if allowedID == customerID {
			return nil // Access granted
		}
	}

	return fmt.Errorf("access denied: customer not in accessible list")
}

// generateBAN creates a unique BAN in format: 2 letters + 9 digits (e.g., "AC-123456789")
func generateBAN() string {
	rand.Seed(time.Now().UnixNano())

	// Generate 2 random uppercase letters
	letters := "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	prefix := string(letters[rand.Intn(26)]) + string(letters[rand.Intn(26)])

	// Generate 9 random digits
	digits := rand.Intn(1000000000) // 0-999999999

	return fmt.Sprintf("%s-%09d", prefix, digits)
}
