# SMPP Gateway Deployment Status
**Date:** October 10, 2025
**Version:** v1.1.0
**Cluster:** warp-cluster (GKE Private, us-central1)

## ✅ Infrastructure Complete

### Network Configuration
- **Outbound IP:** 34.58.165.135 (Cloud NAT, verified working)
- **Inbound IP:** 34.55.43.157 (LoadBalancer for customer traffic)
- **GKE Cluster:** Private nodes with Cloud NAT enabled
- **Namespace:** `messaging`

### Deployed Components
| Component | Status | Version | Replicas |
|-----------|--------|---------|----------|
| **SMPP Gateway** | Running (not ready) | v1.1.0 | 3/3 |
| **Redis** | Running | 7.2-alpine | 1/1 |
| **PostgreSQL** | Running (Cloud SQL) | PostgreSQL 14 | - |

### SMPP Gateway Features
- ✅ PostgreSQL integration for dynamic vendor config
- ✅ Redis integration for DLR tracking
- ✅ TLS support for vendor connections
- ✅ Prometheus metrics endpoint (/metrics)
- ✅ Health/Ready endpoints
- ✅ Automatic vendor connection retry (5s interval)
- ✅ DB-driven configuration (no rebuilds needed)

## ⏸️ Pending: Sinch Connection

### Current Issue
**Vendor:** Sinch Atlanta
**Status:** Disconnected (EOF after TLS handshake)
**Error:** `"failed to create session: EOF"`

### Connection Details
```
Host: msgbrokersmpp-atl.inteliquent.com
Port: 3601 (TLS)
System ID: telxMBa1
Password: 7C8Rx9{A
System Type: ESME
```

### What's Working
- ✅ TLS handshake completes successfully
- ✅ Static IP 34.58.165.135 is being used consistently
- ✅ Gateway connects to PostgreSQL and Redis
- ✅ Vendor configuration loaded from database

### What's Not Working
- ❌ Sinch closes connection (EOF) immediately after TLS handshake
- ❌ SMPP bind PDU exchange never happens
- ❌ Pods remain "not ready" (0/3) due to no vendors connected

### Root Cause Analysis
The EOF occurs **after** TLS handshake succeeds, which proves:
1. IP whitelisting is working (34.58.165.135 is accepted by Sinch)
2. Network connectivity is fine
3. TLS configuration is correct

The issue is during the SMPP protocol handshake:
- Sinch accepts the TCP+TLS connection
- But closes it immediately during or before the SMPP bind request

Possible causes:
1. **Sinch configuration delay:** New IP not fully activated on their systems
2. **Credential mismatch:** System ID/Password/System Type not matching their records
3. **SMPP version mismatch:** Sinch expecting different SMPP protocol version
4. **Bind type issue:** Using transceiver (TRX) but Sinch expects transmitter/receiver

### Next Steps
1. **Contact Sinch Support:**
   - Verify 34.58.165.135 is fully activated
   - Confirm credentials: telxMBa1 / 7C8Rx9{A / ESME
   - Ask for any recent config changes or requirements
   - Request server-side logs showing the failed bind attempt

2. **Technical Verification:**
   - Test with different system_type values (ESME, cp, smpp, empty string)
   - Test with transmitter (TX) instead of transceiver (TRX) bind mode
   - Capture network traffic to see exact SMPP PDU being sent

3. **Alternative Testing:**
   - Test connection from different cluster/IP if needed
   - Use Sinch's test credentials if available

## 📊 Current Metrics

### Gateway Health
```bash
kubectl exec -n messaging smpp-gateway-764f956897-296h9 -- \
  wget -qO- http://localhost:8080/api/v1/vendors
```

Response:
```json
{
  "success": true,
  "vendors": {
    "9e22660d-6f2e-4761-8729-f4272d30eb71": {
      "vendor_id": "9e22660d-6f2e-4761-8729-f4272d30eb71",
      "vendor_name": "Sinch_Atlanta",
      "status": "disconnected",
      "connected_at": "0001-01-01T00:00:00Z",
      "last_error": "EOF",
      "messages_sent": 0,
      "messages_success": 0,
      "messages_failed": 0,
      "dlrs_received": 0
    }
  },
  "count": 1
}
```

### Readiness Probe
The gateway uses intelligent readiness checks:
- Returns 503 if **no vendors** are connected
- Returns 200 when **at least one** vendor is connected

This is correct behavior - the gateway shouldn't be "ready" if it can't route messages.

## 🔧 Configuration Changes

### Database Schema Updates
```sql
-- Added to vendor_mgmt.service_providers
ALTER TABLE vendor_mgmt.service_providers
  ADD COLUMN username VARCHAR(100),
  ADD COLUMN password VARCHAR(255),
  ADD COLUMN system_type VARCHAR(20);
```

### Current Vendor Configuration
```sql
SELECT instance_name, host, port, username, system_type, is_active
FROM vendor_mgmt.service_providers
WHERE instance_name = 'Sinch_Atlanta';
```

Result:
```
instance_name   | Sinch_Atlanta
host            | msgbrokersmpp-atl.inteliquent.com
port            | 3601
username        | telxMBa1
system_type     | ESME
is_active       | true
```

## 📝 Architectural Decisions

### Why Private GKE Cluster?
**Problem:** GKE Autopilot public nodes have external IPs and bypass Cloud NAT.
**Solution:** Private cluster where nodes **must** use Cloud NAT for outbound traffic.
**Result:** Consistent static IP (34.58.165.135) for all pod outbound connections.

### Why DB-Driven Config?
**Problem:** Hardcoded credentials require docker rebuilds for changes.
**Solution:** All vendor auth loaded from PostgreSQL at startup.
**Result:** Update credentials via SQL + pod restart (no image rebuild needed).

### Why Redis for DLR Tracking?
**Problem:** DLRs arrive asynchronously and need fast lookup.
**Solution:** Redis for in-memory DLR tracking with TTL.
**Result:** Sub-millisecond DLR lookups, automatic cleanup.

## 🚀 Deployment Commands

### View Logs
```bash
kubectl logs -n messaging -l app=smpp-gateway --tail=50 -f
```

### Check Vendor Status
```bash
kubectl exec -n messaging <pod-name> -- \
  wget -qO- http://localhost:8080/api/v1/vendors | jq .
```

### Update Credentials
```sql
UPDATE vendor_mgmt.service_providers
SET
  username = 'new_system_id',
  password = 'new_password',
  system_type = 'new_type'
WHERE instance_name = 'Sinch_Atlanta';
```

Then restart:
```bash
kubectl rollout restart deployment/smpp-gateway -n messaging
```

### Scale Replicas
```bash
kubectl scale deployment/smpp-gateway -n messaging --replicas=5
```

## 📈 Next Priorities

1. **Resolve Sinch Connection** (blocking)
2. Deploy Kamailio SIP proxy
3. Deploy Prometheus/Grafana monitoring
4. Configure RabbitMQ for message queuing (if needed)
5. Deploy customer-facing SMPP server (port 2775/2776)
6. Load testing and performance tuning

## 📚 Related Documentation
- [client.go](internal/connectors/client.go:61-143) - Sinch connection logic
- [api.go](internal/api/api.go:109-134) - Readiness check implementation
- [CLAUDE.md](../../CLAUDE.md) - Project overview and commands
- [deployment.yaml](deployments/kubernetes/deployment.yaml) - K8s configuration
