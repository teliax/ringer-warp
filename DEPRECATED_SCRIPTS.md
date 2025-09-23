# Deprecated Scripts and Configurations

**Date**: 2025-09-23  
**Reason**: Migration to NGINX Ingress completed, LoadBalancer-specific scripts no longer needed

## Scripts to Archive

### 1. LoadBalancer Diagnostic Scripts

These scripts were created during the LoadBalancer setup phase and are no longer needed:

#### `/kubernetes/network-diagnostics/fix-loadbalancer.sh`
- **Purpose**: Fixed LoadBalancer IP allocation issues
- **Status**: DEPRECATED - Using NGINX Ingress now
- **Action**: Move to `/archive/scripts/loadbalancer/`

#### `/kubernetes/network-diagnostics/check-network-connectivity.sh`
- **Purpose**: Diagnosed LoadBalancer connectivity
- **Status**: May still be useful for general networking
- **Action**: Keep, but update to remove LoadBalancer-specific checks

### 2. Migration Scripts

These scripts were used for the one-time migration:

#### `/kubernetes/services/scripts/migrate-services.sh`
- **Purpose**: Migrated services from LoadBalancer to ClusterIP
- **Status**: Migration complete
- **Action**: Move to `/archive/scripts/migration/`

#### `/kubernetes/services/scripts/rollback-services.sh`
- **Purpose**: Rollback script for migration
- **Status**: No longer needed
- **Action**: Move to `/archive/scripts/migration/`

### 3. SSL Test Scripts (Keep but Update)

These scripts are still useful but need updates:

#### `/kubernetes/ssl/scripts/test-ssl-setup.sh`
- **Purpose**: Tests SSL configuration
- **Status**: Still useful
- **Action**: Update to focus on Ingress-based SSL

#### `/kubernetes/ssl/scripts/deploy-ssl-automated.sh`
- **Purpose**: Automated SSL deployment
- **Status**: Still useful
- **Action**: Keep - core functionality still valid

## Configurations to Update

### 1. Service Definitions

Remove or update any service definitions that still reference LoadBalancer type for monitoring services:

```yaml
# OLD (remove these patterns)
spec:
  type: LoadBalancer
  loadBalancerIP: x.x.x.x

# NEW (use these patterns)  
spec:
  type: ClusterIP
```

### 2. Ingress Definitions

Ensure all Ingress resources use the consolidated NGINX controller:

```yaml
metadata:
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
```

## Archive Structure

Create the following archive structure:

```
/archive/
├── scripts/
│   ├── loadbalancer/
│   │   ├── fix-loadbalancer.sh
│   │   └── README.md
│   └── migration/
│       ├── migrate-services.sh
│       ├── rollback-services.sh
│       └── README.md
└── configs/
    └── old-loadbalancer-configs/
        └── README.md
```

## Archival Commands

```bash
# Create archive directories
mkdir -p /home/daldworth/repos/ringer-warp/archive/scripts/loadbalancer
mkdir -p /home/daldworth/repos/ringer-warp/archive/scripts/migration
mkdir -p /home/daldworth/repos/ringer-warp/archive/configs/old-loadbalancer-configs

# Move LoadBalancer scripts
mv kubernetes/network-diagnostics/fix-loadbalancer.sh archive/scripts/loadbalancer/
mv kubernetes/services/scripts/migrate-services.sh archive/scripts/migration/
mv kubernetes/services/scripts/rollback-services.sh archive/scripts/migration/

# Create README files
echo "# Archived LoadBalancer Scripts

These scripts were used during the initial LoadBalancer setup phase.
They are no longer needed as we've migrated to NGINX Ingress.

Archived on: 2025-09-23" > archive/scripts/loadbalancer/README.md

echo "# Archived Migration Scripts

These scripts were used for the one-time migration from LoadBalancer to Ingress.
Migration completed successfully on 2025-09-23.

Archived for historical reference." > archive/scripts/migration/README.md
```

## Scripts to Keep and Update

The following scripts should be kept but updated to remove LoadBalancer references:

1. **deploy.sh** - Main deployment script
2. **monitor-certificates.sh** - Certificate monitoring
3. **test-ssl-connectivity.sh** - SSL testing
4. **quick-start.sh** - Quick start guide

## Validation After Archival

1. Ensure no active scripts reference archived files:
```bash
grep -r "fix-loadbalancer\|migrate-services\|rollback-services" kubernetes/
```

2. Verify all services still functioning:
```bash
kubectl get svc --all-namespaces
kubectl get ingress --all-namespaces
```

3. Check that documentation is updated:
```bash
grep -r "LoadBalancer" docs/ --include="*.md" | grep -v "Kamailio"
```

## Notes

- Keep LoadBalancer references for Kamailio services (they legitimately need LoadBalancer type)
- Update any documentation that references the archived scripts
- Consider creating a "lessons learned" document about the LoadBalancer to Ingress migration

---

**Completed by**: _____________  
**Date**: _____________  
**Reviewed by**: _____________