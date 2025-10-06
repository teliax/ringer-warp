# WARP Kubernetes Deployment Checklist

## Pre-Deployment Checklist

- [ ] GKE cluster `warp-kamailio-cluster` is running
- [ ] Cloud SQL instance `warp-db` is accessible
- [ ] kubectl is configured with cluster credentials
- [ ] All secret files are configured in `overlays/dev/secrets/`
- [ ] Docker images are accessible from GKE

## Deployment Commands

### 1. Infrastructure Setup
```bash
# Set environment variables
export PROJECT_ID="ringer-warp-v01"
export REGION="us-central1"
export CLUSTER_NAME="warp-kamailio-cluster"

# Get cluster credentials
gcloud container clusters get-credentials $CLUSTER_NAME --region=$REGION --project=$PROJECT_ID

# Verify cluster access
kubectl cluster-info
kubectl get nodes
```

### 2. Create Namespaces
```bash
# Apply namespace definitions
kubectl apply -f base/namespace.yaml

# Verify namespaces
kubectl get namespaces | grep -E "telecom|messaging|monitoring|homer"
```

### 3. Create Secrets from Secret Manager
```bash
# Get database password
DB_PASSWORD=$(gcloud secrets versions access latest --secret="warp-db-password")

# Get Cloud SQL IP
CLOUD_SQL_IP=$(gcloud sql instances describe warp-db --format="value(ipAddresses[0].ipAddress)")

# Create database secret in telecom namespace
kubectl create secret generic postgres-credentials \
    --from-literal=host=$CLOUD_SQL_IP \
    --from-literal=port=5432 \
    --from-literal=database=warp \
    --from-literal=username=warp \
    --from-literal=password="$DB_PASSWORD" \
    --namespace=telecom \
    --dry-run=client -o yaml | kubectl apply -f -

# Create database secret in messaging namespace
kubectl create secret generic postgres-credentials \
    --from-literal=host=$CLOUD_SQL_IP \
    --from-literal=port=5432 \
    --from-literal=database=warp \
    --from-literal=username=warp \
    --from-literal=password="$DB_PASSWORD" \
    --namespace=messaging \
    --dry-run=client -o yaml | kubectl apply -f -
```

### 4. Deploy Core Services
```bash
# Deploy using kustomize
cd /home/daldworth/repos/ringer-warp/kubernetes
kustomize build overlays/dev | kubectl apply -f -

# Watch deployment progress
watch -n 2 'kubectl get pods -n telecom; echo "---"; kubectl get pods -n messaging'

# Wait for rollouts
kubectl rollout status deployment/kamailio -n telecom --timeout=5m
kubectl rollout status deployment/jasmin-smsc -n messaging --timeout=5m
kubectl rollout status statefulset/rabbitmq -n messaging --timeout=5m
```

### 5. Verify Services
```bash
# Check service endpoints
kubectl get svc -n telecom
kubectl get svc -n messaging

# Get LoadBalancer IPs
KAMAILIO_IP=$(kubectl get svc kamailio-sip -n telecom -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
JASMIN_IP=$(kubectl get svc jasmin-smpp -n messaging -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

echo "Kamailio SIP: $KAMAILIO_IP:5060"
echo "Jasmin SMPP: $JASMIN_IP:2775"
```

### 6. Deploy Monitoring Stack
```bash
# Create monitoring namespace if not exists
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace homer --dry-run=client -o yaml | kubectl apply -f -

# Deploy Prometheus and Grafana
cd /home/daldworth/repos/ringer-warp/warp/k8s/monitoring
./deploy-prometheus.sh

# Deploy Homer
cd /home/daldworth/repos/ringer-warp/warp/k8s/homer
./deploy.sh

# Get monitoring endpoints
GRAFANA_PASS=$(kubectl get secret --namespace monitoring prometheus-operator-grafana -o jsonpath="{.data.admin-password}" | base64 --decode)
echo "Grafana Password: $GRAFANA_PASS"
```

### 7. Post-Deployment Configuration
```bash
# Configure Jasmin SMPP routes
kubectl exec -it deployment/jasmin-smsc -n messaging -- bash -c "
telnet localhost 8990
# Login with jasmin admin password
# Configure SMPP client connector to Sinch
"

# Test Kamailio connectivity
kubectl run -it --rm sip-test --image=ctaloi/sipsak --restart=Never -- \
  sipsak -s sip:test@$KAMAILIO_IP

# Check logs
kubectl logs -f deployment/kamailio -n telecom --tail=100
kubectl logs -f deployment/jasmin-smsc -n messaging --tail=100
```

### 8. Setup Port Forwarding for UIs
```bash
# Grafana (user: admin, password: from secret)
kubectl port-forward -n monitoring svc/prometheus-operator-grafana 3000:80

# Prometheus
kubectl port-forward -n monitoring svc/prometheus-operator-prometheus 9090:9090

# Homer
kubectl port-forward -n homer svc/homer-webapp 8080:80

# RabbitMQ Management
kubectl port-forward -n messaging svc/rabbitmq-service 15672:15672
```

## Verification Checklist

- [ ] All pods are running in telecom namespace
- [ ] All pods are running in messaging namespace
- [ ] LoadBalancer IPs are assigned
- [ ] Kamailio responds to SIP OPTIONS
- [ ] Jasmin HTTP API is accessible
- [ ] Prometheus is scraping metrics
- [ ] Grafana dashboards are loading
- [ ] Homer is receiving HEP traffic

## Rollback Commands

If deployment fails:

```bash
# Delete current deployment
kustomize build overlays/dev | kubectl delete -f -

# Or rollback to previous version
kubectl rollout undo deployment/kamailio -n telecom
kubectl rollout undo deployment/jasmin-smsc -n messaging

# Check rollout history
kubectl rollout history deployment/kamailio -n telecom
kubectl rollout history deployment/jasmin-smsc -n messaging
```

## Useful Debug Commands

```bash
# Get pod details
kubectl describe pod <pod-name> -n <namespace>

# Get events
kubectl get events -n telecom --sort-by='.lastTimestamp'
kubectl get events -n messaging --sort-by='.lastTimestamp'

# Check resource usage
kubectl top nodes
kubectl top pods -n telecom
kubectl top pods -n messaging

# Export logs
kubectl logs deployment/kamailio -n telecom --all-containers=true > kamailio.log
kubectl logs deployment/jasmin-smsc -n messaging --all-containers=true > jasmin.log
```

## Emergency Procedures

### If services are down:
1. Check pod status: `kubectl get pods --all-namespaces | grep -v Running`
2. Check events: `kubectl get events --all-namespaces --sort-by='.lastTimestamp' | head -20`
3. Check node status: `kubectl get nodes`
4. Check cluster autoscaling: `gcloud container clusters describe $CLUSTER_NAME --region=$REGION`

### To restart services:
```bash
# Restart Kamailio
kubectl rollout restart deployment/kamailio -n telecom

# Restart Jasmin
kubectl rollout restart deployment/jasmin-smsc -n messaging

# Force delete stuck pod
kubectl delete pod <pod-name> -n <namespace> --grace-period=0 --force
```

## Notes

- Always backup configuration before making changes
- Monitor resource usage during deployment
- Keep LoadBalancer IPs documented
- Update DNS records after getting stable IPs
- Configure firewall rules for SMPP carrier IPs