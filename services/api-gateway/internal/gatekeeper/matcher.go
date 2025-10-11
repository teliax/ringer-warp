package gatekeeper

import "strings"

// MatchesPermission checks if a resource path matches a permission pattern
//
// Supported patterns:
//   - Exact match: "/api/v1/customers" matches "/api/v1/customers"
//   - Wildcard suffix: "/api/v1/customers/*" matches "/api/v1/customers/abc" and "/api/v1/customers/abc/trunks"
//   - Global wildcard: "*" matches everything
//
// Examples:
//   MatchesPermission("/api/v1/customers", "/api/v1/customers")                    → true
//   MatchesPermission("/api/v1/customers/*", "/api/v1/customers/123")              → true
//   MatchesPermission("/api/v1/customers/*", "/api/v1/customers/123/trunks")       → true
//   MatchesPermission("/api/v1/customers/*", "/api/v1/vendors")                    → false
//   MatchesPermission("*", "/anything")                                             → true
func MatchesPermission(permissionPattern, resourcePath string) bool {
	// Global wildcard (SuperAdmin)
	if permissionPattern == "*" {
		return true
	}

	// Exact match
	if permissionPattern == resourcePath {
		return true
	}

	// Wildcard suffix match: /api/v1/customers/* matches /api/v1/customers/anything
	if strings.HasSuffix(permissionPattern, "/*") {
		prefix := strings.TrimSuffix(permissionPattern, "*")
		return strings.HasPrefix(resourcePath, prefix)
	}

	// Wildcard at end without slash: /api/v1/customers* matches /api/v1/customers-special
	if strings.HasSuffix(permissionPattern, "*") {
		prefix := strings.TrimSuffix(permissionPattern, "*")
		return strings.HasPrefix(resourcePath, prefix)
	}

	return false
}

// HasWildcardPermission checks if a permission list contains wildcard
func HasWildcardPermission(permissions []string) bool {
	for _, perm := range permissions {
		if perm == "*" {
			return true
		}
	}
	return false
}

// FilterPermissions returns only permissions that match a given resource path
func FilterPermissions(permissions []string, resourcePath string) []string {
	matched := []string{}
	for _, perm := range permissions {
		if MatchesPermission(perm, resourcePath) {
			matched = append(matched, perm)
		}
	}
	return matched
}
