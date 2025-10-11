package models

// APIResponse is the standard API response wrapper
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *APIError   `json:"error,omitempty"`
	Meta    *Meta       `json:"meta,omitempty"`
}

// APIError represents an error response
type APIError struct {
	Code    string                 `json:"code"`
	Message string                 `json:"message"`
	Details map[string]interface{} `json:"details,omitempty"`
}

// Meta contains pagination and other metadata
type Meta struct {
	Page       int `json:"page,omitempty"`
	PerPage    int `json:"per_page,omitempty"`
	Total      int `json:"total,omitempty"`
	TotalPages int `json:"total_pages,omitempty"`
}

// ListResponse for paginated lists
type ListResponse struct {
	Items      interface{} `json:"items"`
	Pagination *Meta       `json:"pagination,omitempty"`
}

// NewSuccessResponse creates a success response
func NewSuccessResponse(data interface{}) *APIResponse {
	return &APIResponse{
		Success: true,
		Data:    data,
	}
}

// NewErrorResponse creates an error response
func NewErrorResponse(code, message string) *APIResponse {
	return &APIResponse{
		Success: false,
		Error: &APIError{
			Code:    code,
			Message: message,
		},
	}
}

// NewListResponse creates a paginated list response
func NewListResponse(items interface{}, page, perPage, total int) *APIResponse {
	totalPages := (total + perPage - 1) / perPage

	return &APIResponse{
		Success: true,
		Data: &ListResponse{
			Items: items,
			Pagination: &Meta{
				Page:       page,
				PerPage:    perPage,
				Total:      total,
				TotalPages: totalPages,
			},
		},
	}
}
