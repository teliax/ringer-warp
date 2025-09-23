# Kong API Gateway Migration Plan

## Overview

This document outlines the migration plan from the current nginx ingress controller to Kong API Gateway for the WARP platform. The migration will be performed in phases to ensure zero downtime and the ability to rollback at any stage.

## Pre-Migration Checklist

- [ ] Review and approve Kong deployment configuration
- [ ] Ensure PostgreSQL backup procedures are in place
- [ ] Verify monitoring and alerting systems are ready
- [ ] Create DNS records for staging environment
- [ ] Document current nginx configuration for rollback
- [ ] Prepare API keys and JWT secrets
- [ ] Train team on Kong administration

## Migration Phases

### Phase 1: Development Environment (Week 1)

**Timeline**: Days 1-3

1. **Deploy Kong Infrastructure**
   ```bash
   # Create namespace and RBAC
   kubectl apply -f kubernetes/api-gateway/kong/00-namespace.yaml
   
   # Deploy PostgreSQL
   kubectl apply -f kubernetes/api-gateway/kong/01-postgres.yaml
   
   # Wait for PostgreSQL to be ready
   kubectl wait --for=condition=ready pod -l app=postgres -n kong --timeout=300s
   
   # Run migrations
   kubectl apply -f kubernetes/api-gateway/kong/02-kong-migrations.yaml
   
   # Wait for migrations to complete
   kubectl wait --for=condition=complete job/kong-migrations -n kong --timeout=300s
   
   # Deploy Kong
   kubectl apply -f kubernetes/api-gateway/kong/03-kong-deployment.yaml
   kubectl apply -f kubernetes/api-gateway/kong/04-kong-services.yaml
   kubectl apply -f kubernetes/api-gateway/kong/05-kong-ingress.yaml
   ```

2. **Configure Plugins and Routes**
   ```bash
   # Apply plugins
   kubectl apply -f kubernetes/api-gateway/kong/06-kong-plugins.yaml
   
   # Configure WARP API routes
   kubectl apply -f kubernetes/api-gateway/kong/07-warp-api-configuration.yaml
   
   # Set up monitoring
   kubectl apply -f kubernetes/api-gateway/kong/08-monitoring.yaml
   ```

3. **Verify Deployment**
   ```bash
   # Check Kong status
   curl -i http://kong-admin.kong:8001/status
   
   # Test health endpoint
   curl -i https://api-dev.ringer.tel/v1/health
   ```

### Phase 2: Staging Environment (Week 2)

**Timeline**: Days 4-7

1. **Deploy to Staging**
   - Repeat Phase 1 steps in staging namespace
   - Configure staging-specific variables
   - Import OpenAPI specification

2. **Integration Testing**
   - Test all API endpoints
   - Verify authentication flows
   - Test rate limiting
   - Validate webhook deliveries
   - Performance testing with load tests

3. **Security Testing**
   - Penetration testing
   - Authentication bypass attempts
   - Rate limit validation
   - IP restriction testing

### Phase 3: Production Preparation (Week 3)

**Timeline**: Days 8-14

1. **Production Infrastructure**
   ```bash
   # Deploy Kong in production namespace
   # Use production certificates and secrets
   # Configure production rate limits
   ```

2. **Data Migration**
   - Export API keys from current system
   - Import into Kong
   - Set up consumer mappings
   - Configure per-customer rate limits

3. **Monitoring Setup**
   - Configure Grafana dashboards
   - Set up alerts in PagerDuty
   - Configure log aggregation
   - Set up distributed tracing

### Phase 4: Traffic Migration (Week 4)

**Timeline**: Days 15-21

1. **Canary Deployment (10% traffic)**
   ```bash
   # Update nginx ingress to split traffic
   kubectl annotate ingress warp-api-ingress-tls \
     nginx.ingress.kubernetes.io/canary="true" \
     nginx.ingress.kubernetes.io/canary-weight="10"
   ```

2. **Monitor Metrics**
   - Error rates
   - Response times
   - Rate limit hits
   - Authentication failures

3. **Progressive Rollout**
   - Day 1: 10% traffic
   - Day 2: 25% traffic
   - Day 3: 50% traffic
   - Day 4: 75% traffic
   - Day 5: 100% traffic

4. **Update DNS**
   ```bash
   # Point api.ringer.tel to Kong LoadBalancer IP
   # Keep nginx as backup
   ```

### Phase 5: Nginx Decommission (Week 5)

**Timeline**: Days 22-28

1. **Verify Full Migration**
   - All traffic through Kong
   - No errors or issues for 48 hours
   - All monitors green

2. **Remove Nginx Configuration**
   ```bash
   # Delete nginx ingress rules
   kubectl delete ingress warp-api-ingress-tls -n warp-api
   
   # Keep nginx controller for other services
   ```

3. **Documentation Update**
   - Update API documentation
   - Update runbooks
   - Update architecture diagrams

## Rollback Procedures

### Quick Rollback (< 5 minutes)
```bash
# Route traffic back to nginx
kubectl annotate ingress warp-api-ingress-tls \
  nginx.ingress.kubernetes.io/canary-weight="0" --overwrite

# Or update DNS to point back to nginx
```

### Full Rollback (< 30 minutes)
```bash
# 1. Update DNS to nginx IP
# 2. Scale down Kong deployment
kubectl scale deployment kong-gateway -n kong --replicas=0

# 3. Restore nginx configuration
kubectl apply -f backups/nginx-ingress-backup.yaml
```

## Success Criteria

- [ ] All API endpoints accessible through Kong
- [ ] Authentication working for all methods (JWT, API Key)
- [ ] Rate limiting applied correctly
- [ ] < 5ms additional latency
- [ ] 99.99% uptime maintained
- [ ] All webhooks delivered successfully
- [ ] Monitoring and alerting functional
- [ ] Team trained on Kong operations

## Post-Migration Tasks

1. **Performance Optimization**
   - Tune Kong worker processes
   - Optimize PostgreSQL queries
   - Configure caching policies

2. **Security Hardening**
   - Enable WAF rules
   - Configure DDoS protection
   - Implement API versioning

3. **Feature Enablement**
   - Developer portal
   - API analytics
   - Usage-based billing integration

## Communication Plan

1. **Internal Communication**
   - Daily standup updates
   - Slack channel: #kong-migration
   - Weekly steering committee updates

2. **Customer Communication**
   - 2 weeks notice before migration
   - Status page updates during migration
   - Post-migration success announcement

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Database failure | High | PostgreSQL HA setup, regular backups |
| Performance degradation | Medium | Load testing, gradual rollout |
| Authentication issues | High | Extensive testing, parallel running |
| Configuration errors | Medium | GitOps, configuration validation |
| Team knowledge gap | Low | Training sessions, documentation |

## Emergency Contacts

- DevOps Lead: [Contact]
- Database Admin: [Contact]
- Security Team: [Contact]
- Kong Support: support@konghq.com

## Appendix

### Useful Commands

```bash
# Check Kong version
kubectl exec -it deploy/kong-gateway -n kong -- kong version

# View Kong configuration
kubectl exec -it deploy/kong-gateway -n kong -- kong config

# Database backup
kubectl exec -it deploy/postgres -n kong -- pg_dump -U kong kong > kong-backup.sql

# View routes
curl -s kong-admin.kong:8001/routes | jq

# View services
curl -s kong-admin.kong:8001/services | jq

# View plugins
curl -s kong-admin.kong:8001/plugins | jq
```

### References

- [Kong Documentation](https://docs.konghq.com/)
- [Kong Best Practices](https://docs.konghq.com/gateway/latest/production/)
- [WARP API OpenAPI Spec](../../../warp/api/openapi.yaml)