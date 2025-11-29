package hubspot

import (
	"strings"

	"github.com/ringer-warp/api-gateway/internal/models"
)

// FieldMapper handles mapping between WARP fields and HubSpot properties
type FieldMapper struct {
	config *SyncConfig
}

// NewFieldMapper creates a new field mapper with configuration
func NewFieldMapper(config *SyncConfig) *FieldMapper {
	return &FieldMapper{
		config: config,
	}
}

// MapWARPToHubSpot converts WARP customer to HubSpot properties
func (fm *FieldMapper) MapWARPToHubSpot(customer *models.Customer) (map[string]interface{}, []string) {
	properties := make(map[string]interface{})
	syncedFields := []string{}

	for fieldName, mapping := range fm.config.FieldMappings {
		// Only sync if direction allows WARP → HubSpot
		if mapping.SyncDirection != SyncDirectionWarpToHubSpot &&
			mapping.SyncDirection != SyncDirectionBidirectional {
			continue
		}

		value := fm.extractWARPValue(customer, mapping)
		if value != nil {
			properties[mapping.HubSpotProperty] = value
			syncedFields = append(syncedFields, fieldName)
		}
	}

	return properties, syncedFields
}

// MapHubSpotToWARP converts HubSpot properties to WARP update request
func (fm *FieldMapper) MapHubSpotToWARP(hubspotProps map[string]interface{}) (*models.UpdateCustomerRequest, []string) {
	req := &models.UpdateCustomerRequest{}
	syncedFields := []string{}

	for fieldName, mapping := range fm.config.FieldMappings {
		// Only sync if direction allows HubSpot → WARP
		if mapping.SyncDirection != SyncDirectionHubSpotToWarp &&
			mapping.SyncDirection != SyncDirectionBidirectional {
			continue
		}

		value, exists := hubspotProps[mapping.HubSpotProperty]
		if !exists {
			continue
		}

		fm.applyWARPValue(req, mapping, value)
		syncedFields = append(syncedFields, fieldName)
	}

	return req, syncedFields
}

// extractWARPValue extracts a value from WARP customer based on field mapping
func (fm *FieldMapper) extractWARPValue(customer *models.Customer, mapping FieldMapping) interface{} {
	switch mapping.WarpField {
	case "ban":
		return customer.BAN
	case "company_name":
		return customer.CompanyName
	case "legal_name":
		if customer.LegalName != nil {
			return *customer.LegalName
		}
		return nil
	case "status":
		return customer.Status
	case "customer_type":
		return customer.CustomerType
	case "credit_limit":
		if customer.CreditLimit != nil {
			return *customer.CreditLimit
		}
		return nil
	case "current_balance":
		return customer.CurrentBalance
	case "prepaid_balance":
		return customer.PrepaidBalance
	case "payment_terms":
		return customer.PaymentTerms
	case "billing_cycle":
		return customer.BillingCycle

	// JSONB fields with path
	case "contact":
		return fm.extractJSONBValue(customer.Contact, mapping.WarpFieldPath)
	case "address":
		return fm.extractJSONBValue(customer.Address, mapping.WarpFieldPath)
	case "services":
		return fm.extractJSONBValue(customer.Services, mapping.WarpFieldPath)
	case "external_ids":
		return fm.extractJSONBValue(customer.ExternalIDs, mapping.WarpFieldPath)

	default:
		return nil
	}
}

// extractJSONBValue extracts a value from JSONB using path like "contact->>'email'"
func (fm *FieldMapper) extractJSONBValue(jsonbData map[string]interface{}, path string) interface{} {
	if path == "" || jsonbData == nil {
		return nil
	}

	// Parse path like "contact->>'email'" to get "email"
	// For simplicity, handle common patterns
	if strings.Contains(path, "->>") {
		parts := strings.Split(path, "->>")
		if len(parts) == 2 {
			key := strings.Trim(parts[1], "'\"")
			return jsonbData[key]
		}
	}

	// Direct key access
	if val, ok := jsonbData[path]; ok {
		return val
	}

	return nil
}

// applyWARPValue applies a HubSpot value to WARP update request
func (fm *FieldMapper) applyWARPValue(req *models.UpdateCustomerRequest, mapping FieldMapping, value interface{}) {
	switch mapping.WarpField {
	case "company_name":
		if str, ok := value.(string); ok {
			req.CompanyName = &str
		}
	case "legal_name":
		if str, ok := value.(string); ok {
			req.LegalName = &str
		}
	case "status":
		if str, ok := value.(string); ok {
			req.Status = &str
		}
	case "credit_limit":
		if num, ok := value.(float64); ok {
			req.CreditLimit = &num
		}
	case "payment_terms":
		if num, ok := value.(float64); ok {
			intVal := int(num)
			req.PaymentTerms = &intVal
		}
	case "billing_cycle":
		if str, ok := value.(string); ok {
			req.BillingCycle = &str
		}

	// JSONB fields
	case "contact":
		if req.Contact == nil {
			req.Contact = make(map[string]interface{})
		}
		fm.applyJSONBValue(req.Contact, mapping.WarpFieldPath, value)

	case "address":
		if req.Address == nil {
			req.Address = make(map[string]interface{})
		}
		fm.applyJSONBValue(req.Address, mapping.WarpFieldPath, value)

	case "services":
		if req.Services == nil {
			req.Services = make(map[string]interface{})
		}
		fm.applyJSONBValue(req.Services, mapping.WarpFieldPath, value)
	}
}

// applyJSONBValue sets a value in JSONB map using path
func (fm *FieldMapper) applyJSONBValue(jsonbMap map[string]interface{}, path string, value interface{}) {
	if path == "" {
		return
	}

	// Parse path like "contact->>'email'" to get "email"
	if strings.Contains(path, "->>") {
		parts := strings.Split(path, "->>")
		if len(parts) == 2 {
			key := strings.Trim(parts[1], "'\"")
			jsonbMap[key] = value
		}
	} else {
		// Direct key
		jsonbMap[path] = value
	}
}

// GetMappingForField returns the field mapping for a given field name
func (fm *FieldMapper) GetMappingForField(fieldName string) (FieldMapping, bool) {
	mapping, exists := fm.config.FieldMappings[fieldName]
	return mapping, exists
}

// GetMappingForHubSpotProperty returns the field mapping for a HubSpot property
func (fm *FieldMapper) GetMappingForHubSpotProperty(propertyName string) (FieldMapping, string, bool) {
	for fieldName, mapping := range fm.config.FieldMappings {
		if mapping.HubSpotProperty == propertyName {
			return mapping, fieldName, true
		}
	}
	return FieldMapping{}, "", false
}

// GetSyncDirection returns the sync direction for a field
func (fm *FieldMapper) GetSyncDirection(fieldName string) SyncDirection {
	if mapping, exists := fm.config.FieldMappings[fieldName]; exists {
		return mapping.SyncDirection
	}
	return SyncDirectionNone
}

// ShouldSyncToHubSpot checks if a field should be synced to HubSpot
func (fm *FieldMapper) ShouldSyncToHubSpot(fieldName string) bool {
	direction := fm.GetSyncDirection(fieldName)
	return direction == SyncDirectionWarpToHubSpot || direction == SyncDirectionBidirectional
}

// ShouldSyncFromHubSpot checks if a field should be synced from HubSpot
func (fm *FieldMapper) ShouldSyncFromHubSpot(fieldName string) bool {
	direction := fm.GetSyncDirection(fieldName)
	return direction == SyncDirectionHubSpotToWarp || direction == SyncDirectionBidirectional
}
