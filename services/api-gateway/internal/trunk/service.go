package trunk

import (
	"context"
	"fmt"

	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/ringer-warp/api-gateway/internal/repository"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type Service struct {
	repo        *repository.TrunkRepository
	customerRepo *repository.CustomerRepository
	redisClient *redis.Client
}

func NewService(
	repo *repository.TrunkRepository,
	customerRepo *repository.CustomerRepository,
	redisClient *redis.Client,
) *Service {
	return &Service{
		repo:        repo,
		customerRepo: customerRepo,
		redisClient: redisClient,
	}
}

// ============================================================================
// Trunk Group Operations
// ============================================================================

// CreateTrunkGroup creates a new trunk group and initializes Redis cache
func (s *Service) CreateTrunkGroup(ctx context.Context, customerID uuid.UUID, req models.CreateTrunkGroupRequest, createdBy uuid.UUID) (*models.TrunkGroup, error) {
	// Verify customer exists and is active
	customer, err := s.customerRepo.GetByID(ctx, customerID)
	if err != nil {
		return nil, fmt.Errorf("customer not found: %w", err)
	}

	if customer.Status != "active" {
		return nil, fmt.Errorf("customer is not active: %s", customer.Status)
	}

	// Create trunk group
	trunk, err := s.repo.CreateTrunkGroup(ctx, customerID, req, createdBy)
	if err != nil {
		return nil, err
	}

	return trunk, nil
}

// ListTrunkGroups retrieves all trunk groups for a customer with IP counts
func (s *Service) ListTrunkGroups(ctx context.Context, customerID uuid.UUID) ([]models.TrunkGroupWithIPs, error) {
	return s.repo.ListTrunkGroupsWithIPsByCustomer(ctx, customerID)
}

// GetTrunkGroup retrieves a trunk group by ID with access verification
func (s *Service) GetTrunkGroup(ctx context.Context, trunkID uuid.UUID, customerID uuid.UUID) (*models.TrunkGroupWithIPs, error) {
	// Verify access
	hasAccess, err := s.repo.VerifyTrunkAccess(ctx, trunkID, customerID)
	if err != nil {
		return nil, err
	}
	if !hasAccess {
		return nil, fmt.Errorf("access denied to trunk group")
	}

	return s.repo.GetTrunkGroupWithIPs(ctx, trunkID)
}

// UpdateTrunkGroup updates a trunk group with access verification
func (s *Service) UpdateTrunkGroup(ctx context.Context, trunkID uuid.UUID, customerID uuid.UUID, req models.UpdateTrunkGroupRequest) error {
	// Verify access
	hasAccess, err := s.repo.VerifyTrunkAccess(ctx, trunkID, customerID)
	if err != nil {
		return err
	}
	if !hasAccess {
		return fmt.Errorf("access denied to trunk group")
	}

	return s.repo.UpdateTrunkGroup(ctx, trunkID, req)
}

// DeleteTrunkGroup deletes a trunk group and cleans up Redis entries
func (s *Service) DeleteTrunkGroup(ctx context.Context, trunkID uuid.UUID, customerID uuid.UUID) error {
	// Verify access
	hasAccess, err := s.repo.VerifyTrunkAccess(ctx, trunkID, customerID)
	if err != nil {
		return err
	}
	if !hasAccess {
		return fmt.Errorf("access denied to trunk group")
	}

	// Get all IPs for this trunk to clean up Redis
	ips, err := s.repo.ListTrunkIPs(ctx, trunkID)
	if err != nil {
		return err
	}

	// Delete trunk group (cascades to trunk_ips)
	err = s.repo.DeleteTrunkGroup(ctx, trunkID)
	if err != nil {
		return err
	}

	// Clean up Redis entries for all IPs
	for _, ip := range ips {
		if err := s.removeIPFromRedis(ctx, ip.ID); err != nil {
			// Log error but don't fail the delete
			fmt.Printf("Warning: failed to remove IP %s from Redis: %v\n", ip.IPAddress, err)
		}
	}

	return nil
}

// ============================================================================
// Trunk IP Operations
// ============================================================================

// AddTrunkIP adds an IP to a trunk's ACL and syncs to Redis
func (s *Service) AddTrunkIP(ctx context.Context, trunkID uuid.UUID, customerID uuid.UUID, req models.AddTrunkIPRequest, createdBy uuid.UUID) (*models.TrunkIP, error) {
	// Verify trunk access
	hasAccess, err := s.repo.VerifyTrunkAccess(ctx, trunkID, customerID)
	if err != nil {
		return nil, err
	}
	if !hasAccess {
		return nil, fmt.Errorf("access denied to trunk group")
	}

	// Get customer to fetch BAN for tag
	customer, err := s.customerRepo.GetByID(ctx, customerID)
	if err != nil {
		return nil, err
	}

	// Add IP to database
	ip, err := s.repo.AddTrunkIP(ctx, trunkID, req, createdBy)
	if err != nil {
		return nil, err
	}

	// Sync to Redis for Kamailio permissions module
	if err := s.syncIPToRedis(ctx, *ip, customer.BAN); err != nil {
		// Log error but don't fail the add (can sync later)
		fmt.Printf("Warning: failed to sync IP to Redis: %v\n", err)
	}

	return ip, nil
}

// ListTrunkIPs lists all IPs for a trunk with access verification
func (s *Service) ListTrunkIPs(ctx context.Context, trunkID uuid.UUID, customerID uuid.UUID) ([]models.TrunkIP, error) {
	// Verify access
	hasAccess, err := s.repo.VerifyTrunkAccess(ctx, trunkID, customerID)
	if err != nil {
		return nil, err
	}
	if !hasAccess {
		return nil, fmt.Errorf("access denied to trunk group")
	}

	return s.repo.ListTrunkIPs(ctx, trunkID)
}

// UpdateTrunkIP updates a trunk IP entry and syncs to Redis
func (s *Service) UpdateTrunkIP(ctx context.Context, ipID uuid.UUID, customerID uuid.UUID, req models.UpdateTrunkIPRequest) error {
	// Verify access
	hasAccess, err := s.repo.VerifyTrunkIPAccess(ctx, ipID, customerID)
	if err != nil {
		return err
	}
	if !hasAccess {
		return fmt.Errorf("access denied to trunk IP")
	}

	// Update in database
	err = s.repo.UpdateTrunkIP(ctx, ipID, req)
	if err != nil {
		return err
	}

	// If enabled status changed, update Redis
	if req.Enabled != nil {
		ip, err := s.repo.GetTrunkIP(ctx, ipID)
		if err != nil {
			return err
		}

		// Get customer BAN for tag
		trunk, err := s.repo.GetTrunkGroup(ctx, ip.TrunkGroupID)
		if err != nil {
			return err
		}

		customer, err := s.customerRepo.GetByID(ctx, trunk.CustomerID)
		if err != nil {
			return err
		}

		if *req.Enabled {
			// Add to Redis
			if err := s.syncIPToRedis(ctx, *ip, customer.BAN); err != nil {
				fmt.Printf("Warning: failed to add IP to Redis: %v\n", err)
			}
		} else {
			// Remove from Redis
			if err := s.removeIPFromRedis(ctx, ip.ID); err != nil {
				fmt.Printf("Warning: failed to remove IP from Redis: %v\n", err)
			}
		}
	}

	return nil
}

// DeleteTrunkIP deletes a trunk IP and removes from Redis
func (s *Service) DeleteTrunkIP(ctx context.Context, ipID uuid.UUID, customerID uuid.UUID) error {
	// Verify access
	hasAccess, err := s.repo.VerifyTrunkIPAccess(ctx, ipID, customerID)
	if err != nil {
		return err
	}
	if !hasAccess {
		return fmt.Errorf("access denied to trunk IP")
	}

	// Delete from database
	err = s.repo.DeleteTrunkIP(ctx, ipID)
	if err != nil {
		return err
	}

	// Remove from Redis
	if err := s.removeIPFromRedis(ctx, ipID); err != nil {
		// Log error but don't fail the delete
		fmt.Printf("Warning: failed to remove IP from Redis: %v\n", err)
	}

	return nil
}

// ============================================================================
// Redis Synchronization
// ============================================================================

// syncIPToRedis syncs a trunk IP to Redis for Kamailio permissions module
// Redis key format: address:entry:{id}
// Hash fields: {grp: "100", ip_addr: "1.2.3.4", mask: "32", port: "5060", proto: "any", tag: "AC-12345"}
func (s *Service) syncIPToRedis(ctx context.Context, ip models.TrunkIP, customerBAN string) error {
	if !ip.Enabled {
		return nil // Don't sync disabled IPs
	}

	redisKey := fmt.Sprintf("address:entry:%s", ip.ID.String())

	// Kamailio permissions module expects these exact field names
	data := map[string]interface{}{
		"grp":      "100",                 // Group 100 = customer trunks
		"ip_addr":  ip.IPAddress,
		"mask":     fmt.Sprintf("%d", ip.Netmask),
		"port":     "5060",                // SIP port
		"proto":    "any",                 // Match any protocol (UDP/TCP)
		"pattern":  "",                    // Not used
		"context_info": "",                // Not used
		"tag":      customerBAN,           // Customer BAN (returned in $avp(peer_tag))
	}

	// Store as Redis hash
	err := s.redisClient.HSet(ctx, redisKey, data).Err()
	if err != nil {
		return fmt.Errorf("failed to sync IP to Redis: %w", err)
	}

	// Also add to sorted set for efficient lookups
	// This allows Kamailio to quickly enumerate all addresses in group 100
	grpKey := "address:group:100"
	err = s.redisClient.SAdd(ctx, grpKey, redisKey).Err()
	if err != nil {
		return fmt.Errorf("failed to add to group set: %w", err)
	}

	return nil
}

// removeIPFromRedis removes a trunk IP from Redis
func (s *Service) removeIPFromRedis(ctx context.Context, ipID uuid.UUID) error {
	redisKey := fmt.Sprintf("address:entry:%s", ipID.String())

	// Remove from group set
	grpKey := "address:group:100"
	s.redisClient.SRem(ctx, grpKey, redisKey)

	// Delete the hash
	err := s.redisClient.Del(ctx, redisKey).Err()
	if err != nil {
		return fmt.Errorf("failed to remove IP from Redis: %w", err)
	}

	return nil
}

// SyncAllTrunkIPsToRedis syncs all enabled trunk IPs to Redis (for initialization or repair)
func (s *Service) SyncAllTrunkIPsToRedis(ctx context.Context) error {
	// This would query all trunk_ips and sync to Redis
	// Useful for:
	// 1. Initial deployment
	// 2. Redis cache rebuild after failure
	// 3. Data reconciliation

	// Get all customers (SuperAdmin access for sync - no customer filter)
	customers, _, err := s.customerRepo.List(ctx, nil, "", "", 1, 1000) // Get first 1000 customers
	if err != nil {
		return fmt.Errorf("failed to list customers: %w", err)
	}

	synced := 0
	failed := 0

	for _, customer := range customers {
		// Get all trunk groups for this customer
		trunks, err := s.repo.ListTrunkGroupsWithIPsByCustomer(ctx, customer.ID)
		if err != nil {
			fmt.Printf("Warning: failed to list trunks for customer %s: %v\n", customer.BAN, err)
			continue
		}

		// Sync each IP
		for _, trunk := range trunks {
			if !trunk.Enabled {
				continue
			}

			for _, ip := range trunk.IPs {
				if !ip.Enabled {
					continue
				}

				if err := s.syncIPToRedis(ctx, ip, customer.BAN); err != nil {
					fmt.Printf("Warning: failed to sync IP %s for customer %s: %v\n", ip.IPAddress, customer.BAN, err)
					failed++
				} else {
					synced++
				}
			}
		}
	}

	fmt.Printf("Redis sync complete: %d synced, %d failed\n", synced, failed)
	return nil
}

// ============================================================================
// Premium Customer Operations
// ============================================================================

// CacheDedicatedIPMapping caches dedicated IP → customer BAN mapping in Redis
// Used by Kamailio for premium tier authentication (destination IP-based)
func (s *Service) CacheDedicatedIPMapping(ctx context.Context, customerID uuid.UUID, ipAddress string) error {
	customer, err := s.customerRepo.GetByID(ctx, customerID)
	if err != nil {
		return err
	}

	redisKey := fmt.Sprintf("customer:dedicated_ip:%s", ipAddress)
	err = s.redisClient.Set(ctx, redisKey, customer.BAN, 0).Err() // No expiration
	if err != nil {
		return fmt.Errorf("failed to cache dedicated IP mapping: %w", err)
	}

	return nil
}

// RemoveDedicatedIPMapping removes dedicated IP mapping from Redis
func (s *Service) RemoveDedicatedIPMapping(ctx context.Context, ipAddress string) error {
	redisKey := fmt.Sprintf("customer:dedicated_ip:%s", ipAddress)
	return s.redisClient.Del(ctx, redisKey).Err()
}

// ============================================================================
// Customer Status Caching
// ============================================================================

// CacheCustomerStatus caches customer status in Redis for fast Kamailio lookups
func (s *Service) CacheCustomerStatus(ctx context.Context, customerID uuid.UUID) error {
	customer, err := s.customerRepo.GetByID(ctx, customerID)
	if err != nil {
		return err
	}

	redisKey := fmt.Sprintf("customer:ban:%s:status", customer.BAN)
	err = s.redisClient.Set(ctx, redisKey, customer.Status, 0).Err() // No expiration
	if err != nil {
		return fmt.Errorf("failed to cache customer status: %w", err)
	}

	return nil
}

// ============================================================================
// Bulk Operations
// ============================================================================

// GetVendorOriginationIPs returns the list of IPs vendors should whitelist
func (s *Service) GetVendorOriginationIPs() models.VendorOriginationIPsResponse {
	// These are the Cloud NAT static IPs configured for us-central1
	return models.VendorOriginationIPsResponse{
		Region: "us-central1",
		IPs: []string{
			"34.57.46.26",
			"35.223.15.88",
			"136.111.96.47",
		},
		Note: "Whitelist all 3 IP addresses for inbound SIP traffic from WARP. Kamailio will use any of these IPs for outbound SIP INVITEs.",
	}
}
