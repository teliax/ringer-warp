# Service Type Migration Guide: LoadBalancer to ClusterIP

## Overview

This guide documents the migration process for Kubernetes services from LoadBalancer type to ClusterIP type for monitoring services, while keeping Kamailio services as LoadBalancer for direct external access.

## Current State Analysis

### Monitoring Services (Already ClusterIP)
- **Namespace**: `monitoring`
- **Services**:
  - `warp-monitoring-grafana` - ClusterIP (10.2.106.186)
  - `warp-monitoring-prometheus` - ClusterIP (10.2.43.45)
  - `warp-monitoring-alertmanager` - ClusterIP (10.2.26.174)

### Kamailio Services (Must Remain LoadBalancer)
- **Namespaces**: `ringer-warp-v01`, `warp-core`
- **Services**:
  - `kamailio-sip-tcp` - LoadBalancer (External IPs assigned)
  - `kamailio-sip-udp` - LoadBalancer (External IPs assigned)
  - `kamailio-udp-nodeport` - NodePort (for additional access)

### Ingress Configuration
- **grafana-ingress**: grafana.ringer.tel → warp-monitoring-grafana:80
- **prometheus-ingress**: prometheus.ringer.tel → warp-monitoring-prometheus:9090

## Certificate Status

As of the migration start:
- `prometheus-tls`: Ready ✓
- `grafana-tls`: Not Ready (pending issuance)

## Migration Scripts

### 1. Main Migration Script
**Location**: `/kubernetes/services/scripts/migrate-services.sh`

**Features**:
- Automatic backup before changes
- Service type migration
- LoadBalancer annotation cleanup
- Connectivity testing
- Certificate status monitoring

**Usage**:
```bash
cd /home/daldworth/repos/ringer-warp/kubernetes/services/scripts/
./migrate-services.sh
```

### 2. Rollback Script
**Location**: `/kubernetes/services/scripts/rollback-services.sh`

**Features**:
- Interactive and command-line modes
- Rollback by timestamp
- Rollback specific services
- List available backups

**Usage**:
```bash
# Interactive mode
./rollback-services.sh

# Command-line options
./rollback-services.sh --list                           # List backups
./rollback-services.sh --timestamp 20250923_150000     # Rollback by timestamp
./rollback-services.sh --service monitoring grafana    # Rollback specific service
./rollback-services.sh --file ../backups/backup.yaml   # Rollback from file
```

### 3. Certificate Monitoring Script
**Location**: `/kubernetes/services/scripts/monitor-certificates.sh`

**Features**:
- Certificate status checking
- ACME challenge monitoring
- Domain connectivity testing
- SSL certificate validation
- Continuous monitoring mode

**Usage**:
```bash
# Single check
./monitor-certificates.sh --once

# Continuous monitoring (30s interval)
./monitor-certificates.sh --continuous

# Custom interval
MONITORING_INTERVAL=60 ./monitor-certificates.sh --continuous
```

## Migration Process

### Pre-Migration Checklist
- [x] Verify kubectl connectivity
- [x] Check current service types
- [x] Verify Ingress configuration
- [x] Document external IPs for Kamailio services
- [x] Create backup directory structure

### Migration Steps

1. **Monitor Certificate Status**
   ```bash
   ./monitor-certificates.sh --continuous
   ```
   Wait for all certificates to be in "Ready" state.

2. **Run Migration Script**
   ```bash
   ./migrate-services.sh
   ```
   The script will:
   - Backup current configurations
   - Apply patches to change service types
   - Remove LoadBalancer-specific annotations
   - Test connectivity
   - Generate migration report

3. **Verify Access**
   - Test HTTPS access: https://grafana.ringer.tel
   - Test HTTPS access: https://prometheus.ringer.tel
   - Check certificate validity

4. **Monitor Services**
   ```bash
   # Check service status
   kubectl get svc -n monitoring
   
   # Check endpoints
   kubectl get endpoints -n monitoring
   
   # Check Ingress
   kubectl get ingress -n monitoring
   ```

### Post-Migration Verification

1. **Service Type Verification**
   ```bash
   kubectl get svc -n monitoring -o custom-columns=NAME:.metadata.name,TYPE:.spec.type
   ```

2. **Connectivity Testing**
   ```bash
   # From within cluster
   kubectl run test-pod --rm -it --image=busybox -- wget -qO- http://warp-monitoring-grafana.monitoring.svc.cluster.local
   
   # From external
   curl -I https://grafana.ringer.tel
   curl -I https://prometheus.ringer.tel
   ```

3. **Certificate Validation**
   ```bash
   # Check certificate
   openssl s_client -connect grafana.ringer.tel:443 -servername grafana.ringer.tel < /dev/null
   ```

## Rollback Procedure

If issues arise, rollback immediately:

1. **Quick Rollback** (most recent backup)
   ```bash
   ./rollback-services.sh --service monitoring warp-monitoring-grafana
   ```

2. **Full Rollback** (by timestamp)
   ```bash
   ./rollback-services.sh --timestamp 20250923_HHMMSS
   ```

## Troubleshooting

### Certificate Issues

1. **Pending Challenges**
   ```bash
   kubectl get challenges --all-namespaces
   kubectl describe challenge <challenge-name> -n <namespace>
   ```

2. **Certificate Not Ready**
   ```bash
   kubectl describe certificate grafana-tls -n monitoring
   kubectl logs -n cert-manager -l app.kubernetes.io/name=cert-manager
   ```

### Connectivity Issues

1. **Service Not Accessible**
   ```bash
   # Check endpoints
   kubectl get endpoints <service-name> -n monitoring
   
   # Check pod status
   kubectl get pods -n monitoring -l app.kubernetes.io/name=<app-name>
   ```

2. **Ingress Issues**
   ```bash
   # Check Ingress controller
   kubectl get pods -n ingress-nginx
   kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
   ```

## Important Notes

1. **Kamailio Services**: These MUST remain as LoadBalancer type because:
   - They require direct UDP/TCP access from external SIP clients
   - SIP protocol doesn't work well behind HTTP proxies
   - RTP media streams need direct connectivity

2. **Monitoring Services**: Can use ClusterIP because:
   - HTTP/HTTPS traffic works well through Ingress
   - No special protocol requirements
   - Better security (not directly exposed)

3. **Certificate Management**:
   - Let's Encrypt staging certificates are for testing
   - Production certificates have rate limits
   - DNS propagation may take time

## Directory Structure

```
/kubernetes/services/
├── backups/                 # Service backup files
├── patches/                 # Service patch files
├── scripts/
│   ├── migrate-services.sh      # Main migration script
│   ├── rollback-services.sh     # Rollback utility
│   └── monitor-certificates.sh  # Certificate monitoring
└── MIGRATION_GUIDE.md      # This file
```

## Migration Log Files

All operations are logged with timestamps:
- `migration_YYYYMMDD_HHMMSS.log` - Migration operations
- `rollback_YYYYMMDD_HHMMSS.log` - Rollback operations
- `cert_monitor_YYYYMMDD_HHMMSS.log` - Certificate monitoring

## Support Information

For issues or questions:
1. Check the migration logs in the scripts directory
2. Review Kubernetes events: `kubectl get events -n monitoring --sort-by='.lastTimestamp'`
3. Check Ingress controller logs
4. Verify DNS resolution for domains