# Phase 2 Implementation Plan - Application Deployment

**Project**: WARP Platform  
**Phase**: 2 - Core Applications  
**Duration**: 2-3 Weeks  
**Start Date**: 2025-09-24  

## Overview

With Phase 1 infrastructure complete, Phase 2 focuses on deploying and configuring the core application services that will run on our production-ready infrastructure.

## Week 1: Media & Messaging Infrastructure

### 1. RTPEngine Configuration (Days 1-2)

#### Current State
- 3 VMs deployed: warp-rtpengine-1/2/3
- External IPs assigned
- Firewall rules configured

#### Implementation Tasks
1. **Install RTPEngine**
   ```bash
   # On each RTPEngine VM
   apt-get install rtpengine
   ```

2. **Configure RTPEngine**
   - Edit `/etc/rtpengine/rtpengine.conf`
   - Set interface configurations
   - Configure port ranges
   - Enable recording if needed

3. **Kamailio Integration**
   - Update Kamailio config for RTPEngine IPs
   - Configure rtpengine module
   - Set up load balancing between engines

4. **Testing**
   - Test media flow
   - Verify NAT traversal
   - Check transcoding capabilities

#### Documentation Needed
- RTPEngine configuration template
- Kamailio rtpengine.cfg module config
- Testing procedures

### 2. Jasmin SMSC Deployment (Days 2-3)

#### Deployment Strategy
- Deploy as Kubernetes StatefulSet
- Use persistent volumes for message queue
- Configure horizontal pod autoscaling

#### Implementation Tasks
1. **Create Kubernetes Manifests**
   ```yaml
   # jasmin-deployment.yaml
   - StatefulSet configuration
   - Service definitions
   - ConfigMaps for configuration
   - PersistentVolumeClaims
   ```

2. **Database Setup**
   ```sql
   -- Jasmin tables
   CREATE SCHEMA jasmin;
   CREATE TABLE jasmin.messages (...);
   CREATE TABLE jasmin.routes (...);
   CREATE TABLE jasmin.connectors (...);
   ```

3. **Configure SMPP Connectors**
   - Sinch SMPP configuration
   - Bind credentials
   - TLS settings

4. **Message Routing**
   - Configure routing rules
   - Set up filters
   - Enable DLR handling

#### Documentation Needed
- Jasmin deployment guide
- SMPP connector configuration
- Message routing rules
- 10DLC compliance setup

### 3. API Gateway Implementation (Days 3-5)

#### Current State
- Nginx placeholder running
- LoadBalancer configured
- Ingress ready

#### Implementation Plan
1. **Select Technology**
   - Kong, Traefik, or custom Go service
   - OAuth2/JWT middleware
   - Rate limiting
   - Request routing

2. **Deploy API Gateway**
   ```yaml
   # api-gateway-deployment.yaml
   - Deployment configuration
   - Service mesh integration
   - ConfigMaps for routes
   ```

3. **Configure Routes**
   ```yaml
   routes:
     - path: /api/v1/customers
       service: customer-service
     - path: /api/v1/trunks
       service: trunk-service
     - path: /api/v1/billing
       service: billing-service
   ```

4. **Authentication Integration**
   - Google Identity Platform
   - JWT validation
   - API key management

#### Documentation Needed
- API Gateway architecture
- Route configuration guide
- Authentication flow
- Rate limiting policies

## Week 2: Core Services & Integration

### 4. Customer Management Service (Days 6-7)

#### Service Architecture
- Microservice in Go
- PostgreSQL backend
- Redis caching
- Event-driven updates

#### Implementation Tasks
1. **Service Development**
   - CRUD operations
   - Validation logic
   - Event publishing
   - API endpoints

2. **Database Integration**
   - Use existing schemas
   - Connection pooling
   - Transaction management

3. **Deployment**
   - Docker container
   - Kubernetes deployment
   - Service mesh registration

### 5. SIP Trunk Provisioning Service (Days 8-9)

#### Implementation Tasks
1. **Trunk Management API**
   - Create/update/delete trunks
   - IP whitelist management
   - Codec configuration
   - Rate limit settings

2. **Kamailio Integration**
   - Dynamic dispatcher updates
   - Permissions module updates
   - Real-time configuration

3. **Validation & Testing**
   - IP format validation
   - Capacity checks
   - Integration tests

### 6. Billing Service Foundation (Days 10)

#### Initial Implementation
1. **Rating Engine**
   - Zone-based pricing
   - Real-time rating
   - Prepaid balance checks

2. **CDR Processing**
   - CDR collection from Kamailio
   - Enrichment pipeline
   - BigQuery insertion

3. **NetSuite Preparation**
   - API client setup
   - Data mapping
   - Test environment

## Week 3: Testing & Production Readiness

### 7. Integration Testing (Days 11-12)

#### Test Scenarios
1. **End-to-End Call Flow**
   - SIP registration
   - Call routing
   - Media flow
   - CDR generation

2. **SMS Flow Testing**
   - Message submission
   - Routing verification
   - DLR handling
   - Error scenarios

3. **API Testing**
   - Authentication flows
   - CRUD operations
   - Rate limiting
   - Error handling

### 8. Performance Testing (Days 13-14)

#### Load Testing
1. **SIPp Testing**
   - 1000 CPS target
   - 10,000 concurrent calls
   - Various call scenarios

2. **API Load Testing**
   - K6 or Locust
   - 10,000 RPS target
   - Latency requirements

3. **Database Performance**
   - Query optimization
   - Index tuning
   - Connection pool sizing

### 9. Documentation & Handover (Day 15)

#### Documentation Updates
1. **Operational Runbooks**
   - Service restart procedures
   - Troubleshooting guides
   - Monitoring queries

2. **API Documentation**
   - OpenAPI updates
   - Example requests
   - SDK generation

3. **Architecture Diagrams**
   - Updated service topology
   - Data flow diagrams
   - Integration points

## Infrastructure Cleanup Tasks

### LoadBalancer Consolidation

#### Services to Migrate
1. **Monitoring Services**
   ```bash
   # Already using ClusterIP, verify and document
   kubectl get svc -n monitoring
   ```

2. **Remove Deprecated LoadBalancers**
   ```bash
   # After verification, delete old LBs
   kubectl delete svc [old-service-names]
   ```

#### Services to Keep
- Kamailio TCP/UDP LoadBalancers (required for SIP)
- NGINX Ingress LoadBalancer (required for HTTP/HTTPS)

### Old Project Cleanup

1. **Data Backup**
   ```bash
   # Export any remaining data
   gcloud sql export...
   gsutil cp...
   ```

2. **Resource Deletion**
   ```bash
   # Delete all resources in old project
   gcloud projects delete ringer-472421
   ```

## Hive-Mind Agent Requirements

### Agent 1: Infrastructure & Data
**Documentation Needed**:
- RTPEngine configuration guide
- Database migration scripts
- Performance tuning parameters

### Agent 2: Core Services  
**Documentation Needed**:
- Service API specifications
- Business logic requirements
- Integration patterns

### Agent 3: Integrations
**Documentation Needed**:
- External API documentation
- Authentication flows
- Error handling patterns

### Agent 4: Frontend & Admin
**Documentation Needed**:
- UI/UX requirements
- API integration guide
- Component library setup

## Success Criteria

### Technical Metrics
- ✅ All services deployed and healthy
- ✅ Integration tests passing (>95%)
- ✅ Performance targets met
- ✅ Monitoring dashboards complete

### Business Metrics
- ✅ SIP calls routing successfully
- ✅ SMS messages delivered
- ✅ Customer API functional
- ✅ Billing pipeline operational

## Risk Mitigation

### Identified Risks
1. **RTPEngine Configuration**
   - Risk: Media not flowing
   - Mitigation: Extensive testing, fallback config

2. **Jasmin Integration**
   - Risk: SMPP connection issues
   - Mitigation: Sinch support engagement

3. **Performance Issues**
   - Risk: Not meeting SLA targets
   - Mitigation: Early load testing, optimization

## Timeline Summary

```
Week 1: Infrastructure Services
├── Days 1-2: RTPEngine Setup
├── Days 2-3: Jasmin SMSC
└── Days 3-5: API Gateway

Week 2: Application Services  
├── Days 6-7: Customer Service
├── Days 8-9: SIP Provisioning
└── Day 10: Billing Foundation

Week 3: Production Readiness
├── Days 11-12: Integration Testing
├── Days 13-14: Performance Testing
└── Day 15: Documentation
```

## Next Steps

1. **Immediate Actions** (Day 1):
   - SSH into RTPEngine VMs
   - Begin RTPEngine installation
   - Prepare Jasmin manifests

2. **Team Coordination**:
   - Daily standups at 9 AM
   - Progress tracking in CURRENT_STATUS.md
   - Blocker escalation process

3. **Success Tracking**:
   - Update progress daily
   - Document all configuration
   - Test continuously

---

**Prepared by**: Platform Team  
**Review Schedule**: Daily at 4 PM  
**Escalation**: Platform Architect