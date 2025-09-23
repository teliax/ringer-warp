# Kamailio Docker Image for WARP Platform

This directory contains the production-ready Kamailio Docker image for the WARP telecommunications platform.

## Overview

The Kamailio image provides:
- SIP server with PostgreSQL backend
- WebSocket support for WebRTC clients  
- TLS/SRTP for secure communications
- RTPEngine integration for media handling
- High-performance LCR routing with Lua
- Prometheus metrics for monitoring
- Health checks for Kubernetes

## Quick Start

### Building the Image

```bash
# Build the Docker image
./build-and-deploy.sh

# Build with custom tag
./build-and-deploy.sh v1.0.0

# Build and deploy to Kubernetes
./build-and-deploy.sh latest deploy

# Build and create database schema
./build-and-deploy.sh latest deploy init-db
```

### Manual Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f ../../k8s/kamailio/deployment.yaml

# Check deployment status
kubectl get pods -n warp-sip -l app=kamailio

# View logs
kubectl logs -n warp-sip -l app=kamailio
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | 34.42.208.57 |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | Database name | warp |
| `DB_USER` | Database user | warp |
| `DB_PASS` | Database password | (from secret) |
| `SIP_DOMAIN` | SIP domain | ringer.tel |
| `PUBLIC_IP` | Public IP for SIP | (auto-detected) |
| `PRIVATE_IP` | Private IP | (auto-detected) |
| `WEBSOCKET_PORT` | WebSocket port | 8080 |
| `TLS_PORT` | SIP TLS port | 5061 |
| `RTPENGINE_LIST` | RTPEngine servers | udp:rtpengine:2223 |
| `LOG_LEVEL` | Log level (0-4) | 2 |
| `WARP_API_URL` | WARP API endpoint | http://api-gateway:8080 |

### Database Schema

The Kamailio database schema includes:
- `subscriber` - User authentication
- `location` - User registrations
- `trusted` - Trusted IP addresses
- `dispatcher` - Carrier endpoints
- `acc` - Call detail records
- `dialog` - Active calls
- `ip_acl` - Customer IP ACLs

Initialize the database:
```bash
# Generate schema SQL
./build-and-deploy.sh latest deploy init-db

# Apply schema
PGPASSWORD=<password> psql -h 34.42.208.57 -U warp -d warp -f kamailio-schema.sql
```

## Features

### 1. Multi-Protocol Support
- UDP/TCP on port 5060
- TLS on port 5061  
- WebSocket on port 8080
- Secure WebSocket on port 8443

### 2. Authentication Methods
- IP ACL (trusted IPs)
- SIP digest authentication
- Customer context loading

### 3. Routing Features
- High-performance LCR with Lua
- API-based routing with caching
- Fallback routing when API unavailable
- Number portability (LRN) lookups
- Carrier failover support

### 4. Media Handling
- RTPEngine integration
- WebRTC support (DTLS/SRTP)
- Codec transcoding
- NAT traversal

### 5. Monitoring
- Prometheus metrics endpoint
- Health checks
- Call statistics
- Performance metrics

## Architecture

```
┌─────────────────┐
│   SIP Clients   │
└────────┬────────┘
         │
    ┌────▼────┐
    │   LB    │ Load Balancer
    └────┬────┘
         │
┌────────┴────────────┐
│  Kamailio Cluster   │
│  ┌──────────────┐   │
│  │ Kamailio Pod │   │
│  │  - SIP Proxy │   │
│  │  - Registrar │   │
│  │  - LCR Logic │   │
│  └──────┬───────┘   │
└─────────┼───────────┘
          │
     ┌────┴─────┬──────────┐
     │          │          │
┌────▼───┐ ┌───▼────┐ ┌───▼────┐
│  API   │ │  DB    │ │ RTPEng │
│Gateway │ │(PgSQL) │ │(Media) │
└────────┘ └────────┘ └────────┘
```

## Troubleshooting

### Check Kamailio Status
```bash
# Pod status
kubectl get pods -n warp-sip -l app=kamailio

# Container logs
kubectl logs -n warp-sip <pod-name> -c kamailio

# Execute commands in pod
kubectl exec -n warp-sip <pod-name> -- kamctl stats
```

### Common Issues

1. **Database Connection Failed**
   - Check DB_PASS secret is set
   - Verify network connectivity to PostgreSQL
   - Ensure database exists and user has permissions

2. **Registration Failures**
   - Check IP ACL configuration
   - Verify SIP domain matches
   - Review authentication logs

3. **No Audio**
   - Verify RTPEngine is running
   - Check NAT detection
   - Review SDP in SIP messages

### Debug Mode

Enable debug logging:
```bash
kubectl set env deployment/kamailio -n warp-sip LOG_LEVEL=3 ENABLE_DEBUG=1
```

## Performance Tuning

### Memory Settings
- Shared memory: 256MB (default)
- Package memory: 32MB per process
- Children processes: 8

### Connection Limits
- TCP connections: 2048
- UDP buffer: 4MB
- Registration expiry: 600s

### Rate Limiting
- Pike module: 100 requests/10s per IP
- Failed auth tracking
- Automatic IP banning

## Security

### TLS Configuration
- TLS 1.2+ only
- Strong cipher suites
- Certificate verification options

### Access Control
- IP-based ACLs
- SIP digest authentication  
- Customer isolation
- Rate limiting

## Monitoring

### Metrics Available
- Active calls count
- Registered users
- Call rate (CPS)
- Response code distribution
- Memory usage
- TCP connections

### Prometheus Queries
```promql
# Active calls
kamailio_dialog_active_dialogs

# Registration count
kamailio_usrloc_registered_users

# Call rate
rate(kamailio_tm_requests_total{method="INVITE"}[1m])

# Error rate
rate(kamailio_sl_replies_total{code=~"5.."}[5m])
```

## Maintenance

### Rolling Updates
```bash
# Update image
kubectl set image deployment/kamailio kamailio=<new-image> -n warp-sip

# Monitor rollout
kubectl rollout status deployment/kamailio -n warp-sip
```

### Backup Considerations
- Database contains persistent data
- Location table for registrations
- Dialog table for active calls
- ACC table for CDRs

## Integration

### With RTPEngine
- Configured via RTPENGINE_LIST
- Supports multiple RTPEngine instances
- Automatic failover

### With WARP API
- LCR routing decisions
- Number portability lookups
- Customer context
- Rating information

### With Monitoring
- Prometheus ServiceMonitor configured
- Grafana dashboards available
- Alerting rules defined