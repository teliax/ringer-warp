# WARP LCR (Least Cost Routing) Architecture Guide

## Executive Summary

The WARP platform's LCR system is a sophisticated, enterprise-grade telecom routing engine that determines optimal call paths based on cost, quality, jurisdiction, and business rules. This guide provides comprehensive details for Claude Flow hive-mind to understand and implement the routing logic.

## Core Routing Architecture

### 1. Multi-Dimensional Decision Matrix

The LCR engine evaluates routes across multiple dimensions simultaneously:

```yaml
Routing Dimensions:
  1. Cost Optimization:
     - Real-time vendor rates
     - Customer-specific pricing
     - Zone-based costing (Interstate/Intrastate/Local)
  
  2. Quality Metrics:
     - ASR (Answer Seizure Ratio)
     - ACD (Average Call Duration) 
     - PDD (Post-Dial Delay)
     - Provider reliability scores
  
  3. Regulatory Compliance:
     - Jurisdiction determination (Interstate vs Intrastate)
     - POI (Point of Interconnection) requirements
     - STIR/SHAKEN attestation levels
  
  4. Business Rules:
     - Customer-specific overrides
     - Provider exclusions
     - Rate limits and caps
     - Routing partitions
```

### 2. Database-Driven Routing Engine

#### Kamailio LuaJIT FFI Integration
```lua
-- Kamailio runs embedded LuaJIT with FFI for high-performance routing
-- Located in: /etc/kamailio/lua/routing.lua

local ffi = require("ffi")
local C = ffi.C

-- FFI definitions for direct C library calls
ffi.cdef[[
    int sr_kemi_exec_func(void* ctx, int idx);
    char* get_ruri_user(void* msg);
    char* get_from_user(void* msg);
    int set_ruri(void* msg, const char* uri);
    int append_branch(void* msg, const char* uri);
]]

-- Main routing function called from Kamailio
function ksr_route_request(msg)
    -- Extract call details using FFI for performance
    local dni = ffi.string(C.get_ruri_user(msg))
    local ani = ffi.string(C.get_from_user(msg))
    
    -- Call WARP LCR API (via HTTP client in Lua)
    local routes = warp_lcr.get_routes({
        dni = dni,
        ani = ani,
        customer_ban = KSR.pv.get("$avp(customer_ban)"),
        trunk_id = KSR.pv.get("$avp(trunk_id)")
    })
    
    -- Apply routes using Kamailio pseudo-variables
    for i, route in ipairs(routes) do
        if i == 1 then
            -- Primary route
            C.set_ruri(msg, route.dialstring)
        else
            -- Backup routes
            C.append_branch(msg, route.dialstring)
        end
        
        -- Store vendor info for CDR
        KSR.pv.sets("$avp(vendor_id)", route.vendor_id)
        KSR.pv.sets("$avp(rate)", tostring(route.rate))
    end
    
    return 1  -- Continue routing
end

-- WARP LCR API client module
local warp_lcr = {}

function warp_lcr.get_routes(params)
    -- HTTP request to WARP routing service
    local http = require("resty.http")
    local httpc = http.new()
    
    -- Connect to internal WARP API
    local res, err = httpc:request_uri("http://warp-api.svc.cluster.local:8080/v1/routing/lcr", {
        method = "POST",
        headers = {
            ["Content-Type"] = "application/json",
            ["X-Internal-Auth"] = os.getenv("INTERNAL_API_KEY")
        },
        body = json.encode(params),
        timeout = 50  -- 50ms timeout for routing decisions
    })
    
    if not res then
        -- Fallback to cached routes or default
        return warp_lcr.get_cached_routes(params.dni)
    end
    
    return json.decode(res.body).routes
end

-- Performance optimizations using LuaJIT
local jit = require("jit")
jit.opt.start("minstitch=10", "maxtrace=4000", "maxrecord=8000", "sizemcode=64", "maxmcode=4000")
```

#### Core SQL Procedure (Preserved from Kamailio)
```sql
-- The heart of our LCR: get_lrn_rates procedure
CALL get_lrn_rates(
    machine_id,        -- Routing partition/group
    account,           -- Customer BAN
    effective_zone,    -- INTERSTATE/INTRASTATE/LOCAL
    lrn,              -- Local Routing Number
    prefix,           -- Dialed prefix (NPANxx)
    ocn,              -- Operating Company Number
    lata,             -- Local Access Transport Area
    state,            -- Terminating state
    rate_limit,       -- Max acceptable rate
    ij_policy,        -- Interstate/Intrastate policy
    ani_class,        -- DOM/DOMTF/INTL
    max_results       -- Number of routes to return
);

-- Returns prioritized list of routes with:
-- vendor_id, trunk_id, rate, priority, dialstring, quality_score
```

#### Migration Strategy for WARP
```go
// Phase 1: Wrap existing SQL procedures in Go service
type LCRService struct {
    db         *sql.DB
    cache      *redis.Client
    telique    *TeliquClient
    rateEngine *RatingEngine
}

func (s *LCRService) GetRoutes(ctx context.Context, req *RouteRequest) ([]*Route, error) {
    // Step 1: Enrich request with LRN dip
    lrnData, err := s.telique.LookupLRN(req.DNI)
    if err != nil {
        // Fallback to NPANxx routing
        lrnData = s.getNPANxxDefaults(req.DNI)
    }
    
    // Step 2: Determine jurisdiction
    jurisdiction := s.determineJurisdiction(req, lrnData)
    
    // Step 3: Call existing SQL procedure
    routes, err := s.callLRNRatesProcedure(ctx, req, lrnData, jurisdiction)
    
    // Step 4: Apply business rules and overrides
    routes = s.applyBusinessRules(routes, req)
    
    // Step 5: Cache result
    s.cache.Set(ctx, req.CacheKey(), routes, 5*time.Minute)
    
    return routes, nil
}
```

### 3. Real-Time Data Enrichment

#### LRN (Local Routing Number) Dips
```go
type TeliquClient struct {
    baseURL string
    apiKey  string
    client  *http.Client
}

type LRNResponse struct {
    LRN        string `json:"lrn"`
    SPID       string `json:"spid"`        // Service Provider ID
    OCN        string `json:"ocn"`         // Operating Company Number
    LATA       string `json:"lata"`        // Local Access Transport Area
    State      string `json:"state"`
    RateCenter string `json:"rate_center"`
    Portable   bool   `json:"portable"`
    Wireless   bool   `json:"wireless"`
}

func (c *TeliquClient) LookupLRN(number string) (*LRNResponse, error) {
    // Real-time HTTP query to Telique
    // Critical for accurate routing and rating
    // MUST be cached for performance
}
```

#### LERG (Local Exchange Routing Guide) Data
```go
type LERGEntry struct {
    NPANxx     string
    LATA       string
    OCN        string
    RateCenter string
    State      string
    EffectiveDate time.Time
}

// Daily sync from Telique LERG API
func (s *LCRService) SyncLERGData(ctx context.Context) error {
    // Download latest LERG file
    // Parse and update database
    // Invalidate affected cache entries
}
```

### 4. Zone Classification Logic

```go
type ZoneClassifier struct {
    lergDB *sql.DB
}

func (c *ZoneClassifier) Classify(ani, dni string, lrnData *LRNResponse) Zone {
    // Extract originating and terminating info
    origState := c.getStateFromANI(ani)
    termState := lrnData.State
    
    // Determine zone based on regulatory rules
    if origState == "" || termState == "" {
        return ZONE_INTERSTATE // Default when uncertain
    }
    
    if origState == termState {
        // Check for local calling
        if c.isLocalCall(ani, dni, lrnData) {
            return ZONE_LOCAL
        }
        return ZONE_INTRASTATE
    }
    
    return ZONE_INTERSTATE
}

// Local calling determination (complex LATA-based logic)
func (c *ZoneClassifier) isLocalCall(ani, dni string, lrnData *LRNResponse) bool {
    // Check LATA match
    // Check rate center proximity
    // Apply local calling area rules
}
```

### 5. Override System Architecture

#### Hierarchical Override Precedence
```yaml
Override Priority (highest to lowest):
  1. Trunk-Specific Overrides:
     - Per-trunk custom rates
     - Specific routing preferences
  
  2. Customer Contract Overrides:
     - Negotiated rates
     - Preferred vendors
     - Exclusion lists
  
  3. Route-Specific Overrides:
     - NPANxx overrides
     - OCN/LATA overrides
     - International zone overrides
  
  4. Default Routing:
     - Standard LCR algorithm
     - Zone-based rates
```

#### Override Implementation
```go
type OverrideEngine struct {
    db *sql.DB
}

type Override struct {
    ID           string
    AccountID    string
    Type         string // DOMESTIC, INTERNATIONAL, TOLLFREE, CIC
    Pattern      string // NPANxx, Country Code, CIC
    VendorID     string
    Rate         float64
    Priority     int
    EffectiveFrom time.Time
    EffectiveTo   time.Time
}

func (e *OverrideEngine) ApplyOverrides(routes []*Route, req *RouteRequest) []*Route {
    // Check for trunk-specific overrides
    if overrides := e.getTrunkOverrides(req.TrunkID); len(overrides) > 0 {
        return e.applyTrunkOverrides(routes, overrides)
    }
    
    // Check for customer overrides
    if overrides := e.getCustomerOverrides(req.AccountID, req.DNI); len(overrides) > 0 {
        return e.applyCustomerOverrides(routes, overrides)
    }
    
    // Check for route-specific overrides
    if overrides := e.getRouteOverrides(req.DNI); len(overrides) > 0 {
        return e.applyRouteOverrides(routes, overrides)
    }
    
    return routes
}
```

### 6. Vendor Selection & Load Balancing

```go
type VendorSelector struct {
    qualityTracker *QualityTracker
    rateExclusions *ExclusionEngine
}

type Route struct {
    VendorID      string
    TrunkID       string
    Dialstring    string
    Rate          float64
    Priority      int
    QualityScore  float64
    CurrentLoad   int
    MaxCapacity   int
    Features      []string // SRTP, T38, etc.
}

func (s *VendorSelector) SelectRoutes(candidates []*Route, limit int) []*Route {
    // Filter out excluded vendors
    candidates = s.filterExclusions(candidates)
    
    // Score each route
    for _, route := range candidates {
        route.Score = s.calculateScore(route)
    }
    
    // Sort by score (cost, quality, load balance)
    sort.Slice(candidates, func(i, j int) bool {
        return candidates[i].Score > candidates[j].Score
    })
    
    // Return top N routes
    if len(candidates) > limit {
        return candidates[:limit]
    }
    return candidates
}

func (s *VendorSelector) calculateScore(route *Route) float64 {
    // Multi-factor scoring algorithm
    costScore := (1.0 / (route.Rate + 0.001)) * 100
    qualityScore := route.QualityScore
    loadScore := float64(route.MaxCapacity-route.CurrentLoad) / float64(route.MaxCapacity)
    
    // Weighted average
    return (costScore * 0.4) + (qualityScore * 0.4) + (loadScore * 0.2)
}
```

### 7. Rate Exclusion System

```go
type ExclusionEngine struct {
    db    *sql.DB
    cache *redis.Client
}

type Exclusion struct {
    AccountID  string
    VendorID   string
    Reason     string // QUALITY, DISPUTE, TEMPORARY, PERMANENT
    ExpiresAt  *time.Time
}

func (e *ExclusionEngine) GetExclusions(accountID string) []string {
    // Check cache first
    if exclusions := e.cache.Get(accountID + ":exclusions"); exclusions != nil {
        return exclusions
    }
    
    // Query database
    query := `
        SELECT vendor_id 
        FROM rate_exclusions 
        WHERE account_id = $1 
        AND (expires_at IS NULL OR expires_at > NOW())
    `
    
    // Cache result
    // Return vendor IDs to exclude
}
```

### 8. Performance Optimization

#### Caching Strategy
```yaml
Cache Layers:
  1. Edge Cache (Cloud CDN):
     - Static rate sheets
     - LERG data
     - TTL: 24 hours
  
  2. Application Cache (Redis):
     - LRN lookup results: 7 days
     - Route calculations: 5 minutes
     - Quality scores: 1 hour
     - Exclusion lists: 15 minutes
  
  3. Database Cache:
     - Materialized views for common queries
     - Indexed rate tables
     - Partitioned CDR tables
```

#### Query Optimization
```sql
-- Optimized rate lookup with proper indexing
CREATE INDEX idx_rates_lookup ON routecost(
    machine_id, 
    effective_zone, 
    prefix, 
    rate
) WHERE active = true;

-- Partitioned CDR table for performance
CREATE TABLE cdrs (
    id UUID,
    call_date DATE,
    customer_ban VARCHAR(20),
    -- other fields
) PARTITION BY RANGE (call_date);
```

### 9. Failover & Retry Logic

```go
type CallRouter struct {
    lcr           *LCRService
    sipClient     *SIPClient
    retryPolicy   *RetryPolicy
}

func (r *CallRouter) RouteCall(req *CallRequest) (*CallResult, error) {
    // Get prioritized routes
    routes, err := r.lcr.GetRoutes(req.Context, req.RouteRequest)
    if err != nil {
        return nil, err
    }
    
    // Try each route in order
    for i, route := range routes {
        result, err := r.attemptRoute(req, route)
        
        if err == nil {
            return result, nil
        }
        
        // Check if error is retryable
        if !r.retryPolicy.ShouldRetry(err, i) {
            break
        }
        
        // Log attempt for analytics
        r.logAttempt(req, route, err)
        
        // Apply backoff if needed
        if r.retryPolicy.RequiresBackoff(err) {
            time.Sleep(r.retryPolicy.BackoffDuration(i))
        }
    }
    
    return nil, ErrNoRoutesAvailable
}
```

### 10. Real-Time Monitoring & Analytics

```go
type RoutingMetrics struct {
    prometheus.Registry
}

func (m *RoutingMetrics) Init() {
    // Route selection metrics
    m.routeSelections = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "lcr_route_selections_total",
            Help: "Total route selections by vendor",
        },
        []string{"vendor", "zone", "result"},
    )
    
    // Performance metrics
    m.routingLatency = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "lcr_routing_latency_seconds",
            Help: "LCR routing decision latency",
            Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5},
        },
        []string{"zone"},
    )
    
    // Quality metrics
    m.asr = prometheus.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "lcr_vendor_asr",
            Help: "Vendor Answer Seizure Ratio",
        },
        []string{"vendor"},
    )
}
```

## Implementation Roadmap for WARP

### Phase 1: Foundation (Month 1)
```yaml
Tasks:
  1. Preserve existing SQL procedures:
     - Migrate get_lrn_rates procedure
     - Migrate override tables
     - Migrate rate exclusion logic
  
  2. Create API wrapper:
     - Go service wrapping SQL procedures
     - REST endpoints for routing requests
     - Basic caching with Redis
  
  3. Integrate Telique:
     - LRN lookup API client
     - LERG data sync job
     - Caching strategy
```

### Phase 2: Enhancement (Month 2)
```yaml
Tasks:
  1. Implement override system:
     - CRUD APIs for overrides
     - Hierarchical precedence logic
     - Real-time application
  
  2. Add monitoring:
     - Prometheus metrics
     - Grafana dashboards
     - Alerting rules
  
  3. Quality tracking:
     - ASR/ACD calculation
     - Vendor scoring
     - Automatic exclusions
```

### Phase 3: Optimization (Month 3)
```yaml
Tasks:
  1. Performance tuning:
     - Query optimization
     - Connection pooling
     - Batch processing
  
  2. Advanced features:
     - ML-based routing predictions
     - Cost optimization algorithms
     - Predictive quality scoring
  
  3. Testing & validation:
     - A/B testing framework
     - Shadow routing
     - Performance benchmarks
```

## Critical Implementation Notes for Hive-Mind

### MUST Preserve
1. **SQL Procedures**: The get_lrn_rates procedure contains years of telecom logic - DO NOT rewrite
2. **Jurisdiction Logic**: POI-based interstate/intrastate determination is regulatory-critical
3. **Override System**: Customer-specific overrides are contractual obligations
4. **Exclusion Rules**: Prevent routing to problematic vendors

### CAN Simplify Initially
1. Random ANI selection from pools
2. P-Charge-Info header processing
3. Complex failover scenarios (basic retry is sufficient)
4. Advanced transcoding rules

### Performance Requirements
```yaml
Latency Targets:
  - LRN lookup (cached): < 1ms
  - LRN lookup (API): < 100ms
  - Route calculation: < 10ms
  - Total routing decision: < 50ms

Throughput:
  - Peak CPS: 1,000
  - Sustained CPS: 500
  - Concurrent routing requests: 5,000

Accuracy:
  - Route selection accuracy: 99.99%
  - Rate calculation accuracy: 100%
  - Jurisdiction determination: 99.9%
```

### Database Requirements
```sql
-- Critical tables to migrate
- dial (dialstring configurations)
- origin (vendor definitions)  
- routecost (rate tables)
- machine (routing partitions)
- rate_exclusions (business rules)
- provider_policy (jurisdiction policies)
- override_domestic (customer rates)
- override_zone1 (international rates)
- override_tf (toll-free rates)
```

### Error Handling
```go
type RoutingError struct {
    Code    string
    Message string
    Details map[string]interface{}
}

// Standard error codes
const (
    ERR_NO_ROUTES      = "NO_ROUTES_AVAILABLE"
    ERR_ALL_EXCLUDED   = "ALL_VENDORS_EXCLUDED"
    ERR_RATE_LIMIT     = "RATE_LIMIT_EXCEEDED"
    ERR_LRN_FAILURE    = "LRN_LOOKUP_FAILED"
    ERR_INVALID_NUMBER = "INVALID_NUMBER_FORMAT"
)
```

## Testing Strategy

### Unit Tests
```go
func TestLCRRouting(t *testing.T) {
    // Test basic routing
    // Test with overrides
    // Test exclusions
    // Test jurisdiction determination
    // Test failover logic
}
```

### Integration Tests
```go
func TestEndToEndRouting(t *testing.T) {
    // Test with real Telique API
    // Test with production database
    // Test caching behavior
    // Test concurrent requests
}
```

### Load Testing
```yaml
Scenarios:
  1. Burst traffic: 1000 CPS for 60 seconds
  2. Sustained load: 500 CPS for 1 hour
  3. Mixed traffic: Voice + SMS routing
  4. Cache miss scenario: Flush cache during load
```

## Regulatory Compliance

### Interstate vs Intrastate
```go
// Critical regulatory logic - MUST be accurate
func DetermineJurisdiction(origState, termState string, poi *POIConfig) string {
    if poi != nil && poi.Enabled {
        // POI-based determination (carrier-specific)
        if poi.State == termState {
            return "INTRASTATE"
        }
        return "INTERSTATE"
    }
    
    // Standard determination
    if origState == termState {
        return "INTRASTATE"
    }
    return "INTERSTATE"
}
```

### FCC Requirements
- Accurate jurisdiction determination for USF reporting
- STIR/SHAKEN attestation level tracking
- Rural call completion reporting
- 911 routing compliance

## Summary

The WARP LCR system is a sophisticated routing engine that requires careful implementation to maintain:
1. **Accuracy**: Regulatory compliance and billing precision
2. **Performance**: Sub-50ms routing decisions at 1000 CPS
3. **Flexibility**: Customer-specific overrides and business rules
4. **Reliability**: Failover and retry mechanisms
5. **Scalability**: Handle growth from 100 to 10,000+ customers

The phased migration approach allows preservation of critical business logic while modernizing the infrastructure for cloud-native deployment.
