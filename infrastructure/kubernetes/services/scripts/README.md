# LoadBalancer Cleanup Scripts

This directory contains scripts to safely clean up deprecated LoadBalancers in the Kubernetes cluster to reduce costs.

## Overview

With the deployment of NGINX Ingress, several LoadBalancer services are no longer needed:
- Duplicate Kamailio services in `warp-core` namespace
- Monitoring service LoadBalancers (now use Ingress)
- Any deprecated API gateway LoadBalancers

**Expected savings**: ~$60/month (~$720/year)

## Scripts

### 1. `check-loadbalancers.sh`
Quick status check to see current LoadBalancers and what would be removed.

```bash
./check-loadbalancers.sh
```

### 2. `cleanup-loadbalancers.sh`
Main cleanup script with safety features:
- Creates backups before deletion
- Checks for dependencies
- Confirmation prompts
- Dry-run mode

```bash
# Dry run (show what would be deleted)
./cleanup-loadbalancers.sh --dry-run

# Actual cleanup with prompts
./cleanup-loadbalancers.sh

# Skip confirmation prompts (use with caution)
./cleanup-loadbalancers.sh --yes
```

### 3. `rollback-loadbalancers.sh`
Emergency rollback script if issues arise:
- Restore from backup files
- Manual recreation of specific services

```bash
./rollback-loadbalancers.sh
```

## What Will Be Kept

These LoadBalancers are essential and will NOT be deleted:
1. `ingress-nginx/ingress-nginx-controller` - Handles all HTTP/HTTPS traffic
2. `ringer-warp-v01/kamailio-sip-tcp` - Primary SIP TCP service
3. `ringer-warp-v01/kamailio-sip-udp` - Primary SIP UDP service

## What Will Be Deleted

1. **Duplicate Kamailio services** in `warp-core` namespace:
   - `kamailio-sip-tcp` (34.41.176.225)
   - `kamailio-sip-udp` (34.61.253.247)

2. **Any monitoring LoadBalancers** (should use Ingress):
   - Prometheus
   - Grafana
   - Alertmanager
   - Loki

3. **Deprecated API gateway LoadBalancers**

## Usage Workflow

1. **Check current state**:
   ```bash
   ./check-loadbalancers.sh
   ```

2. **Perform dry run**:
   ```bash
   ./cleanup-loadbalancers.sh --dry-run
   ```

3. **Execute cleanup**:
   ```bash
   ./cleanup-loadbalancers.sh
   ```

4. **Verify results**:
   - Check remaining LoadBalancers
   - Monitor application health
   - Verify cost reduction in GCP billing

5. **If issues arise**:
   ```bash
   ./rollback-loadbalancers.sh
   ```

## Backups

Backups are automatically created in `./loadbalancer-backups/` with timestamp.

To manually restore a backup:
```bash
kubectl apply -f ./loadbalancer-backups/loadbalancer-backup-YYYYMMDD-HHMMSS.yaml
```

## Post-Cleanup Verification

After cleanup, verify:
1. Only 3 LoadBalancers remain (NGINX + 2 Kamailio)
2. All services are accessible
3. No errors in logs
4. GCP forwarding rules updated

## Safety Notes

- The cleanup is safe to perform during business hours
- Only removes duplicate/unused services
- Primary services remain unaffected
- Always creates backup before deletion
- Includes dependency checks