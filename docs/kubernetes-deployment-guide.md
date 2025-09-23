# WARP Kubernetes Deployment Guide

## Overview

The WARP platform deployment consists of multiple components deployed across different Kubernetes namespaces. This guide documents the complete deployment process, dependencies, and order of operations.

## Prerequisites

1. **GKE Cluster**: `warp-cluster` must exist in `us-central1`
2. **Cloud SQL**: PostgreSQL instance `warp-db` must be provisioned
3. **Tools Required**:
   - `kubectl` configured with cluster access
   - `kustomize` (or kubectl with kustomize support)
   - `helm` for observability stack
   - `gcloud` CLI authenticated
   - `htpasswd` for basic auth generation

## Kubernetes Namespaces

The deployment creates the following namespaces:

1. **telecom**: Core telecom services (Kamailio SIP)
2. **messaging**: SMS/MMS services (Jasmin SMSC, RabbitMQ)
3. **monitoring**: Prometheus, Grafana, AlertManager
4. **homer**: SIP/RTP capture and analysis
5. **consul**: Service mesh (if not using GCE instances)
6. **warp-core**: Business logic and API services
7. **warp-api**: API gateway and external services

## Deployment Order and Dependencies

### Phase 1: Infrastructure Verification
```bash
# Verify GKE cluster exists
gcloud container clusters describe warp-cluster --region=us-central1

# Configure kubectl
gcloud container clusters get-credentials warp-cluster --region=us-central1

# Verify Cloud SQL instance
gcloud sql instances describe warp-db
```

### Phase 2: Database Setup
```bash
# Get DB password from Secret Manager
DB_PASSWORD=$(gcloud secrets versions access latest --secret="warp-db-password")

# Run database initialization scripts
cd warp/database/setup
./00-master-setup.sh
```

### Phase 3: Create Kubernetes Secrets

Before deploying services, create required secrets in each namespace:

```bash
# Create namespaces
kubectl apply -f kubernetes/base/namespace.yaml

# Create database secret for telecom namespace
kubectl create secret generic postgres-credentials \
    --from-literal=host=<CLOUD_SQL_IP> \
    --from-literal=port=5432 \
    --from-literal=database=warp \
    --from-literal=username=warp \
    --from-literal=password="$DB_PASSWORD" \
    --namespace=telecom

# Copy secrets to other namespaces as needed
kubectl create secret generic postgres-credentials \
    --from-literal=host=<CLOUD_SQL_IP> \
    --from-literal=port=5432 \
    --from-literal=database=warp \
    --from-literal=username=warp \
    --from-literal=password="$DB_PASSWORD" \
    --namespace=messaging
```

### Phase 4: Configure Secret Files

Edit the following secret files in `kubernetes/overlays/production/secrets/`:

1. **postgres.env**:
   ```
   host=<CLOUD_SQL_PRIVATE_IP>
   port=5432
   database=kamailio
   username=kamailio
   password=<POSTGRES_PASSWORD>
   ```

2. **jasmin.env**:
   ```
   admin-password=<JASMIN_ADMIN_PASSWORD>
   ```

3. **sinch.env**:
   ```
   host=<SINCH_SMPP_HOST>
   port=2775
   username=<SINCH_USERNAME>
   password=<SINCH_PASSWORD>
   ```

4. **rabbitmq.env**:
   ```
   username=admin
   password=<RABBITMQ_PASSWORD>
   ```

### Phase 5: Deploy Core Services

Deploy Kamailio and Jasmin using Kustomize:

```bash
cd kubernetes

# Deploy all services
./deploy.sh

# Or manually with kustomize
kustomize build overlays/production | kubectl apply -f -
```

This deploys:
- **Kamailio** (3 replicas) in `telecom` namespace
- **Jasmin SMSC** (2 replicas) in `messaging` namespace
- **RabbitMQ** (StatefulSet) in `messaging` namespace
- **Redis** (if configured) for session storage

### Phase 6: Deploy Observability Stack

```bash
cd warp/k8s/monitoring

# Deploy complete observability stack
./deploy-observability-stack.sh
```

This deploys:
- **Prometheus** with service discovery
- **Grafana** with pre-configured dashboards
- **AlertManager** with routing rules
- **Homer** for SIP/RTP capture
- **Business Metrics Exporter** for custom KPIs

### Phase 7: Verify Deployments

```bash
# Check telecom services
kubectl get pods -n telecom
kubectl get svc -n telecom

# Check messaging services
kubectl get pods -n messaging
kubectl get svc -n messaging

# Check monitoring stack
kubectl get pods -n monitoring
kubectl get svc -n monitoring

# Check Homer
kubectl get pods -n homer
kubectl get svc -n homer
```

## Service Dependencies

### Kamailio Dependencies:
- PostgreSQL (Cloud SQL) for routing/subscriber data
- Redis for distributed session storage
- Homer for HEP capture
- RTPEngine instances (deployed via Terraform)

### Jasmin Dependencies:
- RabbitMQ for message queuing
- Redis for session storage
- PostgreSQL for message logs
- Sinch SMPP connection for carrier integration

### Monitoring Dependencies:
- All services expose Prometheus metrics
- Grafana depends on Prometheus
- Homer depends on HEP traffic from Kamailio/RTPEngine

## Configuration Management

### ConfigMaps:
- `kamailio-config`: Kamailio configuration and Lua scripts
- `jasmin-config`: Jasmin configuration and interceptors
- `redis-config`: Redis connection details
- `homer-config`: Homer HEP endpoint configuration

### Secrets:
- `postgres-credentials`: Database connection
- `jasmin-credentials`: Jasmin admin password
- `sinch-credentials`: SMPP carrier credentials
- `rabbitmq-credentials`: RabbitMQ authentication

## LoadBalancer Services

External services exposed via LoadBalancer:

1. **Kamailio SIP**:
   - UDP/TCP: 5060 (SIP)
   - TCP: 5061 (SIP-TLS)
   
2. **Jasmin SMPP**:
   - TCP: 2775 (SMPP)
   - TCP: 2776 (SMPP-TLS)
   
3. **Homer HEP**:
   - UDP: 9060 (HEP capture)

## kubectl Commands for Deployment

```bash
# Deploy namespaces
kubectl apply -f kubernetes/base/namespace.yaml

# Deploy with kustomize
kubectl apply -k kubernetes/overlays/production/

# Watch deployment progress
kubectl get pods --all-namespaces -w

# Check service endpoints
kubectl get svc --all-namespaces | grep LoadBalancer

# Access Jasmin CLI
kubectl exec -it deployment/jasmin-smsc -n messaging -- telnet localhost 8990

# Port-forward for web UIs
kubectl port-forward -n monitoring svc/prometheus-operator-grafana 3000:80
kubectl port-forward -n homer svc/homer-webapp 8080:80
kubectl port-forward -n monitoring svc/prometheus-operator-prometheus 9090:9090
```

## Post-Deployment Tasks

1. **Update DNS Records**:
   - Point SIP domains to Kamailio LoadBalancer IP
   - Configure SPF/DKIM for messaging

2. **Configure Carrier Integration**:
   - Update Sinch SMPP settings in Jasmin
   - Configure cluster egress IPs in carrier portal

3. **Import Initial Data**:
   - Load rate tables into PostgreSQL
   - Configure routing rules
   - Set up initial user accounts

4. **Configure Monitoring**:
   - Set up alert notification channels
   - Import custom Grafana dashboards
   - Configure Homer capture filters

5. **Test Connectivity**:
   - SIP registration tests
   - SMS sending/receiving tests
   - Call routing verification

## Troubleshooting

### Common Issues:

1. **Pods not starting**: Check secrets are created correctly
2. **LoadBalancer pending**: Verify GKE cluster has LoadBalancer quota
3. **Database connection errors**: Check Cloud SQL private IP and firewall rules
4. **SMPP connection failures**: Verify egress IPs are whitelisted

### Debug Commands:

```bash
# Check pod logs
kubectl logs -f deployment/kamailio -n telecom
kubectl logs -f deployment/jasmin-smsc -n messaging

# Describe pod for events
kubectl describe pod <pod-name> -n <namespace>

# Check secret values
kubectl get secret postgres-credentials -n telecom -o yaml

# Test database connectivity
kubectl run -it --rm debug --image=postgres:14 --restart=Never -- \
  psql -h <CLOUD_SQL_IP> -U warp -d warp
```

## Security Considerations

1. **Network Policies**: Implement Kubernetes NetworkPolicies to restrict traffic
2. **RBAC**: Configure proper Role-Based Access Control
3. **Secret Rotation**: Regularly rotate database and service passwords
4. **TLS**: Enable TLS for all external services
5. **Audit Logging**: Enable GKE audit logging for compliance

## Backup and Recovery

1. **Database Backups**: Cloud SQL automated backups
2. **Configuration Backups**: Store kustomization files in Git
3. **State Backups**: Regular snapshots of Redis/RabbitMQ data
4. **Disaster Recovery**: Multi-region deployment capabilities

This deployment guide ensures a systematic and reliable deployment of the WARP platform on Kubernetes.