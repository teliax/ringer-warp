# Observability Stack for Warp

This directory contains all the configuration and scripts needed to deploy a comprehensive monitoring and observability stack for the Warp telecommunications infrastructure.

## Components

### 1. Prometheus Stack
- **Prometheus Server**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **AlertManager**: Alert routing and notification
- **Prometheus Operator**: Kubernetes-native deployment

### 2. Homer SIP Capture
- **Homer App**: HEP protocol receiver and API
- **Homer WebApp**: SIP analysis web interface
- **PostgreSQL with TimescaleDB**: Time-series storage for SIP captures

### 3. Business Metrics Exporter
- Custom exporter for business KPIs
- Collects revenue, usage, and customer metrics
- Integrates with billing database

### 4. Service Monitors
- Kamailio (SIP) metrics
- RTPEngine (Media) metrics
- API service metrics
- Consul service mesh metrics

## Quick Start

### Prerequisites
- GKE cluster deployed and accessible
- kubectl configured
- Helm 3.x installed
- Docker for building images

### Deploy Everything
```bash
# Run the complete deployment
./deploy-observability-stack.sh
```

### Deploy Individual Components
```bash
# Deploy only Prometheus
./deploy-prometheus.sh

# Deploy only Homer
../homer/deploy.sh

# Import Grafana dashboards
../grafana/import-dashboards.sh
```

### Verify Deployment
```bash
# Check all components
./verify-observability.sh
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Kamailio      │     │   RTPEngine     │     │   API Services  │
│   (SIP Server)  │     │  (Media Server) │     │  (REST APIs)    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │ /metrics              │ /metrics              │ /metrics
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Prometheus Server     │
                    │  (Metrics Collection)   │
                    └────────────┬────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │                                 │
     ┌──────────▼──────────┐          ┌──────────▼──────────┐
     │      Grafana        │          │    AlertManager     │
     │   (Visualization)   │          │     (Alerting)      │
     └─────────────────────┘          └─────────────────────┘
                
     ┌─────────────────────┐          ┌─────────────────────┐
     │       Homer         │          │   Business Metrics  │
     │  (SIP Capture/QoS)  │          │     Exporter        │
     └─────────────────────┘          └─────────────────────┘
```

## Access URLs

All services are exposed via HTTPS with Let's Encrypt certificates:

- **Prometheus**: https://prometheus.warp.io
- **Grafana**: https://grafana.warp.io  
- **Homer**: https://homer.warp.io

## Dashboards

### Pre-configured Dashboards:
1. **SIP Infrastructure Monitoring** - Call metrics, registrations, response codes
2. **RTP Media Monitoring** - Media quality, packet loss, jitter
3. **Business Metrics** - Revenue, customer metrics, usage patterns

## Alerts

Critical alerts are configured for:
- Service availability (Kamailio, RTPEngine, APIs down)
- High error rates (>5% SIP failures)
- Resource exhaustion (ports, memory)
- Business KPIs (revenue drop, high churn)

## Metrics Collection

### Service Discovery
ServiceMonitors automatically discover services with appropriate labels:
```yaml
metadata:
  labels:
    metrics: "true"
```

### Custom Metrics
Add custom metrics by implementing Prometheus client libraries:
- Go: `github.com/prometheus/client_golang`
- Python: `prometheus_client`
- Node.js: `prom-client`

## Storage

- **Prometheus**: 100Gi, 30-day retention
- **Grafana**: 10Gi for dashboards and config
- **AlertManager**: 10Gi, 7-day retention
- **Homer**: 100Gi with TimescaleDB compression

## Security

- All external endpoints use TLS
- Basic authentication on Prometheus/Homer
- Grafana has built-in auth
- Network policies restrict internal access
- Service accounts with minimal RBAC

## Troubleshooting

### Check Pod Status
```bash
kubectl get pods -n monitoring
kubectl get pods -n homer
```

### View Logs
```bash
# Prometheus
kubectl logs -n monitoring -l app.kubernetes.io/name=prometheus

# Grafana  
kubectl logs -n monitoring -l app.kubernetes.io/name=grafana

# Homer
kubectl logs -n homer -l app=homer-app
```

### Access Prometheus Targets
```bash
kubectl port-forward -n monitoring svc/prometheus-operator-kube-p-prometheus 9090:9090
# Visit http://localhost:9090/targets
```

## Maintenance

### Backup Dashboards
```bash
# Export from Grafana API
curl -u admin:password https://grafana.warp.io/api/dashboards/uid/sip-metrics
```

### Update Alert Rules
```bash
# Edit rules
vim ../alerting/prometheus-rules.yaml
# Apply changes
kubectl apply -f ../alerting/prometheus-rules.yaml
```

## Integration

### Adding New Services
1. Expose metrics endpoint in your service
2. Add appropriate labels to K8s service
3. Create ServiceMonitor in monitoring namespace
4. Create Grafana dashboard
5. Add relevant alerts

### Sending SIP Captures to Homer
Configure in Kamailio:
```
modparam("siptrace", "duplicate_uri", "sip:HEP_IP:9060")
modparam("siptrace", "hep_mode_on", 1)
modparam("siptrace", "hep_version", 3)
```

## Support

For issues or questions:
1. Check pod logs
2. Verify network connectivity
3. Ensure proper RBAC permissions
4. Review service discovery in Prometheus

Documentation: `/home/daldworth/repos/ringer-warp/docs/monitoring-endpoints.md`