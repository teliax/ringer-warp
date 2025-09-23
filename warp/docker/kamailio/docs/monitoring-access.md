# WARP Platform Monitoring Access Guide

This document describes how to access the monitoring components deployed in the WARP platform.

## Component Status

All monitoring components are deployed in the `monitoring` namespace:

| Component | Status | Purpose |
|-----------|--------|---------|
| Prometheus | ✅ Running | Metrics collection and storage |
| Grafana | ✅ Running | Metrics visualization |
| Loki | ✅ Running | Log aggregation |
| AlertManager | ✅ Running | Alert routing and management |

## Access Methods

### 1. Prometheus

Prometheus collects metrics from all WARP components.

**Port-forward Access:**
```bash
kubectl port-forward -n monitoring svc/warp-monitoring-prometheus 9090:9090
```
Then access at: http://localhost:9090

**Direct Service Access (within cluster):**
- Service: `warp-monitoring-prometheus.monitoring.svc.cluster.local`
- Port: 9090

**Key Metrics Endpoints:**
- Kamailio metrics: `/metrics` on port 9090 (ringer-warp-v01 namespace)
- API Gateway metrics: `/metrics` on port 9090 (ringer-warp-v01 namespace)
- Node metrics: Collected via node-exporter on all nodes

### 2. Grafana

Grafana provides dashboards for visualizing metrics.

**Port-forward Access:**
```bash
kubectl port-forward -n monitoring svc/warp-monitoring-grafana 3000:80
```
Then access at: http://localhost:3000

**Default Credentials:**
- Username: `admin`
- Password: Get from secret:
```bash
kubectl get secret warp-monitoring-grafana -n monitoring -o jsonpath="{.data.admin-password}" | base64 -d
```

**Available Dashboards:**
- WARP SIP Monitoring (custom dashboard for Kamailio metrics)
- Kubernetes cluster monitoring (default k8s dashboards)
- Node exporter dashboards

### 3. Loki

Loki aggregates logs from all pods via Promtail agents.

**Port-forward Access:**
```bash
kubectl port-forward -n monitoring svc/loki 3100:3100
```

**Direct Service Access (within cluster):**
- Service: `loki.monitoring.svc.cluster.local`
- Port: 3100

**Log Sources:**
- All pod logs are automatically collected by Promtail
- Logs are labeled by namespace, pod, container

**Querying Logs:**
- Use Grafana's Explore feature with Loki datasource
- LogQL query examples:
  ```
  {namespace="ringer-warp-v01", pod=~"kamailio.*"}
  {namespace="warp-core", container="kamailio"}
  ```

### 4. AlertManager

AlertManager handles alert routing and notifications.

**Port-forward Access:**
```bash
kubectl port-forward -n monitoring svc/warp-monitoring-alertmanager 9093:9093
```
Then access at: http://localhost:9093

**Configuration:**
- Currently configured with webhook receivers (placeholders)
- Routes configured for:
  - Critical alerts → critical-receiver
  - Kamailio alerts → sip-team
  - RTPEngine alerts → media-team

**To Configure Real Notifications:**
1. Edit the AlertManager configuration:
```bash
kubectl edit secret alertmanager-warp-monitoring-alertmanager -n monitoring
```
2. Update webhook URLs in the configuration
3. Restart AlertManager:
```bash
kubectl delete pod -n monitoring -l alertmanager=warp-monitoring-alertmanager
```

## ServiceMonitors

The following ServiceMonitors are configured to collect metrics:

1. **kamailio-ringer-warp**: Monitors Kamailio in ringer-warp-v01 namespace
2. **kamailio-warp-core**: Monitors Kamailio in warp-core namespace
3. **warp-api-gateway**: Monitors API Gateway in ringer-warp-v01 namespace
4. **rtpengine-warp**: Monitors RTPEngine (when deployed)

## Prometheus Targets Status

To verify Prometheus is scraping targets:

1. Access Prometheus UI
2. Navigate to Status → Targets
3. Check that all targets show as "UP"

## Grafana Dashboards

### Pre-configured Dashboards:
- **WARP SIP Monitoring**: Custom dashboard showing:
  - SIP request rates by method
  - Active registrations gauge
  - Active calls counter
  - SIP response rates by status code
  - Request latency percentiles (p95, p99)

### Adding New Dashboards:
1. Create dashboard JSON
2. Create ConfigMap with label `grafana_dashboard: "1"`
3. Apply to monitoring namespace

## Troubleshooting

### If metrics are not appearing:
1. Check ServiceMonitor targets in Prometheus
2. Verify service labels match ServiceMonitor selectors
3. Check pod metrics endpoints are accessible

### If AlertManager shows errors:
1. Check configuration syntax:
```bash
kubectl logs -n monitoring alertmanager-warp-monitoring-alertmanager-0
```
2. Verify webhook URLs are properly formatted

### If Grafana dashboards don't load:
1. Verify Prometheus datasource is configured
2. Check dashboard JSON syntax
3. Ensure ConfigMap has correct labels

## Load Balancer Access (Production)

For production environments, expose services via LoadBalancer:

```yaml
# Example for Grafana
apiVersion: v1
kind: Service
metadata:
  name: grafana-lb
  namespace: monitoring
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app.kubernetes.io/instance: warp-monitoring
    app.kubernetes.io/name: grafana
```

## Security Considerations

1. **Authentication**: Enable authentication on all exposed services
2. **TLS**: Use HTTPS/TLS for external access
3. **Network Policies**: Implement network policies to restrict access
4. **RBAC**: Configure proper RBAC for service accounts

## Backup and Retention

- **Prometheus**: Default retention is 15 days
- **Loki**: Default retention is 168h (7 days)
- **Grafana**: Dashboards stored in ConfigMaps and database

To modify retention:
- Prometheus: Edit Prometheus CR spec.retention
- Loki: Update Loki configuration in values