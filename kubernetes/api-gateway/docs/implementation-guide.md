# Kong API Gateway Implementation Guide

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Deployment](#deployment)
4. [Configuration](#configuration)
5. [API Management](#api-management)
6. [Security](#security)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

## Overview

Kong is a cloud-native, platform-agnostic API Gateway that provides advanced features for managing, securing, and monitoring APIs. This guide covers the implementation of Kong for the WARP telecommunications platform.

## Architecture

### Components

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Load Balancer  │────▶│   Kong Gateway  │────▶│  Backend APIs   │
│   (GCP/Nginx)   │     │   (3 replicas)  │     │  (WARP, SIP)   │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 │
                        ┌────────▼────────┐
                        │                 │
                        │   PostgreSQL    │
                        │   (Kong DB)     │
                        │                 │
                        └─────────────────┘
```

### Network Flow

1. **Client Request** → Load Balancer (port 80/443)
2. **TLS Termination** → Kong Gateway
3. **Authentication** → JWT/API Key validation
4. **Rate Limiting** → Per-consumer/IP limits
5. **Request Routing** → Backend service selection
6. **Response** → Transform and return to client

## Deployment

### Prerequisites

- Kubernetes cluster (GKE recommended)
- kubectl configured
- cert-manager installed
- Prometheus/Grafana (optional)

### Quick Start

```bash
# Deploy Kong
cd kubernetes/api-gateway
./scripts/deploy-kong.sh

# Verify deployment
kubectl get pods -n kong
kubectl get svc -n kong

# Check Kong status
kubectl exec -it deploy/kong-gateway -n kong -- curl http://localhost:8001/status
```

### Production Deployment

1. **Update Secrets**
   ```bash
   # Generate strong database password
   kubectl create secret generic postgres-secret \
     --from-literal=POSTGRES_PASSWORD=$(openssl rand -base64 32) \
     -n kong
   ```

2. **Configure TLS**
   ```yaml
   # Update kong/05-kong-ingress.yaml with production certificates
   spec:
     tls:
     - hosts:
       - api.ringer.tel
       secretName: api-gateway-tls-prod
   ```

3. **Scale for Production**
   ```bash
   # Scale Kong replicas
   kubectl scale deployment kong-gateway -n kong --replicas=5
   
   # Update HPA limits
   kubectl patch hpa kong-gateway-hpa -n kong --type='json' -p='[
     {"op": "replace", "path": "/spec/maxReplicas", "value": 20}
   ]'
   ```

## Configuration

### Service Configuration

Create a service in Kong for the WARP API:

```bash
curl -i -X POST http://kong-admin.kong:8001/services \
  --data name=warp-api \
  --data url=http://warp-api.warp-api:8080
```

### Route Configuration

Add routes for the service:

```bash
curl -i -X POST http://kong-admin.kong:8001/services/warp-api/routes \
  --data 'paths[]=/v1' \
  --data 'hosts[]=api.ringer.tel' \
  --data 'methods[]=GET' \
  --data 'methods[]=POST' \
  --data 'methods[]=PUT' \
  --data 'methods[]=DELETE'
```

### Plugin Configuration

#### JWT Authentication

```bash
curl -i -X POST http://kong-admin.kong:8001/services/warp-api/plugins \
  --data name=jwt \
  --data config.header_names=Authorization \
  --data config.claims_to_verify=exp \
  --data config.maximum_expiration=3600
```

#### Rate Limiting

```bash
# Global rate limit
curl -i -X POST http://kong-admin.kong:8001/plugins \
  --data name=rate-limiting \
  --data config.minute=1000 \
  --data config.hour=10000 \
  --data config.policy=local

# Per-consumer rate limit
curl -i -X POST http://kong-admin.kong:8001/consumers/{consumer}/plugins \
  --data name=rate-limiting \
  --data config.minute=100 \
  --data config.hour=5000
```

#### CORS Configuration

```bash
curl -i -X POST http://kong-admin.kong:8001/services/warp-api/plugins \
  --data name=cors \
  --data config.origins=https://app.ringer.tel \
  --data config.methods=GET,POST,PUT,DELETE,OPTIONS \
  --data config.headers=Accept,Authorization,Content-Type,X-API-Key \
  --data config.credentials=true
```

## API Management

### Consumer Management

1. **Create Consumer**
   ```bash
   curl -i -X POST http://kong-admin.kong:8001/consumers \
     --data username=customer-12345 \
     --data custom_id=12345
   ```

2. **Add API Key**
   ```bash
   curl -i -X POST http://kong-admin.kong:8001/consumers/customer-12345/key-auth \
     --data key=custom-api-key-here
   ```

3. **Add JWT Credentials**
   ```bash
   curl -i -X POST http://kong-admin.kong:8001/consumers/customer-12345/jwt \
     --data key=issuer-key \
     --data algorithm=HS256 \
     --data secret=your-secret-here
   ```

### ACL Groups

```bash
# Create ACL group
curl -i -X POST http://kong-admin.kong:8001/consumers/customer-12345/acls \
  --data group=premium-customers

# Apply ACL plugin to route
curl -i -X POST http://kong-admin.kong:8001/routes/{route_id}/plugins \
  --data name=acl \
  --data config.allow=premium-customers
```

## Security

### IP Whitelisting

For SIP trunk endpoints:

```bash
curl -i -X POST http://kong-admin.kong:8001/services/sip-trunks/plugins \
  --data name=ip-restriction \
  --data config.allow=192.168.1.0/24 \
  --data config.allow=10.0.0.0/8
```

### Request Validation

```bash
# Add request validation plugin
curl -i -X POST http://kong-admin.kong:8001/services/warp-api/plugins \
  --data name=request-validator \
  --data config.body_schema=@openapi-schema.json
```

### Security Headers

```bash
curl -i -X POST http://kong-admin.kong:8001/services/warp-api/plugins \
  --data name=response-transformer \
  --data config.add.headers="X-Frame-Options:SAMEORIGIN" \
  --data config.add.headers="X-Content-Type-Options:nosniff" \
  --data config.add.headers="Strict-Transport-Security:max-age=31536000"
```

## Monitoring

### Prometheus Metrics

Kong exposes metrics at `/metrics` endpoint:

```bash
# View raw metrics
curl -s http://kong-admin.kong:8001/metrics

# Key metrics to monitor:
# - kong_http_requests_total
# - kong_request_duration_ms
# - kong_upstream_target_health
# - kong_memory_lua_shared_dict_bytes
```

### Grafana Dashboards

Import the provided dashboard:
```bash
kubectl apply -f kubernetes/api-gateway/kong/08-monitoring.yaml
```

Access at: https://grafana.ringer.tel/d/kong-gateway

### Alerts

Key alerts configured:
- High error rate (> 5%)
- High latency (> 1000ms p95)
- Rate limit violations
- Database connectivity issues
- High memory usage (> 80%)

## Troubleshooting

### Common Issues

#### 1. Kong Won't Start

```bash
# Check logs
kubectl logs -n kong deploy/kong-gateway

# Common causes:
# - Database connection issues
# - Missing migrations
# - Invalid configuration
```

#### 2. Authentication Failures

```bash
# Check plugin configuration
curl http://kong-admin.kong:8001/plugins

# Verify consumer credentials
curl http://kong-admin.kong:8001/consumers/{username}/jwt
```

#### 3. Performance Issues

```bash
# Check worker processes
kubectl exec -n kong deploy/kong-gateway -- ps aux | grep nginx

# Increase workers if needed
kubectl set env deploy/kong-gateway -n kong KONG_NGINX_WORKER_PROCESSES=4
```

### Debug Mode

Enable debug logging:
```bash
kubectl set env deploy/kong-gateway -n kong KONG_LOG_LEVEL=debug
```

### Health Checks

```bash
# Kong health
curl -i http://kong-proxy.kong:8100/status

# Database connectivity
kubectl exec -n kong deploy/kong-gateway -- kong health
```

## Best Practices

### 1. Configuration as Code

Store all Kong configuration in Git:
```yaml
# kong-config.yaml
services:
- name: warp-api
  url: http://warp-api:8080
  routes:
  - paths: ["/v1"]
    methods: ["GET", "POST", "PUT", "DELETE"]
  plugins:
  - name: rate-limiting
    config:
      minute: 1000
```

Apply using decK:
```bash
deck sync --kong-addr http://kong-admin.kong:8001 -s kong-config.yaml
```

### 2. Backup and Recovery

```bash
# Backup database
kubectl exec -n kong postgres-0 -- pg_dump -U kong > kong-backup.sql

# Backup configuration
deck dump --kong-addr http://kong-admin.kong:8001 > kong-config-backup.yaml
```

### 3. Performance Tuning

```yaml
# Optimal Kong settings for production
env:
- name: KONG_NGINX_WORKER_PROCESSES
  value: "auto"  # One per CPU core
- name: KONG_UPSTREAM_KEEPALIVE_POOL_SIZE
  value: "200"
- name: KONG_UPSTREAM_KEEPALIVE_MAX_REQUESTS
  value: "100000"
- name: KONG_NGINX_HTTP2_MAX_FIELD_SIZE
  value: "16k"
```

### 4. Security Hardening

- Always use TLS for admin API
- Implement network policies
- Regular security updates
- Audit log analysis
- Principle of least privilege for consumers

### 5. Monitoring and Alerting

- Set up comprehensive dashboards
- Configure proactive alerts
- Regular performance reviews
- Capacity planning based on metrics

## Next Steps

1. Complete the migration from nginx
2. Import full OpenAPI specification
3. Set up developer portal
4. Implement custom plugins if needed
5. Plan for disaster recovery

## Resources

- [Kong Documentation](https://docs.konghq.com/)
- [Kong Hub (Plugins)](https://docs.konghq.com/hub/)
- [Kong Nation Community](https://discuss.konghq.com/)
- [WARP API Specification](../../../warp/api/openapi.yaml)

## Support

For issues or questions:
- Internal: #kong-support channel
- Kong Enterprise Support: support@konghq.com
- Documentation: https://docs.konghq.com/