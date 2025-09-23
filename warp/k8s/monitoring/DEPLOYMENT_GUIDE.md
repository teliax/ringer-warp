# Monitoring Stack Deployment Guide

## Quick Start

### 1. Pre-deployment Check
```bash
./pre-deployment-checklist.sh
```

### 2. Deploy Everything
```bash
./deploy-monitoring-stack.sh
```

### 3. Verify Deployment
```bash
./verify-observability.sh
```

## Component-Specific Deployment

### Deploy Only Prometheus
```bash
./deploy-monitoring-stack.sh prometheus
```

### Deploy Only Homer
```bash
./deploy-monitoring-stack.sh homer
```

### Import Dashboards Only
```bash
./deploy-monitoring-stack.sh dashboards
```

## Configuration

### Environment Variables
```bash
export GCP_PROJECT_ID="ringer-472421"
export GKE_CLUSTER_NAME="warp-gke-cluster"
export GCP_REGION="us-central1"
export WARP_DOMAIN="warp.io"
```

### Custom Values
Edit the deployment scripts to modify:
- Storage sizes
- Retention periods
- Resource limits
- Replica counts

## Post-Deployment

### 1. Update DNS Records
Point these subdomains to your ingress IP:
- prometheus.warp.io
- grafana.warp.io
- homer.warp.io
- alertmanager.warp.io

### 2. Configure Applications

#### Kamailio
```
modparam("siptrace", "duplicate_uri", "sip:HOMER_HEP_IP:9060")
modparam("siptrace", "hep_mode_on", 1)
modparam("siptrace", "hep_version", 3)
```

#### RTPEngine
```
homer = HOMER_HEP_IP:9060
homer-protocol = udp
homer-capture-id = 2
```

### 3. Access Dashboards
Credentials will be displayed after deployment.

## Troubleshooting

### Check Pod Status
```bash
kubectl get pods -n monitoring
kubectl get pods -n homer
```

### View Logs
```bash
kubectl logs -n monitoring -l app.kubernetes.io/name=prometheus
kubectl logs -n monitoring -l app.kubernetes.io/name=grafana
kubectl logs -n homer -l app=homer-app
```

### Test Metrics Endpoints
```bash
kubectl port-forward -n monitoring svc/prometheus-operator-kube-p-prometheus 9090:9090
# Visit http://localhost:9090/targets
```

## Backup & Recovery

### Export Grafana Dashboards
```bash
# Use Grafana API to export dashboards
curl -u admin:PASSWORD https://grafana.warp.io/api/dashboards/db/DASHBOARD_ID
```

### Backup Prometheus Data
Prometheus data is stored on persistent volumes. Use standard GKE backup procedures.

### Backup Homer Data
Homer uses PostgreSQL with TimescaleDB. Regular pg_dump backups are recommended.

## Maintenance

### Update Alert Rules
```bash
kubectl apply -f ../alerting/enhanced-prometheus-rules.yaml
```

### Scale Components
```bash
# Scale Prometheus
kubectl scale statefulset -n monitoring prometheus-prometheus-operator-kube-p-prometheus --replicas=2

# Scale Homer
kubectl scale deployment -n homer homer-app --replicas=5
```

### Clean Up
```bash
# Remove monitoring stack (preserves data)
helm uninstall prometheus-operator -n monitoring

# Remove everything including data
kubectl delete namespace monitoring homer
```