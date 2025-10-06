# Kubernetes Configuration Migration Summary

## Changes Made

### 1. Cluster Information Updated
- **Old Cluster**: `warp-dev-kamailio-cluster` in project `ringer-472421`
- **New Cluster**: `warp-cluster` in project `ringer-warp-v01`
- **Region**: `us-central1` (unchanged)

### 2. Deployment Script Updates (`deploy.sh`)
- Updated default project ID to `ringer-warp-v01`
- Updated default cluster name to `warp-cluster`
- Added command-line argument parsing for flexibility
- Added support for both dev and prod environments
- Added help documentation (`-h` or `--help`)

### 3. Production Environment Created
Created new production overlay at `overlays/prod/` with:
- `kustomization.yaml` - Production-specific configuration
- `patches/kamailio-prod-patch.yaml` - Kamailio production settings
- `patches/jasmin-prod-patch.yaml` - Jasmin production settings
- `patches/configmap-prod-patch.yaml` - Common config for production
- `secrets/*.env.example` - Example secret files

### 4. Production Improvements
- **Higher replica counts**: Kamailio (3), Jasmin (2)
- **Increased resources**: More CPU and memory for production workloads
- **Pod anti-affinity**: Ensures pods spread across nodes for HA
- **Health checks**: Liveness and readiness probes configured
- **Production logging**: Set to INFO level instead of DEBUG

### 5. Documentation Created
- `DEPLOYMENT_INSTRUCTIONS.md` - Complete deployment guide
- `CLUSTER_MIGRATION_SUMMARY.md` - This summary document
- `.gitignore` - Ensures secrets aren't committed

## No Changes Required
The following components didn't require updates as they don't contain cluster-specific information:
- Base Kubernetes manifests (deployments, services, configmaps)
- Namespace definitions
- Service configurations
- Consul service registrations

## Deployment Commands

### Development Deployment
```bash
cd /home/daldworth/repos/ringer-warp/kubernetes
./deploy.sh --environment dev
```

### Production Deployment
```bash
cd /home/daldworth/repos/ringer-warp/kubernetes
./deploy.sh --environment prod
```

## Next Steps
1. Configure secret files in both `overlays/dev/secrets/` and `overlays/prod/secrets/`
2. Ensure the GKE cluster `warp-cluster` is created in `ringer-warp-v01`
3. Deploy to development first to test
4. Deploy to production once verified