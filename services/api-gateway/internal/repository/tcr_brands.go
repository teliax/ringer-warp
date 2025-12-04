package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ringer-warp/api-gateway/internal/models"
)

type TCRBrandRepository struct {
	db *pgxpool.Pool
}

func NewTCRBrandRepository(db *pgxpool.Pool) *TCRBrandRepository {
	return &TCRBrandRepository{db: db}
}

// Create creates a new brand registration
func (r *TCRBrandRepository) Create(ctx context.Context, req *models.CreateBrandRequest, customerID uuid.UUID, createdBy uuid.UUID) (*models.Brand10DLC, error) {
	query := `
		INSERT INTO messaging.brands_10dlc (
			customer_id, display_name, legal_name, entity_type,
			company_name, tax_id, vertical, website,
			country, state, city, street, postal_code,
			stock_exchange, stock_symbol,
			alt_business_id, alt_business_id_type,
			primary_contact_name, primary_contact_email, primary_contact_phone,
			business_contact_first_name, business_contact_last_name,
			business_contact_email, business_contact_phone,
			brand_relationship, reference_id, status,
			created_by
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
			$21, $22, $23, $24, $25, $26, $27, $28
		)
		RETURNING id, customer_id, tcr_brand_id, display_name, legal_name, company_name,
		          tax_id, entity_type, identity_status, vertical, website,
		          country, state, city, street, postal_code,
		          stock_exchange, stock_symbol, alt_business_id, alt_business_id_type,
		          primary_contact_name, primary_contact_email, primary_contact_phone,
		          business_contact_first_name, business_contact_last_name,
		          business_contact_email, business_contact_phone,
		          status, trust_score, vetting_status, vetting_provider, vetting_class,
		          vetting_date, brand_relationship, reference_id,
		          tcr_created_at, tcr_updated_at, created_at, updated_at, created_by, updated_by
	`

	brand := &models.Brand10DLC{}
	err := r.db.QueryRow(ctx, query,
		customerID, req.DisplayName, req.LegalName, req.EntityType,
		req.CompanyName, req.TaxID, req.Vertical, req.Website,
		req.Country, req.State, req.City, req.Street, req.PostalCode,
		req.StockExchange, req.StockSymbol,
		req.AltBusinessID, req.AltBusinessIDType,
		fmt.Sprintf("%s %s", strOrEmpty(req.ContactFirstName), strOrEmpty(req.ContactLastName)), req.Email, req.Phone,
		req.ContactFirstName, req.ContactLastName, req.ContactEmail, req.ContactPhone,
		"DIRECT_CUSTOMER", req.ReferenceID, "PENDING",
		createdBy,
	).Scan(
		&brand.ID, &brand.CustomerID, &brand.TCRBrandID, &brand.DisplayName, &brand.LegalName, &brand.CompanyName,
		&brand.TaxID, &brand.EntityType, &brand.IdentityStatus, &brand.Vertical, &brand.Website,
		&brand.Country, &brand.State, &brand.City, &brand.Street, &brand.PostalCode,
		&brand.StockExchange, &brand.StockSymbol, &brand.AltBusinessID, &brand.AltBusinessIDType,
		&brand.PrimaryContactName, &brand.PrimaryContactEmail, &brand.PrimaryContactPhone,
		&brand.BusinessContactFirstName, &brand.BusinessContactLastName,
		&brand.BusinessContactEmail, &brand.BusinessContactPhone,
		&brand.Status, &brand.TrustScore, &brand.VettingStatus, &brand.VettingProvider, &brand.VettingClass,
		&brand.VettingDate, &brand.BrandRelationship, &brand.ReferenceID,
		&brand.TCRCreatedAt, &brand.TCRUpdatedAt, &brand.CreatedAt, &brand.UpdatedAt, &brand.CreatedBy, &brand.UpdatedBy,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create brand: %w", err)
	}

	return brand, nil
}

// List retrieves brands with customer filtering
func (r *TCRBrandRepository) List(ctx context.Context, customerFilter []uuid.UUID, page, perPage int) ([]models.Brand10DLC, int64, error) {
	baseQuery := `FROM messaging.brands_10dlc WHERE 1=1`
	args := []interface{}{}
	argPos := 1

	// Customer scoping
	if customerFilter != nil {
		if len(customerFilter) == 0 {
			return []models.Brand10DLC{}, 0, nil
		}
		baseQuery += fmt.Sprintf(" AND customer_id = ANY($%d)", argPos)
		args = append(args, customerFilter)
		argPos++
	}

	// Count total
	var total int64
	countQuery := "SELECT COUNT(*) " + baseQuery
	err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count brands: %w", err)
	}

	// Get paginated results
	offset := (page - 1) * perPage
	selectQuery := `
		SELECT id, customer_id, tcr_brand_id, display_name, legal_name, company_name,
		       tax_id, entity_type, identity_status, vertical, website,
		       country, state, city, street, postal_code,
		       stock_exchange, stock_symbol, alt_business_id, alt_business_id_type,
		       primary_contact_name, primary_contact_email, primary_contact_phone,
		       business_contact_first_name, business_contact_last_name,
		       business_contact_email, business_contact_phone,
		       status, trust_score, vetting_status, vetting_provider, vetting_class,
		       vetting_date, brand_relationship, reference_id,
		       tcr_created_at, tcr_updated_at, created_at, updated_at, created_by, updated_by
	` + baseQuery + fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argPos, argPos+1)
	args = append(args, perPage, offset)

	rows, err := r.db.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query brands: %w", err)
	}
	defer rows.Close()

	brands := []models.Brand10DLC{}
	for rows.Next() {
		var brand models.Brand10DLC
		err := rows.Scan(
			&brand.ID, &brand.CustomerID, &brand.TCRBrandID, &brand.DisplayName, &brand.LegalName, &brand.CompanyName,
			&brand.TaxID, &brand.EntityType, &brand.IdentityStatus, &brand.Vertical, &brand.Website,
			&brand.Country, &brand.State, &brand.City, &brand.Street, &brand.PostalCode,
			&brand.StockExchange, &brand.StockSymbol, &brand.AltBusinessID, &brand.AltBusinessIDType,
			&brand.PrimaryContactName, &brand.PrimaryContactEmail, &brand.PrimaryContactPhone,
			&brand.BusinessContactFirstName, &brand.BusinessContactLastName,
			&brand.BusinessContactEmail, &brand.BusinessContactPhone,
			&brand.Status, &brand.TrustScore, &brand.VettingStatus, &brand.VettingProvider, &brand.VettingClass,
			&brand.VettingDate, &brand.BrandRelationship, &brand.ReferenceID,
			&brand.TCRCreatedAt, &brand.TCRUpdatedAt, &brand.CreatedAt, &brand.UpdatedAt, &brand.CreatedBy, &brand.UpdatedBy,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan brand: %w", err)
		}
		brands = append(brands, brand)
	}

	return brands, total, nil
}

// GetByID retrieves a brand by ID with customer verification
func (r *TCRBrandRepository) GetByID(ctx context.Context, id uuid.UUID, customerFilter []uuid.UUID) (*models.Brand10DLC, error) {
	query := `
		SELECT id, customer_id, tcr_brand_id, display_name, legal_name, company_name,
		       tax_id, entity_type, identity_status, vertical, website,
		       country, state, city, street, postal_code,
		       stock_exchange, stock_symbol, alt_business_id, alt_business_id_type,
		       primary_contact_name, primary_contact_email, primary_contact_phone,
		       business_contact_first_name, business_contact_last_name,
		       business_contact_email, business_contact_phone,
		       status, trust_score, vetting_status, vetting_provider, vetting_class,
		       vetting_date, brand_relationship, reference_id,
		       tcr_created_at, tcr_updated_at, created_at, updated_at, created_by, updated_by
		FROM messaging.brands_10dlc
		WHERE id = $1
	`

	args := []interface{}{id}
	argPos := 2

	// Customer scoping check
	if customerFilter != nil {
		if len(customerFilter) == 0 {
			return nil, fmt.Errorf("access denied")
		}
		query += fmt.Sprintf(" AND customer_id = ANY($%d)", argPos)
		args = append(args, customerFilter)
	}

	brand := &models.Brand10DLC{}
	err := r.db.QueryRow(ctx, query, args...).Scan(
		&brand.ID, &brand.CustomerID, &brand.TCRBrandID, &brand.DisplayName, &brand.LegalName, &brand.CompanyName,
		&brand.TaxID, &brand.EntityType, &brand.IdentityStatus, &brand.Vertical, &brand.Website,
		&brand.Country, &brand.State, &brand.City, &brand.Street, &brand.PostalCode,
		&brand.StockExchange, &brand.StockSymbol, &brand.AltBusinessID, &brand.AltBusinessIDType,
		&brand.PrimaryContactName, &brand.PrimaryContactEmail, &brand.PrimaryContactPhone,
		&brand.BusinessContactFirstName, &brand.BusinessContactLastName,
		&brand.BusinessContactEmail, &brand.BusinessContactPhone,
		&brand.Status, &brand.TrustScore, &brand.VettingStatus, &brand.VettingProvider, &brand.VettingClass,
		&brand.VettingDate, &brand.BrandRelationship, &brand.ReferenceID,
		&brand.TCRCreatedAt, &brand.TCRUpdatedAt, &brand.CreatedAt, &brand.UpdatedAt, &brand.CreatedBy, &brand.UpdatedBy,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get brand: %w", err)
	}

	return brand, nil
}

// Update updates a brand
func (r *TCRBrandRepository) Update(ctx context.Context, id uuid.UUID, req *models.UpdateBrandRequest, updatedBy uuid.UUID) error {
	query := `
		UPDATE messaging.brands_10dlc
		SET display_name = COALESCE($1, display_name),
		    legal_name = COALESCE($2, legal_name),
		    tax_id = COALESCE($3, tax_id),
		    entity_type = COALESCE($4, entity_type),
		    website = COALESCE($5, website),
		    vertical = COALESCE($6, vertical),
		    street = COALESCE($7, street),
		    city = COALESCE($8, city),
		    state = COALESCE($9, state),
		    postal_code = COALESCE($10, postal_code),
		    primary_contact_email = COALESCE($11, primary_contact_email),
		    primary_contact_phone = COALESCE($12, primary_contact_phone),
		    business_contact_first_name = COALESCE($13, business_contact_first_name),
		    business_contact_last_name = COALESCE($14, business_contact_last_name),
		    business_contact_email = COALESCE($15, business_contact_email),
		    business_contact_phone = COALESCE($16, business_contact_phone),
		    stock_symbol = COALESCE($17, stock_symbol),
		    stock_exchange = COALESCE($18, stock_exchange),
		    alt_business_id = COALESCE($19, alt_business_id),
		    alt_business_id_type = COALESCE($20, alt_business_id_type),
		    reference_id = COALESCE($21, reference_id),
		    updated_by = $22,
		    updated_at = NOW()
		WHERE id = $23
	`

	_, err := r.db.Exec(ctx, query,
		req.DisplayName, req.CompanyName, req.TaxID, req.EntityType,
		req.Website, req.Vertical,
		req.Street, req.City, req.State, req.PostalCode,
		req.Email, req.Phone,  // Maps to primary_contact_email/phone
		req.BusinessContactFirstName, req.BusinessContactLastName, req.BusinessContactEmail, req.BusinessContactPhone,
		req.StockSymbol, req.StockExchange,
		req.AltBusinessID, req.AltBusinessIDType, req.ReferenceID,
		updatedBy, id,
	)

	if err != nil {
		return fmt.Errorf("failed to update brand: %w", err)
	}

	return nil
}

// UpdateTCRInfo updates brand with TCR API response
func (r *TCRBrandRepository) UpdateTCRInfo(ctx context.Context, id uuid.UUID, tcrBrandID string, status string, trustScore *int, identityStatus string) error {
	query := `
		UPDATE messaging.brands_10dlc
		SET tcr_brand_id = $1,
		    status = $2,
		    trust_score = $3,
		    identity_status = $4,
		    tcr_updated_at = NOW(),
		    updated_at = NOW()
		WHERE id = $5
	`

	_, err := r.db.Exec(ctx, query, tcrBrandID, status, trustScore, identityStatus, id)
	if err != nil {
		return fmt.Errorf("failed to update TCR info: %w", err)
	}

	return nil
}

// UpdateVettingInfo updates vetting status
func (r *TCRBrandRepository) UpdateVettingInfo(ctx context.Context, id uuid.UUID, provider, vettingClass, status string) error {
	query := `
		UPDATE messaging.brands_10dlc
		SET vetting_provider = $1,
		    vetting_class = $2,
		    vetting_status = $3,
		    vetting_date = NOW(),
		    updated_at = NOW()
		WHERE id = $4
	`

	_, err := r.db.Exec(ctx, query, provider, vettingClass, status, id)
	if err != nil {
		return fmt.Errorf("failed to update vetting info: %w", err)
	}

	return nil
}

// UpdateSyncTimestamp updates the last_synced_at and sync_source for a brand
func (r *TCRBrandRepository) UpdateSyncTimestamp(ctx context.Context, id uuid.UUID, source string) (int64, error) {
	query := `
		UPDATE messaging.brands_10dlc
		SET
			last_synced_at = NOW(),
			sync_source = $2,
			updated_at = NOW()
		WHERE id = $1
	`

	result, err := r.db.Exec(ctx, query, id, source)
	if err != nil {
		return 0, fmt.Errorf("failed to update sync timestamp: %w", err)
	}

	return result.RowsAffected(), nil
}

// Helper functions
func strOrEmpty(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
