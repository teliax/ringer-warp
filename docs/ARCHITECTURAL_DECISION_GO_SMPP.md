# Architectural Decision: Migration from Jasmin SMSC to Custom Go SMPP Gateway

**Date:** October 9, 2025
**Status:** APPROVED - In Progress
**Decision Maker:** Technical Architecture Team

---

## Context

WARP Platform initially selected Jasmin SMS Gateway (jookies/jasmin:0.10.12) as the SMPP messaging component for wholesale SMS routing. After extensive implementation and testing, we encountered fundamental limitations that prevent Jasmin from meeting our cloud-native, multi-pod HA requirements.

## Problem Statement

### Jasmin Limitations Discovered

1. **jCli Not Designed for Programmatic Control**
   - Telnet-based interactive console meant for human operators
   - Persist command fails to write pickled objects to disk
   - No API for connector management (only HTTP API for message sending)
   - Session-based state that doesn't survive connection closure

2. **Non-Cloud-Native Architecture**
   - File-based configuration using Python pickle (proprietary binary format)
   - Cannot generate configs programmatically
   - No database-backed configuration
   - Designed for single-server deployment

3. **Multi-Pod HA Blocker**
   - Connectors created via jCli exist only in memory
   - Persist command fails silently or requires undocumented reload
   - Load balancing between pods breaks connector visibility
   - Community recommends Ansible + Expect scripts (not suitable for K8s)

4. **Project Maintenance Concerns**
   - Last release: 0.10.12 (2023)
   - Slow response to issues
   - GitHub Issue #515 (2016) shows automation was never a design goal
   - Community uses workarounds, not solutions

## Decision

**Migrate from Jasmin SMSC to a custom Go SMPP Gateway built on proven Go SMPP libraries.**

## Alternatives Considered

### Option 1: Fix Jasmin with Workarounds
**Rejected** because:
- Would require init containers running jCli scripts on every pod startup
- Config doesn't persist, only startup automation
- Fighting the tool's design rather than using it properly
- Long-term maintenance burden
- Not truly cloud-native

### Option 2: Use Kannel
**Rejected** because:
- Also uses file-based configuration (flat text files)
- Similar automation challenges
- C-based, harder to customize
- Doesn't solve the fundamental cloud-native issue

### Option 3: Commercial SMPP Gateway (Sinch/Twilio APIs)
**Rejected** because:
- Loss of control over routing logic
- Higher per-message costs
- Vendor lock-in
- Cannot implement custom 10DLC compliance logic

### Option 4: Custom Go SMPP Gateway ✅ **SELECTED**
**Advantages:**
- Full control over persistence (PostgreSQL + Redis)
- Cloud-native design from day one
- API-first architecture
- Reuses existing WARP infrastructure (PostgreSQL, Redis, RabbitMQ, NFS)
- Mature Go SMPP libraries available
- Easier to maintain and extend
- Native Kubernetes integration

## Implementation Plan

### Phase 1: Core SMPP Server (Week 1)
- Build SMPP server listening on port 2775/2776
- Implement client authentication
- Handle submit_sm, deliver_sm PDUs
- Basic message routing

### Phase 2: Vendor Connector Management (Week 2)
- PostgreSQL-backed vendor configuration
- Dynamic SMPP client connections to upstream vendors (Sinch)
- Connection pooling and failover
- Health checks and monitoring

### Phase 3: Advanced Features (Week 3)
- DLR tracking with Redis
- 10DLC compliance validation
- Message segmentation and billing
- Rate limiting and throughput control
- RabbitMQ integration for async processing

### Phase 4: Migration & Cleanup (Week 4)
- Deploy Go SMPP Gateway to production
- Migrate traffic from Jasmin
- Remove Jasmin Kubernetes resources
- Update all documentation

## Technical Stack

### Go Libraries
- **SMPP Protocol**: `github.com/linxGnu/gosmpp` (actively maintained, 600+ stars)
  - Alternative: `github.com/fiorix/go-smpp`
- **PostgreSQL**: `github.com/jackc/pgx/v5` (already in use)
- **Redis**: `github.com/redis/go-redis/v9`
- **RabbitMQ**: `github.com/rabbitmq/amqp091-go`

### Architecture Reuse
- ✅ PostgreSQL schema (vendor_mgmt) - no changes needed
- ✅ Redis for DLR tracking - same design
- ✅ RabbitMQ for message bus - same design
- ✅ NFS for shared state - will use for logs/metrics
- ✅ API Gateway patterns - extend for SMPP management
- ✅ Kubernetes multi-pod deployment - proven working

## Migration Path

### Week 1: Build Core
1. Create `services/smpp-gateway/` directory structure
2. Implement SMPP server (receive from clients)
3. Implement SMPP client (send to Sinch)
4. Basic message routing

### Week 2: Integration
1. Connect to PostgreSQL for vendor configs
2. Redis DLR tracking
3. RabbitMQ message queuing
4. API endpoints for management

### Week 3: Production Readiness
1. Prometheus metrics
2. Health checks
3. Graceful shutdown
4. Connection pooling
5. Error handling and retries

### Week 4: Deploy & Cleanup
1. Deploy Go SMPP Gateway
2. Test with Sinch
3. Remove Jasmin deployments
4. Update documentation
5. Archive Jasmin configs for reference

## Success Criteria

- [ ] Go SMPP Gateway handles 1000+ msgs/sec
- [ ] Multi-pod deployment with shared PostgreSQL state
- [ ] SMPP binds to Sinch Chicago + Atlanta working
- [ ] DLR tracking 100% functional
- [ ] All Jasmin artifacts removed
- [ ] Documentation fully updated

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| SMPP protocol complexity | Use proven Go libraries with active communities |
| Development time | Reuse 80% of existing infrastructure |
| Breaking changes during migration | Run Jasmin + Go side-by-side during transition |
| Missing Jasmin features | Document only features we actually use |

## Rollback Plan

If Go SMPP Gateway fails:
- Jasmin containers and configs preserved in git
- Can redeploy Jasmin within 30 minutes
- No data loss (PostgreSQL unchanged)

## Approval & Sign-off

**Approved:** October 9, 2025
**Rationale:** Jasmin's jCli automation limitations are fundamental design constraints, not bugs we can fix. A custom Go gateway provides better alignment with WARP's cloud-native architecture.

---

## References

- [Jasmin GitHub Issue #515 - Config Management](https://github.com/jookies/jasmin/issues/515)
- [gosmpp Library](https://github.com/linxGnu/gosmpp)
- [SMPP 3.4 Protocol Specification](https://smpp.org/SMPP_v3_4_Issue1_2.pdf)
- WARP Infrastructure: `/docs/ARCHITECTURE.md`
