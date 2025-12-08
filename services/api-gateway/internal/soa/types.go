package soa

import "time"

// QueryRequest represents a query request using SOA query language
type QueryRequest struct {
	Query         string   `json:"query"`                   // Query string (e.g., "status=available and npa=303")
	Page          int      `json:"page"`                    // Page number (0-indexed)
	Size          int      `json:"size"`                    // Results per page (max 10000)
	SortBy        string   `json:"sortBy,omitempty"`        // Field to sort by
	SortDirection string   `json:"sortDirection,omitempty"` // ASC or DESC
	Fields        []string `json:"fields,omitempty"`        // Optional field selection
}

// QueryResponse represents the response from a query
type QueryResponse struct {
	Content         []NumberInventory `json:"content"`
	TotalElements   int64             `json:"totalElements"`
	TotalPages      int               `json:"totalPages"`
	Page            int               `json:"page"`
	Size            int               `json:"size"`
	First           bool              `json:"first"`
	Last            bool              `json:"last"`
	ExecutionTimeMs int64             `json:"executionTimeMs"`
	ParsedQuery     string            `json:"parsedQuery,omitempty"`
	Fields          []string          `json:"fields,omitempty"`
}

// NumberInventory represents a telephone number from SOA inventory
type NumberInventory struct {
	ID              string `json:"id"`
	TelephoneNumber string `json:"telephoneNumber"`

	// Block Information
	NPA     string `json:"npa,omitempty"`
	NXX     string `json:"nxx,omitempty"`
	BlockID string `json:"blockId,omitempty"`

	// Ownership
	SPID             string `json:"spid"`
	CurrentOwnerSPID string `json:"currentOwnerSpid,omitempty"`
	CustomerID       string `json:"customerId,omitempty"`
	CustomerName     string `json:"customerName,omitempty"`

	// Number State
	Status         NumberStatus `json:"status"`
	LifecycleState string       `json:"lifecycleState,omitempty"`

	// LERG/LSMS Data
	CurrentLRN string `json:"currentLrn,omitempty"`
	CurrentOCN string `json:"currentOcn,omitempty"`
	NPACRegion string `json:"npacRegion,omitempty"`

	// Geographic Location
	LATA     int    `json:"lata,omitempty"`
	LATAName string `json:"lataName,omitempty"`
	State    string `json:"state,omitempty"`
	Locality string `json:"locality,omitempty"`

	// Network Routing Details
	SwitchCLLI    string `json:"switchClli,omitempty"`
	TandemSwitch  string `json:"tandemSwitch,omitempty"`
	TandemOCN     string `json:"tandemOcn,omitempty"`
	TandemOCNName string `json:"tandemOcnName,omitempty"`
	OCNName       string `json:"ocnName,omitempty"`
	COCType       string `json:"cocType,omitempty"`

	// Port Tracking
	LastPortDate  *time.Time    `json:"lastPortDate,omitempty"`
	PortDirection PortDirection `json:"portDirection,omitempty"`
	OriginalSPID  string        `json:"originalSpid,omitempty"`

	// Application Metadata
	ApplicationID       string                 `json:"applicationId,omitempty"`
	ApplicationMetadata map[string]interface{} `json:"applicationMetadata,omitempty"`
	ReservedUntil       *time.Time             `json:"reservedUntil,omitempty"`
	ReservedBy          string                 `json:"reservedBy,omitempty"`

	// Assignment tracking
	FirstAssignedAt *time.Time `json:"firstAssignedAt,omitempty"`
	LastAssignedAt  *time.Time `json:"lastAssignedAt,omitempty"`
	TimesAssigned   int        `json:"timesAssigned,omitempty"`

	// Audit Tracking
	LastLRNDipAt     *time.Time    `json:"lastLrnDipAt,omitempty"`
	LastLRNDipResult LRNDipResult  `json:"lastLrnDipResult,omitempty"`
	DiscoveredVia    DiscoveryType `json:"discoveredVia,omitempty"`

	// Timestamps
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
	LastVerifiedAt *time.Time `json:"lastVerifiedAt,omitempty"`
}

// AssignRequest represents a request to assign a number
type AssignRequest struct {
	ApplicationID string                 `json:"applicationId"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// InventorySummary represents aggregate statistics for a SPID's inventory
type InventorySummary struct {
	SPID           string `json:"spid"`
	TotalNumbers   int64  `json:"totalNumbers"`
	AvailableCount int64  `json:"availableCount"`
	ReservedCount  int64  `json:"reservedCount"`
	InUseCount     int64  `json:"inUseCount"`
	PortedOutCount int64  `json:"portedOutCount"`
	PortedInCount  int64  `json:"portedInCount"`
	QuarantineCount int64 `json:"quarantineCount"`
	TotalBlocks    int    `json:"totalBlocks"`
}

// NumberStatus represents the status of a telephone number
type NumberStatus string

const (
	StatusAvailable  NumberStatus = "AVAILABLE"
	StatusReserved   NumberStatus = "RESERVED"
	StatusInUse      NumberStatus = "IN_USE"
	StatusPortedOut  NumberStatus = "PORTED_OUT"
	StatusQuarantine NumberStatus = "QUARANTINE"
)

// PortDirection indicates whether a number was ported in or out
type PortDirection string

const (
	PortDirectionIn  PortDirection = "IN"
	PortDirectionOut PortDirection = "OUT"
)

// LRNDipResult represents the result of an LRN dip
type LRNDipResult string

const (
	LRNDipNeverPorted LRNDipResult = "NEVER_PORTED"
	LRNDipPortedOut   LRNDipResult = "PORTED_OUT"
	LRNDipPortedBack  LRNDipResult = "PORTED_BACK"
)

// DiscoveryType indicates how a number was discovered
type DiscoveryType string

const (
	DiscoveryLERG   DiscoveryType = "LERG"
	DiscoveryLSMS   DiscoveryType = "LSMS"
	DiscoveryManual DiscoveryType = "MANUAL"
)

// NumberType represents the type of telephone number
type NumberType string

const (
	NumberTypeDID      NumberType = "DID"
	NumberTypeTollFree NumberType = "TOLL_FREE"
)
