# Complex Kamailio Routing Analysis - Current System

## Overview
The existing Kamailio routing system is a sophisticated, production-grade implementation with **5,600+ lines of Lua code** and complex SQL procedures. This is NOT a basic LCR system - it's an enterprise telecom routing engine.

## Key Complexity Points

### 1. Multi-Dimensional Routing SQL Procedure
The `get_lrn_rates` stored procedure performs complex routing decisions based on:
- **Machine ID** (partition/routing group)
- **Account** (customer-specific routing)
- **Effective Zone** (INTERSTATE/INTRASTATE/LOCAL)
- **LRN** (Local Routing Number)
- **OCN/LATA** (Operating Company Number + LATA)
- **State** (for jurisdiction determination)
- **Rate Limit** (max acceptable rate)
- **IJ Policy** (Interstate/Intrastate jurisdiction)
- **ANI Classification** (DOM/DOMTF/INTL)
- **POI** (Point of Interconnection) based routing

### 2. Provider Policy System
```sql
-- Sophisticated provider behavior selection
CASE
  WHEN ijp.behavior IS NOT NULL
    THEN if(ijp.behavior = 'POI',
            if(ijp.poi_state = state_in, 'INTRASTATE', 'INTERSTATE'), ijp.behavior)
  WHEN ija.behavior IS NOT NULL
    THEN if(ija.behavior = 'POI',
            if(ija.poi_state = state_in, 'INTRASTATE', 'INTERSTATE'), ija.behavior)
  ELSE 'INTRASTATE'
END
```

### 3. Override System (Critical for Wholesale)

#### Domestic Overrides
- Static overrides per customer
- Dynamic database-driven overrides
- NPANxx-level overrides
- OCN/LATA-specific overrides
- Maximum override limits

#### International/Zone1 Overrides
- Country-specific routing
- Zone-based pricing
- Customer-specific international rates

#### Toll-Free (CIC) Overrides
- CIC-based routing (Carrier Identification Code)
- RespOrg-specific handling
- Special toll-free rating

### 4. Real-time DIP System

#### LRN Dips
```lua
function resource.dip_lrn(ctx, num)
  local uriprefix = flag.LRN_QUERY_URI or 'http://63.211.239.15:56660/'
  local uri = uriprefix .. tostring(num)
  -- Real-time HTTP query for LRN
  -- Returns LRN + SPID (Service Provider ID)
end
```

#### CIC Dips for Toll-Free
- Real-time CIC lookups
- ANI-based routing decisions
- LATA-based CIC determination

### 5. ANI Management
- ANI substitution lists (privacy)
- Random ANI generation from pools
- ANI normalization rules
- P-Charge-Info header processing

### 6. Rate Exclusion System
```sql
LEFT JOIN rate_exclusions AS re
ON re.accountcode = account_in AND re.providerid = o.id
```
- Customer-specific provider exclusions
- Temporary exclusions for quality issues
- Business rule enforcement

### 7. Dialstring Management
- Multiple dialstrings per provider
- Random selection for load distribution
- Format variations per provider type

### 8. Zone Classification Logic
- Interstate vs Intrastate determination
- Local calling determination
- International zone classification
- Special Zone1 handling

## What Hive-Mind Will Struggle With

### 1. Jurisdiction Logic
The POI-based interstate/intrastate determination is complex telecom regulatory logic that requires deep understanding of:
- FCC regulations
- State PUC rules
- Carrier interconnection agreements

### 2. Performance Optimization
The current system is highly optimized:
- Complex SQL with proper indexing
- Lua coroutines for async operations
- Caching strategies for expensive lookups
- Connection pooling

### 3. Error Recovery
- Fallback routing on provider failure
- Graceful degradation
- Circuit breaker patterns
- Retry logic with exponential backoff

## Migration Strategy for WARP

### Phase 1: Direct Port (What Hive-Mind CAN Do)
```go
// Basic structure Hive-Mind will generate
type LCREngine struct {
    db         *sql.DB
    telique    *TeliquClient
    cache      *redis.Client
    partitions map[int]*Partition
}

func (e *LCREngine) GetRoutes(req *RouteRequest) ([]*Route, error) {
    // Simplified version without overrides
    // Missing: jurisdiction logic, POI handling, exclusions
}
```

### Phase 2: Complex Logic (Needs Human Expertise)

#### Required Expertise:
1. **Telecom Regulatory Knowledge**
   - Interstate vs Intrastate rules
   - Jurisdiction determination
   - POI-based routing

2. **Performance Tuning**
   - Query optimization
   - Caching strategy
   - Connection management

3. **Business Rules**
   - Override precedence
   - Exclusion logic
   - Rate limiting

### Recommended Approach

#### 1. Preserve SQL Procedures
```sql
-- Keep these complex procedures AS-IS
CALL get_lrn_rates_20130822(
  machineid, account, zone, lrn, prefix,
  ocn, lata, state, ratelimit, ij, ani_class, max_results
);
```

#### 2. Wrap in Go Service
```go
type KamailioRoutingService struct {
    legacyDB *sql.DB  // Point to existing database
}

func (s *KamailioRoutingService) GetLRNRates(ctx context.Context, req *LRNRateRequest) (*RateResponse, error) {
    // Call existing stored procedure
    rows, err := s.legacyDB.Query(
        "CALL get_lrn_rates_20130822(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        req.MachineID, req.Account, req.Zone, req.LRN, req.Prefix,
        req.OCN, req.LATA, req.State, req.RateLimit, req.IJ, req.ANIClass, req.MaxResults,
    )
    // Parse and return results
}
```

#### 3. Gradual Migration
1. **Month 1**: Wrap existing logic in APIs
2. **Month 2**: Migrate simple routes to new system
3. **Month 3**: Implement overrides in new system
4. **Month 4+**: Gradually port complex logic with testing

## Critical Features to Preserve

### Must Have Day 1:
1. **get_lrn_rates** procedure (core routing)
2. **Override system** (customer requirements)
3. **Rate exclusions** (business rules)
4. **Zone classification** (billing accuracy)
5. **DIP integrations** (real-time lookups)

### Can Simplify Initially:
1. Random ANI selection
2. P-Charge-Info processing
3. Some POI logic
4. Complex failover scenarios

## Hive-Mind Instructions

### DO Generate:
- API wrapper for existing SQL procedures
- Basic CRUD for overrides
- Simple zone classification
- Integration with Telique for LRN
- Caching layer setup

### DO NOT Attempt:
- Rewrite SQL routing logic
- Implement jurisdiction rules from scratch
- Optimize query performance
- Complex POI-based routing

### Use Existing Code:
```lua
-- Port this logic carefully
if flag.CHECK_OVERRIDE_DOM then
  -- This is critical business logic
  -- Keep the exact behavior
end
```

## Database Schema Requirements

### Critical Tables from Existing System:
```sql
-- These must be migrated exactly
- dial (dialstring configurations)
- origin (provider definitions)
- routecost (rate tables)
- machine (partition definitions)
- rate_exclusions (business rules)
- provider_policy (jurisdiction policies)
- override tables (customer-specific rates)
```

## Risk Assessment

### High Risk Areas:
1. **Jurisdiction Logic** - Errors = regulatory violations
2. **Rating Accuracy** - Errors = billing disputes
3. **Override Precedence** - Errors = customer complaints
4. **Exclusion Rules** - Errors = routing to bad providers

### Mitigation:
1. Keep existing Kamailio running during migration
2. A/B test new routing against old
3. Start with test customers only
4. Have rollback plan ready

---

## Conclusion

The existing Kamailio routing is **enterprise-grade telecom routing** that took years to develop and optimize. Hive-Mind can create the framework and basic routing, but the complex business logic, jurisdiction rules, and performance optimizations require:

1. **Preservation of existing SQL procedures**
2. **Careful migration with extensive testing**
3. **Human expertise for regulatory compliance**
4. **Gradual rollout with fallback options**

**Recommendation**: Use Hive-Mind to build the new platform infrastructure, but wrap and preserve the existing routing logic for initial deployment, then gradually migrate with human oversight.