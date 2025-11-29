package hubspot

import "fmt"

// SyncResult contains detailed information about a sync operation
type SyncResult struct {
	Success          bool                   `json:"success"`
	HubSpotCompanyID string                 `json:"hubspot_company_id"`
	FieldsSynced     []string               `json:"fields_synced"`
	FieldsFailed     []FieldError           `json:"fields_failed,omitempty"`
	SyncLogID        string                 `json:"sync_log_id"`
	Message          string                 `json:"message"`
}

// FieldError represents a field-level sync error
type FieldError struct {
	FieldName        string `json:"field_name"`
	HubSpotProperty  string `json:"hubspot_property"`
	ErrorMessage     string `json:"error_message"`
	Value            interface{} `json:"value,omitempty"`
}

// NewSyncError creates a detailed sync error
func NewSyncError(failedFields []FieldError, message string) *SyncError {
	return &SyncError{
		FailedFields: failedFields,
		Message:      message,
	}
}

// SyncError represents a sync operation error with field details
type SyncError struct {
	FailedFields []FieldError
	Message      string
}

func (e *SyncError) Error() string {
	if len(e.FailedFields) == 0 {
		return e.Message
	}

	fieldNames := make([]string, len(e.FailedFields))
	for i, f := range e.FailedFields {
		fieldNames[i] = f.FieldName
	}

	return fmt.Sprintf("%s (failed fields: %v)", e.Message, fieldNames)
}
