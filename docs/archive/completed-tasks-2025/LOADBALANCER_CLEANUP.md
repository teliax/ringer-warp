# LoadBalancer Cleanup Plan

**Date**: 2025-09-23  
**Status**: Ready for Execution  
**Impact**: Cost Reduction (~$150/month)

## Overview

With the successful deployment of NGINX Ingress and SSL/TLS certificates, several LoadBalancer services are no longer needed. This document identifies which LoadBalancers can be safely removed.

## Current LoadBalancer Inventory

### Active LoadBalancers (As of 2025-09-23)

```bash
# Current LoadBalancer services in the cluster
ingress-nginx/ingress-nginx-controller    - 34.72.20.183   # REQUIRED - Keep
ringer-warp-v01/kamailio-sip-tcp         - 34.72.244.248  # REQUIRED - Keep  
ringer-warp-v01/kamailio-sip-udp         - 35.188.57.164  # REQUIRED - Keep
warp-core/kamailio-sip-tcp               - 34.41.176.225  # DUPLICATE - Remove
warp-core/kamailio-sip-udp               - 34.61.253.247  # DUPLICATE - Remove
```

## LoadBalancers to Remove

### 1. Duplicate Kamailio Services (warp-core namespace)

**Services**:
- `warp-core/kamailio-sip-tcp` (34.41.176.225)
- `warp-core/kamailio-sip-udp` (34.61.253.247)

**Reason**: These are duplicates of the services in `ringer-warp-v01` namespace

**Removal Command**:
```bash
kubectl delete service kamailio-sip-tcp -n warp-core
kubectl delete service kamailio-sip-udp -n warp-core
```

### 2. Old Monitoring LoadBalancers (if any remain)

**Check for stragglers**:
```bash
kubectl get svc --all-namespaces | grep LoadBalancer | grep -E "(prometheus|grafana|alertmanager|loki)"
```

**Reason**: All monitoring services now use NGINX Ingress with HTTPS

### 3. Deprecated API Gateway LoadBalancer

**Service**: Any LoadBalancer service for the old API gateway (if exists)

**Check**:
```bash
kubectl get svc --all-namespaces | grep -i "api-gateway" | grep LoadBalancer
```

## LoadBalancers to Keep

### 1. NGINX Ingress Controller
- **Service**: `ingress-nginx/ingress-nginx-controller`
- **IP**: 34.72.20.183
- **Purpose**: Handles all HTTP/HTTPS traffic
- **Status**: ✅ REQUIRED

### 2. Kamailio SIP Services (Primary)
- **Services**: 
  - `ringer-warp-v01/kamailio-sip-tcp` (34.72.244.248)
  - `ringer-warp-v01/kamailio-sip-udp` (35.188.57.164)
- **Purpose**: SIP signaling requires direct LoadBalancer access
- **Status**: ✅ REQUIRED

## Verification Steps

### Before Removal

1. **Check Service Dependencies**:
```bash
# Check if any pods reference the services
kubectl get pods --all-namespaces -o yaml | grep -E "(kamailio-sip-tcp|kamailio-sip-udp)" | grep warp-core
```

2. **Verify No Active Connections**:
```bash
# Check endpoints
kubectl get endpoints -n warp-core
```

3. **Check for Ingress References**:
```bash
kubectl get ingress --all-namespaces -o yaml | grep -i "warp-core"
```

### After Removal

1. **Verify Services Deleted**:
```bash
kubectl get svc --all-namespaces | grep LoadBalancer
# Should only show: nginx-ingress and ringer-warp-v01 kamailio services
```

2. **Check GCP Console**:
```bash
gcloud compute forwarding-rules list
# Verify LoadBalancers are removed
```

3. **Monitor Application Health**:
```bash
# Check that SIP services still work via primary namespace
kubectl logs -n ringer-warp-v01 -l app=kamailio --tail=50
```

## Cost Impact

### Current Monthly Costs (Estimated)
- 5 LoadBalancers × ~$30/month = ~$150/month
- After cleanup: 3 LoadBalancers × ~$30/month = ~$90/month
- **Savings**: ~$60/month (~$720/year)

## Migration Commands Summary

```bash
#!/bin/bash
# LoadBalancer Cleanup Script

echo "=== LoadBalancer Cleanup ==="

# 1. Backup current state
kubectl get svc --all-namespaces -o yaml > loadbalancer-backup-$(date +%Y%m%d).yaml

# 2. Delete duplicate Kamailio services
echo "Removing duplicate Kamailio services from warp-core namespace..."
kubectl delete service kamailio-sip-tcp -n warp-core
kubectl delete service kamailio-sip-udp -n warp-core

# 3. Verify remaining LoadBalancers
echo "Remaining LoadBalancers:"
kubectl get svc --all-namespaces | grep LoadBalancer

# 4. Check forwarding rules in GCP
echo "GCP Forwarding Rules:"
gcloud compute forwarding-rules list

echo "=== Cleanup Complete ==="
```

## Rollback Plan

If issues arise after removal:

1. **Restore from Backup**:
```bash
kubectl apply -f loadbalancer-backup-[DATE].yaml
```

2. **Recreate Services Manually**:
```yaml
# Save as emergency-restore.yaml if needed
apiVersion: v1
kind: Service
metadata:
  name: kamailio-sip-tcp
  namespace: warp-core
spec:
  type: LoadBalancer
  ports:
  - name: sip-tcp
    port: 5060
    targetPort: 5060
    protocol: TCP
  selector:
    app: kamailio
```

## Monitoring After Cleanup

1. **Check Service Health**:
   - Grafana: https://grafana.ringer.tel
   - Verify SIP traffic flows
   - Check for any 5xx errors

2. **Cost Monitoring**:
   - Check GCP billing after 24 hours
   - Verify LoadBalancer charges reduced

3. **Application Monitoring**:
   - Ensure no impact to SIP services
   - Verify all HTTP/HTTPS traffic working

## Approval and Execution

- [ ] Reviewed by: Platform Architect
- [ ] Approved by: DevOps Lead
- [ ] Execution Date: ___________
- [ ] Executed by: ___________
- [ ] Verification Complete: ___________

---

**Note**: This cleanup is safe to perform during business hours as it only removes duplicate/unused services. The primary services remain unaffected.