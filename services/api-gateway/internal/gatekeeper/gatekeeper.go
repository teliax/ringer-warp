package gatekeeper

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	log "go.uber.org/zap"
)

// Gatekeeper handles permission checking and access control
type Gatekeeper struct {
	PermRepo *PermissionRepository // Exported for access in handlers
	logger   *log.Logger
}

// NewGatekeeper creates a new gatekeeper service
func NewGatekeeper(permRepo *PermissionRepository, logger *log.Logger) *Gatekeeper {
	return &Gatekeeper{
		PermRepo: permRepo,
		logger:   logger,
	}
}

// AccessCheckResult represents the result of an access check
type AccessCheckResult struct {
	Allowed             bool
	UserType            string
	AccessibleCustomers []uuid.UUID // nil = all customers (SuperAdmin)
	HasWildcard         bool
	Reason              string
}

// CheckAccess determines if a user can access a resource
func (g *Gatekeeper) CheckAccess(
	ctx context.Context,
	userID uuid.UUID,
	userTypeID uuid.UUID,
	resourcePath string,
) (*AccessCheckResult, error) {
	// Get user type name for logging/response
	userTypeName, err := g.PermRepo.GetUserTypeName(ctx, userTypeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user type: %w", err)
	}

	// Check for wildcard permission first (SuperAdmin)
	hasWildcard, err := g.PermRepo.CheckHasWildcardPermission(ctx, userTypeID)
	if err != nil {
		return nil, fmt.Errorf("failed to check wildcard: %w", err)
	}

	if hasWildcard {
		g.logger.Debug("Access granted - wildcard permission",
			log.String("user_id", userID.String()),
			log.String("user_type", userTypeName),
			log.String("resource", resourcePath),
		)

		return &AccessCheckResult{
			Allowed:             true,
			UserType:            userTypeName,
			AccessibleCustomers: nil, // nil = all customers
			HasWildcard:         true,
			Reason:              "Wildcard permission",
		}, nil
	}

	// Get user type permissions
	permissions, err := g.PermRepo.GetUserTypePermissions(ctx, userTypeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get permissions: %w", err)
	}

	// Check if resource path matches any permission
	allowed := false
	matchedPermission := ""
	for _, perm := range permissions {
		if MatchesPermission(perm, resourcePath) {
			allowed = true
			matchedPermission = perm
			break
		}
	}

	if !allowed {
		g.logger.Info("Access denied - no matching permission",
			log.String("user_id", userID.String()),
			log.String("user_type", userTypeName),
			log.String("resource", resourcePath),
		)

		return &AccessCheckResult{
			Allowed: false,
			UserType: userTypeName,
			Reason:   "No matching permission",
		}, nil
	}

	// Get accessible customers for data filtering
	customerIDs, err := g.PermRepo.GetUserAccessibleCustomers(ctx, userID, userTypeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get customer access: %w", err)
	}

	g.logger.Debug("Access granted - permission matched",
		log.String("user_id", userID.String()),
		log.String("user_type", userTypeName),
		log.String("resource", resourcePath),
		log.String("matched_permission", matchedPermission),
		log.Int("accessible_customers", len(customerIDs)),
	)

	return &AccessCheckResult{
		Allowed:             true,
		UserType:            userTypeName,
		AccessibleCustomers: customerIDs,
		HasWildcard:         false,
		Reason:              fmt.Sprintf("Matched permission: %s", matchedPermission),
	}, nil
}

// CheckAccessBatch checks multiple resources at once
func (g *Gatekeeper) CheckAccessBatch(
	ctx context.Context,
	userID uuid.UUID,
	userTypeID uuid.UUID,
	resourcePaths []string,
) (map[string]bool, error) {
	// Get permissions once
	permissions, err := g.PermRepo.GetUserTypePermissions(ctx, userTypeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get permissions: %w", err)
	}

	// Check if has wildcard
	hasWildcard := HasWildcardPermission(permissions)

	// Check each resource
	results := make(map[string]bool)
	for _, resourcePath := range resourcePaths {
		if hasWildcard {
			results[resourcePath] = true
			continue
		}

		// Check if any permission matches
		allowed := false
		for _, perm := range permissions {
			if MatchesPermission(perm, resourcePath) {
				allowed = true
				break
			}
		}
		results[resourcePath] = allowed
	}

	return results, nil
}

// GetUserPermissions returns complete permission information for a user
func (g *Gatekeeper) GetUserPermissions(ctx context.Context, userID uuid.UUID, userTypeID uuid.UUID) (*UserPermissionInfo, error) {
	// Get user type name
	userTypeName, err := g.PermRepo.GetUserTypeName(ctx, userTypeID)
	if err != nil {
		return nil, err
	}

	// Get permissions
	permissions, err := g.PermRepo.GetUserTypePermissions(ctx, userTypeID)
	if err != nil {
		return nil, err
	}

	// Check wildcard
	hasWildcard := HasWildcardPermission(permissions)

	// Get customer access (unless wildcard)
	var customerIDs []uuid.UUID
	if !hasWildcard {
		customerIDs, err = g.PermRepo.GetUserAccessibleCustomers(ctx, userID, userTypeID)
		if err != nil {
			return nil, err
		}
	}

	return &UserPermissionInfo{
		UserID:              userID,
		UserType:            userTypeName,
		Permissions:         permissions,
		HasWildcard:         hasWildcard,
		AccessibleCustomers: customerIDs,
	}, nil
}

// UserPermissionInfo contains complete permission information for a user
type UserPermissionInfo struct {
	UserID              uuid.UUID
	UserType            string
	Permissions         []string
	HasWildcard         bool
	AccessibleCustomers []uuid.UUID // nil = all customers
}
