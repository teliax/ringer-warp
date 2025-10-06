# Cloud SQL Connectivity Guide for WARP on GKE

## Overview

This guide provides a comprehensive solution for connecting Kubernetes workloads running on GKE to a Cloud SQL PostgreSQL instance using Google Cloud's best practices.

## Problem Statement

- **Issue**: Kubernetes pods cannot connect to Cloud SQL instance at private IP `10.126.0.3`
- **Symptoms**: 
  - Database initialization jobs failing
  - Kamailio pods unable to connect to PostgreSQL
  - Connection timeouts when using private IP directly

## Solution: Cloud SQL Auth Proxy

The Cloud SQL Auth proxy provides secure connectivity between GKE workloads and Cloud SQL instances. It offers:

1. **Secure connections** - Automatic SSL/TLS encryption
2. **IAM-based authentication** - No need to manage IP allowlists
3. **Automatic failover** - Handles instance restarts transparently
4. **Private IP support** - Works with private IP instances

## Architecture

```
┌─────────────────────┐
│   Kamailio Pod      │
│  ┌───────────────┐  │
│  │ Kamailio      │  │
│  │ Container     │  │
│  │               │  │
│  │ PGHOST:       │  │
│  │ 127.0.0.1     │  │
│  └──────┬────────┘  │
│         │           │
│  ┌──────▼────────┐  │
│  │ Cloud SQL     │  │
│  │ Proxy Sidecar │  │
│  │               │  │
│  │ Port: 5432    │  │
│  └──────┬────────┘  │
└─────────┼───────────┘
          │
          ▼
   ┌──────────────┐
   │  Cloud SQL   │
   │  PostgreSQL  │
   │              │
   │ Private IP:  │
   │ 10.126.0.3   │
   └──────────────┘
```

## Prerequisites

1. **GCP Project** with billing enabled
2. **Cloud SQL instance** with private IP
3. **GKE cluster** in the same VPC
4. **gcloud CLI** installed and configured
5. **kubectl** configured for your cluster

## Implementation Steps

### 1. Enable Required APIs

```bash
gcloud services enable \
  sqladmin.googleapis.com \
  compute.googleapis.com \
  container.googleapis.com \
  servicenetworking.googleapis.com
```

### 2. Create Service Account for Cloud SQL Access

```bash
# Create service account
gcloud iam service-accounts create warp-cloudsql-sa \
  --display-name="WARP Cloud SQL Service Account"

# Grant Cloud SQL Client role
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:warp-cloudsql-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

### 3. Configure Workload Identity

```bash
# Bind GCP service account to Kubernetes service account
gcloud iam service-accounts add-iam-policy-binding \
  warp-cloudsql-sa@PROJECT_ID.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:PROJECT_ID.svc.id.goog[warp-core/cloudsql-proxy]"
```

### 4. Deploy Cloud SQL Proxy

The proxy can be deployed in two ways:

#### Option A: Sidecar Pattern (Recommended)

Each pod runs its own proxy sidecar:

```yaml
containers:
- name: cloud-sql-proxy
  image: gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.8.0
  args:
    - "--private-ip"
    - "--port=5432"
    - "PROJECT_ID:REGION:INSTANCE_NAME"
```

**Pros:**
- No single point of failure
- Scales with your application
- Lower latency (localhost connection)

**Cons:**
- More resource usage (proxy per pod)
- More complex deployment

#### Option B: Standalone Deployment

Single proxy deployment serving multiple pods:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cloudsql-proxy
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: cloud-sql-proxy
        image: gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.8.0
```

**Pros:**
- Resource efficient
- Simpler to manage
- Single configuration point

**Cons:**
- Single point of failure
- Additional network hop

### 5. Configure Application Connection

Applications connect through the proxy using:

```yaml
env:
- name: POSTGRES_HOST
  value: "127.0.0.1"  # For sidecar pattern
  # OR
  value: "cloudsql-proxy"  # For standalone deployment
- name: POSTGRES_PORT
  value: "5432"
- name: POSTGRES_DB
  value: "warp"
- name: POSTGRES_USER
  value: "warp"
- name: POSTGRES_PASSWORD
  valueFrom:
    secretKeyRef:
      name: warp-db-credentials
      key: password
```

## Security Considerations

### 1. Network Security

- **Private IP Only**: Cloud SQL instance should only have private IP
- **VPC Peering**: Ensure proper VPC peering between GKE and Cloud SQL
- **No Public Endpoint**: Disable public IP on Cloud SQL instance

### 2. Authentication & Authorization

- **Workload Identity**: Use Workload Identity for GKE to GCP authentication
- **IAM Roles**: Grant minimal required permissions (cloudsql.client)
- **Database Users**: Use strong passwords stored in Kubernetes secrets

### 3. Encryption

- **In-Transit**: Cloud SQL proxy automatically encrypts connections
- **At-Rest**: Enable Cloud SQL encryption at rest
- **Secrets**: Use Kubernetes secrets for sensitive data

## Troubleshooting

### Common Issues

#### 1. Permission Denied

```bash
# Check service account permissions
gcloud projects get-iam-policy PROJECT_ID \
  --flatten="bindings[].members" \
  --format='table(bindings.role)' \
  --filter="bindings.members:warp-cloudsql-sa@PROJECT_ID.iam.gserviceaccount.com"
```

#### 2. Connection Refused

```bash
# Check if proxy is running
kubectl get pods -n warp-core -l app=cloudsql-proxy

# Check proxy logs
kubectl logs -n warp-core -l app=cloudsql-proxy
```

#### 3. Network Connectivity

```bash
# Test from a debug pod
kubectl run -it --rm debug \
  --image=postgres:15-alpine \
  --namespace=warp-core \
  -- psql -h cloudsql-proxy -U warp -d warp
```

### Debug Commands

```bash
# Check Cloud SQL instance details
gcloud sql instances describe warp-dev-db

# Verify VPC peering
gcloud compute networks peerings list --network=VPC_NAME

# Test connectivity from GKE node
kubectl run test-pod --rm -it \
  --image=busybox \
  --overrides='{"spec":{"hostNetwork":true}}' \
  -- nc -zv 10.126.0.3 5432
```

## Performance Optimization

### 1. Connection Pooling

Configure your application to use connection pooling:

```yaml
# Example for Kamailio
modparam("db_postgres", "con_param", "connect_timeout=5")
modparam("db_postgres", "con_param", "keepalives=1")
modparam("db_postgres", "con_param", "keepalives_idle=5")
```

### 2. Resource Allocation

```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"
```

### 3. Health Checks

```yaml
livenessProbe:
  tcpSocket:
    port: 5432
  initialDelaySeconds: 30
  periodSeconds: 10
readinessProbe:
  tcpSocket:
    port: 5432
  initialDelaySeconds: 5
  periodSeconds: 5
```

## Monitoring

### 1. Proxy Metrics

Cloud SQL proxy exposes Prometheus metrics:

```yaml
- name: cloud-sql-proxy
  args:
    - "--prometheus"
    - "--prometheus-port=9090"
```

### 2. Connection Monitoring

Monitor these key metrics:
- Active connections
- Connection errors
- Query latency
- Proxy restarts

### 3. Alerts

Set up alerts for:
- Proxy pod restarts
- Connection failures
- High latency
- Resource exhaustion

## Best Practices

1. **Use Workload Identity**: Never use service account keys
2. **Enable automatic backups**: Configure Cloud SQL backups
3. **Monitor connections**: Track connection count and latency
4. **Use connection pooling**: Reduce connection overhead
5. **Implement retry logic**: Handle transient failures
6. **Regular updates**: Keep Cloud SQL proxy image updated
7. **Resource limits**: Set appropriate CPU/memory limits
8. **High availability**: Use multiple proxy replicas for critical workloads

## Migration Checklist

- [ ] Enable required GCP APIs
- [ ] Create and configure service accounts
- [ ] Set up Workload Identity bindings
- [ ] Deploy Cloud SQL proxy
- [ ] Test connectivity
- [ ] Update application configurations
- [ ] Deploy database schema
- [ ] Deploy applications
- [ ] Verify end-to-end connectivity
- [ ] Set up monitoring and alerts
- [ ] Document connection strings

## Quick Setup

Use the provided script for automated setup:

```bash
# Set environment variables
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="us-central1"
export GKE_CLUSTER_NAME="warp-dev-gke"

# Run setup script
./setup-cloudsql-connectivity.sh
```

## Support Resources

- [Cloud SQL Proxy Documentation](https://cloud.google.com/sql/docs/mysql/sql-proxy)
- [Workload Identity Guide](https://cloud.google.com/kubernetes-engine/docs/how-to/workload-identity)
- [GKE Best Practices](https://cloud.google.com/kubernetes-engine/docs/best-practices)
- [Cloud SQL Best Practices](https://cloud.google.com/sql/docs/postgres/best-practices)