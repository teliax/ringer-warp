package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/ringer-warp/api-gateway/internal/models"
)

// CreateWithTransaction creates a customer within a transaction
// Returns the customer and a commit/rollback function
func (r *CustomerRepository) CreateWithTransaction(ctx context.Context, req *models.CreateCustomerRequest, createdBy string) (*models.Customer, pgx.Tx, error) {
	// Auto-generate BAN (2 letters + 9 digits)
	ban := generateBAN()

	// Begin transaction
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to begin transaction: %w", err)
	}

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
	err = tx.QueryRow(ctx, query,
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
		tx.Rollback(ctx)
		return nil, nil, fmt.Errorf("failed to create customer: %w", err)
	}

	return customer, tx, nil
}

// UpdateHubSpotID updates the customer's external_ids with HubSpot company ID
func (r *CustomerRepository) UpdateHubSpotID(ctx context.Context, tx pgx.Tx, customerID uuid.UUID, hubspotCompanyID string) error {
	query := `
		UPDATE accounts.customers
		SET external_ids = jsonb_set(
			COALESCE(external_ids, '{}'::jsonb),
			'{hubspot_company_id}',
			to_jsonb($1::text)
		),
		updated_at = NOW()
		WHERE id = $2
	`

	_, err := tx.Exec(ctx, query, hubspotCompanyID, customerID)
	if err != nil {
		return fmt.Errorf("failed to update HubSpot ID: %w", err)
	}

	return nil
}
