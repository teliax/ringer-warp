package models

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

// TrunkGroup represents a customer's SIP trunk configuration
type TrunkGroup struct {
	ID                     uuid.UUID  `json:"id" db:"id"`
	CustomerID             uuid.UUID  `json:"customer_id" db:"customer_id"`
	Name                   string     `json:"name" db:"name"`
	Description            string     `json:"description" db:"description"`
	AuthType               string     `json:"auth_type" db:"auth_type"` // IP_ACL, DIGEST, BOTH
	CapacityCPS            int        `json:"capacity_cps" db:"capacity_cps"`
	CapacityConcurrentCalls int       `json:"capacity_concurrent_calls" db:"capacity_concurrent_calls"`
	Enabled                bool       `json:"enabled" db:"enabled"`
	CreatedAt              time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at" db:"updated_at"`
	CreatedBy              *uuid.UUID `json:"created_by,omitempty" db:"created_by"`
}

// TrunkIP represents an IP ACL entry for a trunk group
type TrunkIP struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	TrunkGroupID  uuid.UUID  `json:"trunk_group_id" db:"trunk_group_id"`
	IPAddress     string     `json:"ip_address" db:"ip_address"` // INET type from PostgreSQL
	Netmask       int        `json:"netmask" db:"netmask"`
	Description   string     `json:"description" db:"description"`
	Enabled       bool       `json:"enabled" db:"enabled"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
	CreatedBy     *uuid.UUID `json:"created_by,omitempty" db:"created_by"`
}

// CustomerDedicatedIP represents a premium tier dedicated LoadBalancer IP
type CustomerDedicatedIP struct {
	ID                  uuid.UUID      `json:"id" db:"id"`
	CustomerID          uuid.UUID      `json:"customer_id" db:"customer_id"`
	IPAddress           string         `json:"ip_address" db:"ip_address"`
	Region              string         `json:"region" db:"region"`
	GCPAddressName      sql.NullString `json:"gcp_address_name,omitempty" db:"gcp_address_name"`
	GCPLoadBalancerName sql.NullString `json:"gcp_loadbalancer_name,omitempty" db:"gcp_loadbalancer_name"`
	Status              string         `json:"status" db:"status"` // PROVISIONING, ACTIVE, DEPROVISIONING, DELETED
	Enabled             bool           `json:"enabled" db:"enabled"`
	CreatedAt           time.Time      `json:"created_at" db:"created_at"`
	DeprovisionedAt     sql.NullTime   `json:"deprovisioned_at,omitempty" db:"deprovisioned_at"`
}

// TrunkGroupWithIPs represents a trunk group with its IP ACL entries
type TrunkGroupWithIPs struct {
	TrunkGroup
	IPs []TrunkIP `json:"ips"`
}

// CreateTrunkGroupRequest represents the request to create a new trunk group
type CreateTrunkGroupRequest struct {
	Name                   string `json:"name" binding:"required,min=3,max=100"`
	Description            string `json:"description"`
	AuthType               string `json:"auth_type" binding:"required,oneof=IP_ACL DIGEST BOTH"`
	CapacityCPS            int    `json:"capacity_cps" binding:"required,min=1,max=10000"`
	CapacityConcurrentCalls int   `json:"capacity_concurrent_calls" binding:"required,min=1,max=100000"`
}

// UpdateTrunkGroupRequest represents the request to update a trunk group
type UpdateTrunkGroupRequest struct {
	Name                   *string `json:"name,omitempty" binding:"omitempty,min=3,max=100"`
	Description            *string `json:"description,omitempty"`
	AuthType               *string `json:"auth_type,omitempty" binding:"omitempty,oneof=IP_ACL DIGEST BOTH"`
	CapacityCPS            *int    `json:"capacity_cps,omitempty" binding:"omitempty,min=1,max=10000"`
	CapacityConcurrentCalls *int   `json:"capacity_concurrent_calls,omitempty" binding:"omitempty,min=1,max=100000"`
	Enabled                *bool   `json:"enabled,omitempty"`
}

// AddTrunkIPRequest represents the request to add an IP to a trunk's ACL
type AddTrunkIPRequest struct {
	IPAddress   string  `json:"ip_address" binding:"required,ip"`
	Netmask     *int    `json:"netmask,omitempty" binding:"omitempty,min=0,max=32"`
	Description string  `json:"description"`
}

// UpdateTrunkIPRequest represents the request to update a trunk IP entry
type UpdateTrunkIPRequest struct {
	Description *string `json:"description,omitempty"`
	Enabled     *bool   `json:"enabled,omitempty"`
}

// TrunkIPListResponse represents a list of trunk IPs with customer context
type TrunkIPListResponse struct {
	TrunkGroupID uuid.UUID  `json:"trunk_group_id"`
	TrunkName    string     `json:"trunk_name"`
	IPs          []TrunkIP  `json:"ips"`
}

// VendorOriginationIPsResponse provides vendor egress IPs for customer documentation
type VendorOriginationIPsResponse struct {
	Region string   `json:"region"`
	IPs    []string `json:"ips"`
	Note   string   `json:"note"`
}
