# WARP Platform Kubernetes Deployment Instructions

## Overview

This document provides instructions for deploying the WARP platform services to the new GKE cluster (`warp-cluster`) in the `ringer-warp-v01` project.

## Prerequisites

1. **GKE Cluster**: Ensure the `warp-cluster` is created in the `us-central1` region
2. **kubectl**: Installed and configured
3. **gcloud**: Authenticated with the correct project
4. **Secrets**: All secret files configured (see below)

## Cluster Configuration Updates

All Kubernetes manifests have been updated to support deployment to the new cluster:
- Cluster name: `warp-cluster` (previously `warp-dev-kamailio-cluster`)
- Project: `ringer-warp-v01` (previously `ringer-472421`)
- Environment overlays: Both `dev` and `prod` are now available

## Directory Structure

```
kubernetes/
├── base/                    # Base Kubernetes resources
│   ├── common/             # Common configurations
│   ├── jasmin/             # Jasmin SMSC resources
│   ├── kamailio/           # Kamailio SIP resources
│   ├── kustomization.yaml  # Base kustomization
│   └── namespace.yaml      # Namespace definitions
├── overlays/               # Environment-specific configurations
│   ├── dev/               # Development environment
│   │   ├── patches/       # Dev-specific patches
│   │   ├── secrets/       # Dev secrets (git-ignored)
│   │   └── kustomization.yaml
│   └── prod/              # Production environment (NEW)
│       ├── patches/       # Prod-specific patches
│       ├── secrets/       # Prod secrets (git-ignored)
│       └── kustomization.yaml
└── deploy.sh              # Deployment script

```

## Deployment Steps

### 1. Configure Secrets

Before deploying, create the actual secret files from the examples:

#### For Development:
```bash
cd kubernetes/overlays/dev/secrets
cp postgres.env.example postgres.env
cp jasmin.env.example jasmin.env
cp sinch.env.example sinch.env
cp rabbitmq.env.example rabbitmq.env
# Edit each file with actual values
```

#### For Production:
```bash
cd kubernetes/overlays/prod/secrets
cp postgres.env.example postgres.env
cp jasmin.env.example jasmin.env
cp sinch.env.example sinch.env
cp rabbitmq.env.example rabbitmq.env
# Edit each file with actual values
```

### 2. Deploy to Development

```bash
# From the kubernetes directory
./deploy.sh --environment dev

# Or with explicit parameters
./deploy.sh \
  --environment dev \
  --project ringer-warp-v01 \
  --region us-central1 \
  --cluster warp-cluster
```

### 3. Deploy to Production

```bash
# From the kubernetes directory
./deploy.sh --environment prod

# Or with explicit parameters
./deploy.sh \
  --environment prod \
  --project ringer-warp-v01 \
  --region us-central1 \
  --cluster warp-cluster
```

## Environment Differences

### Development Environment
- **Replicas**: Kamailio (2), Jasmin (1)
- **Resources**: Lower CPU/Memory limits
- **Logging**: Debug level
- **Environment**: "development"

### Production Environment
- **Replicas**: Kamailio (3), Jasmin (2)
- **Resources**: Higher CPU/Memory limits
- **Logging**: Info level
- **Environment**: "production"
- **Pod Anti-Affinity**: Enabled for high availability
- **Health Checks**: Configured with production-ready probes

## Verification

After deployment, verify the services:

```bash
# Check pod status
kubectl get pods -n telecom
kubectl get pods -n messaging

# Check services
kubectl get svc -n telecom
kubectl get svc -n messaging

# Get LoadBalancer IPs
kubectl get svc kamailio-sip -n telecom -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
kubectl get svc jasmin-smpp -n messaging -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

## Service Endpoints

Once deployed, the services will be available at:

### External Services (LoadBalancer)
- **Kamailio SIP**: `<KAMAILIO_LB_IP>:5060` (UDP/TCP)
- **Kamailio TLS**: `<KAMAILIO_LB_IP>:5061` (TCP)
- **Jasmin SMPP**: `<JASMIN_LB_IP>:2775` (TCP)
- **Jasmin SMPP-TLS**: `<JASMIN_LB_IP>:2776` (TCP)

### Internal Services (ClusterIP)
- **Jasmin HTTP API**: `http://jasmin-api.messaging.svc.cluster.local:8080`
- **RabbitMQ Management**: `http://rabbitmq-service.messaging.svc.cluster.local:15672`

## Troubleshooting

### Check Logs
```bash
# Kamailio logs
kubectl logs -f deployment/kamailio -n telecom

# Jasmin logs
kubectl logs -f deployment/jasmin-smsc -n messaging

# RabbitMQ logs
kubectl logs -f statefulset/rabbitmq -n messaging
```

### Access Jasmin CLI
```bash
kubectl exec -it deployment/jasmin-smsc -n messaging -- telnet localhost 8990
```

### Scale Deployments
```bash
# Scale Kamailio
kubectl scale deployment/kamailio -n telecom --replicas=5

# Scale Jasmin
kubectl scale deployment/jasmin-smsc -n messaging --replicas=3
```

## Next Steps

1. **DNS Configuration**: Update DNS records with LoadBalancer IPs
2. **Monitoring**: Deploy Prometheus/Grafana monitoring stack
3. **Ingress**: Configure NGINX Ingress for HTTP services
4. **Backup**: Set up regular backup procedures
5. **Alerts**: Configure alerting rules

## Notes

- The deployment script automatically handles namespace creation
- Secrets are generated using Kustomize's secretGenerator
- ConfigMaps are merged with environment-specific patches
- All services use Kubernetes service discovery internally