# Monitoring Endpoints - Warp Platform

This document outlines the monitoring and observability endpoints for the Warp telecommunications platform.

## Overview

The Warp platform uses a comprehensive monitoring stack consisting of:
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **AlertManager**: Alert routing and notifications
- **Homer**: SIP capture and analysis
- **Custom Exporters**: Business metrics and KPIs

## Prometheus Metrics

### Kamailio (SIP Server)
- **Endpoint**: `http://kamailio-service.warp-core:9090/metrics`
- **Port**: 9090
- **Format**: Prometheus text format
- **Namespace**: `warp-core`
- **Key Metrics**:
  - `sip_core_uptime_seconds` - Server uptime
  - `sip_registrar_registered_users` - Number of registered users
  - `sip_core_tcp_connections` - Current TCP connections
  - `sip_messages_total{method="INVITE"}` - Total INVITE requests
  - `sip_responses_total{code="200"}` - Successful responses
  - `sip_shared_memory_used_bytes` - Shared memory usage
  - `sip_shared_memory_total_bytes` - Total shared memory
  - `sip_registrations_failed_total` - Failed registrations

### RTPEngine (Media Server)
- **Endpoint**: `http://rtpengine-service.warp-core:9091/metrics`
- **Port**: 9091
- **Format**: Prometheus text format
- **Namespace**: `warp-core`
- **Key Metrics**:
  - `rtp_sessions_active` - Active media sessions
  - `rtp_packets_total{direction="rx"}` - Received packets
  - `rtp_packets_total{direction="tx"}` - Transmitted packets
  - `rtp_packets_lost` - Lost packets
  - `rtp_bytes_total` - Total bytes processed
  - `rtp_errors_total` - Total errors
  - `rtp_ports_used` - RTP ports in use
  - `rtp_ports_available` - Available RTP ports
  - `rtp_jitter_milliseconds_bucket` - Jitter histogram
  - `rtp_timeout_streams_total` - Timed out streams

### Homer (SIP Capture)
- **Endpoint**: `http://homer-app.homer:9096/metrics`
- **Port**: 9096
- **Format**: Prometheus text format
- **Namespace**: `homer`
- **HEP Capture**: `HEP_IP:9060` (UDP)
- **Key Metrics**:
  - `homer_packets_received_total` - Total HEP packets received
  - `homer_packets_inserted_total` - Packets inserted to database
  - `homer_database_size_bytes` - Database size
  - `homer_search_latency_seconds` - Search query latency
  - `homer_capture_errors_total` - Capture errors

### Consul (Service Mesh)
- **Endpoint**: `http://consul-server.consul:8500/v1/agent/metrics?format=prometheus`
- **Port**: 8500
- **Format**: Prometheus text format
- **Namespace**: `consul`
- **Key Metrics**:
  - `consul_raft_leader` - Raft leader status
  - `consul_serf_lan_members` - Number of LAN members
  - `consul_catalog_services` - Number of registered services
  - `consul_health_checks` - Health check statuses
  - `consul_kvs_apply` - KV store operations

### API Services
- **Endpoint**: `http://{service}-service.warp-api:8080/metrics`
- **Port**: 8080 (varies by service)
- **Format**: Prometheus text format
- **Namespace**: `warp-api`
- **Common Metrics**:
  - `http_requests_total{status="200",handler="/api/v1/calls"}` - HTTP requests
  - `http_request_duration_seconds_bucket` - Request latency histogram
  - `http_requests_in_flight` - Current in-flight requests
  - `database_connection_errors_total` - DB connection errors
  - `process_cpu_seconds_total` - CPU usage
  - `go_memstats_heap_alloc_bytes` - Memory usage

### Business Metrics Exporter
- **Endpoint**: `http://business-metrics-exporter.warp-api:9100/metrics`
- **Port**: 9100
- **Format**: Prometheus text format
- **Namespace**: `warp-api`
- **Update Interval**: 60s
- **Custom Metrics**:
  - `business_revenue_total{type="monthly_subscription"}` - Revenue by type
  - `business_subscribers_active` - Active subscriber count
  - `business_minutes_total{call_type="outbound"}` - Minutes used
  - `business_calls_total{call_type="inbound"}` - Call counts
  - `business_calls_failed` - Failed call attempts
  - `business_sms_total{direction="outbound"}` - SMS counts
  - `business_customers_new` - New customer signups
  - `business_customers_churned` - Customer churn
  - `business_account_balance` - Account balances

### Infrastructure Metrics
- **Node Exporter**: Automatically deployed on all nodes
- **kube-state-metrics**: Kubernetes resource metrics
- **NGINX Ingress**: Controller metrics
- **Key Metrics**:
  - `node_cpu_seconds_total` - CPU usage
  - `node_memory_MemAvailable_bytes` - Available memory
  - `node_filesystem_avail_bytes` - Disk space
  - `node_network_receive_bytes_total` - Network traffic
  - `kube_pod_status_phase` - Pod states
  - `kube_deployment_status_replicas_available` - Deployment status

## Grafana Dashboards

### Pre-built Dashboards:

1. **SIP Infrastructure Monitoring** (`sip-dashboard.json`)
   - Call success rates by method
   - Registration statistics and trends
   - Response time distributions (P50, P95, P99)
   - Error rates by response code
   - Geographic call distribution
   - Concurrent calls and capacity

2. **RTP Media Monitoring** (`rtp-dashboard.json`)
   - Active media sessions
   - Packet loss and jitter metrics
   - Codec usage statistics
   - Port utilization and availability
   - Media quality scores
   - Stream timeout rates

3. **Business Metrics Dashboard** (`business-dashboard.json`)
   - Revenue trends (hourly, daily, monthly)
   - Customer acquisition and churn
   - Usage patterns by service type
   - Account balance distributions
   - Service availability SLAs
   - Cost per minute/SMS trends

4. **Infrastructure Overview** (built-in)
   - Cluster resource utilization
   - Pod and container statistics
   - Network traffic patterns
   - Storage usage and trends

## Alerting Rules

### Critical Alerts (Pager):
- **Service Down**: Kamailio, RTPEngine, API services unavailable
- **High Error Rate**: >5% SIP 5xx responses for 5 minutes
- **Resource Exhaustion**: RTP ports >90% utilized
- **Database Failure**: Connection errors >0.1/sec
- **Revenue Drop**: >20% decrease vs same time yesterday

### Warning Alerts (Email/Slack):
- **High Latency**: API p99 >1s for 5 minutes
- **Low Users**: <10 registered SIP users
- **High Churn**: >5% daily churn rate
- **Memory Pressure**: >90% memory usage
- **Disk Space**: <15% free space
- **Certificate Expiry**: <30 days until expiration

### Info Alerts (Dashboard Only):
- **Deployment Changes**: New versions deployed
- **Scaling Events**: Pods scaled up/down
- **Backup Status**: Successful/failed backups

## ServiceMonitor Configuration

### Example ServiceMonitor for Warp Services:
```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: warp-api-metrics
  namespace: monitoring
  labels:
    prometheus: kube-prometheus
spec:
  namespaceSelector:
    matchNames:
    - warp-api
  selector:
    matchLabels:
      metrics: "true"
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
    relabelings:
    - sourceLabels: [__meta_kubernetes_service_name]
      targetLabel: service
    - sourceLabels: [__meta_kubernetes_namespace]
      targetLabel: namespace
```

## Access URLs

### Production Environment (Live):
- **Prometheus**: https://prometheus.ringer.tel ✅
- **Grafana**: https://grafana.ringer.tel ✅  
- **API**: https://api-v2.ringer.tel ✅
- **Homer**: Port-forward required (no public ingress)
- **AlertManager**: Port-forward required (no public ingress)

### Local Access (Port Forwarding):
```bash
# Prometheus
kubectl port-forward -n monitoring svc/prometheus-operator-kube-p-prometheus 9090:9090

# Grafana
kubectl port-forward -n monitoring svc/prometheus-operator-grafana 3000:80

# Homer
kubectl port-forward -n homer svc/homer-webapp 8080:80

# AlertManager
kubectl port-forward -n monitoring svc/prometheus-operator-kube-p-alertmanager 9093:9093
```

## Integration Examples

### Application Metrics Integration (Go):
```go
import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

// Define metrics
var (
    httpDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "http_request_duration_seconds",
            Help: "Duration of HTTP requests.",
        },
        []string{"handler", "method", "status"},
    )
)

// Register metrics
func init() {
    prometheus.MustRegister(httpDuration)
}

// Expose metrics endpoint
http.Handle("/metrics", promhttp.Handler())
```

### Kubernetes Service Labels:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
  namespace: warp-api
  labels:
    app: my-app
    metrics: "true"  # Required for ServiceMonitor discovery
spec:
  ports:
  - name: metrics
    port: 9090
    targetPort: 9090
```

### Homer HEP Integration (Kamailio):
```
loadmodule "siptrace.so"

modparam("siptrace", "duplicate_uri", "sip:HOMER_HEP_IP:9060")
modparam("siptrace", "hep_mode_on", 1)
modparam("siptrace", "hep_version", 3)
modparam("siptrace", "hep_capture_id", 1)
modparam("siptrace", "trace_to_database", 0)
modparam("siptrace", "trace_flag", 22)
modparam("siptrace", "trace_on", 1)
```

## Troubleshooting

### Check Metric Availability:
```bash
# Test Kamailio metrics
kubectl exec -n warp-core deployment/kamailio -- curl -s http://localhost:9090/metrics | grep sip_

# Test RTPEngine metrics
kubectl exec -n warp-core deployment/rtpengine -- curl -s http://localhost:9091/metrics | grep rtp_

# Test business metrics
kubectl exec -n warp-api deployment/business-metrics-exporter -- curl -s http://localhost:9100/metrics | grep business_
```

### Verify Prometheus Targets:
```bash
# Check ServiceMonitor discovery
kubectl get servicemonitor -n monitoring

# View Prometheus configuration
kubectl get prometheus -n monitoring -o yaml

# Check target status in Prometheus UI
# Navigate to Status > Targets
```

### Debug Missing Metrics:
1. Verify service labels match ServiceMonitor selector
2. Check namespace is included in ServiceMonitor
3. Ensure metrics endpoint is accessible
4. Review Prometheus logs for scrape errors
5. Verify network policies allow traffic

### Performance Tuning:
- Adjust scrape intervals based on metric importance
- Use recording rules for expensive queries
- Implement metric relabeling to reduce cardinality
- Set appropriate retention periods
- Use remote storage for long-term retention

## Backup and Recovery

### Prometheus Data:
- Stored on PVC: `prometheus-prometheus-operator-kube-p-prometheus-db-0`
- Retention: 30 days
- Backup: Use volume snapshots or Velero

### Grafana Dashboards:
- Export via API: `GET /api/dashboards/uid/{uid}`
- Store in Git for version control
- Auto-import via ConfigMaps

### Homer Data:
- PostgreSQL with TimescaleDB
- Continuous aggregation for performance
- Regular pg_dump recommended

---

For additional support, refer to the deployment guide at:
`/home/daldworth/repos/ringer-warp/warp/k8s/monitoring/DEPLOYMENT_GUIDE.md`