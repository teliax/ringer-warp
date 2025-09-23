# WARP Platform Monitoring Endpoints Implementation Guide

This document outlines the monitoring endpoints that need to be implemented in the WARP voice applications to ensure proper metrics collection by Prometheus.

## Required Metrics Endpoints

### 1. Kamailio SIP Server

**Endpoint**: `/metrics` on port 9090 (or dedicated metrics port)

**Required Metrics:**
```
# SIP Requests
kamailio_sip_requests_total{method="INVITE|REGISTER|BYE|CANCEL|ACK|OPTIONS"} counter
kamailio_sip_responses_total{status_code="1xx|2xx|3xx|4xx|5xx|6xx"} counter

# Active Sessions
kamailio_registrations_active gauge
kamailio_calls_active gauge
kamailio_calls_total counter

# Performance Metrics
kamailio_sip_request_duration_seconds histogram
kamailio_message_queue_size gauge
kamailio_memory_usage_bytes gauge
kamailio_tcp_connections_active gauge

# Error Metrics
kamailio_errors_total{type="routing|auth|database"} counter
kamailio_retransmissions_total counter
```

**Implementation in Kamailio:**
```kamailio
# Load xhttp and metrics modules
loadmodule "xhttp.so"
loadmodule "xhttp_prom.so"

# Configure metrics endpoint
modparam("xhttp_prom", "xhttp_prom_stats", "all")

# Event route for metrics
event_route[xhttp:request] {
    if ($hu =~ "^/metrics") {
        xhttp_reply("200", "OK", "text/plain", "$stat(all)");
        exit;
    }
}
```

### 2. RTPEngine Media Server

**Endpoint**: `/metrics` on port 9100 (or ng-control port)

**Required Metrics:**
```
# Media Sessions
rtpengine_sessions_active gauge
rtpengine_sessions_total counter
rtpengine_ports_used gauge
rtpengine_ports_available gauge

# Media Statistics
rtpengine_packets_total{direction="rx|tx"} counter
rtpengine_bytes_total{direction="rx|tx"} counter
rtpengine_errors_total{type="decode|encode|timeout"} counter
rtpengine_jitter_seconds histogram
rtpengine_packet_loss_rate gauge

# Resource Usage
rtpengine_cpu_usage_percent gauge
rtpengine_memory_usage_bytes gauge
rtpengine_kernel_packets_total counter
```

**Implementation via RTPEngine CLI:**
```bash
# RTPEngine daemon configuration
--interface=eth0
--listen-ng=127.0.0.1:22222
--listen-cli=127.0.0.1:9900
--graphite=127.0.0.1:2003
--graphite-prefix=rtpengine
--graphite-interval=5
```

### 3. WARP API Gateway

**Endpoint**: `/metrics` on port 9090

**Required Metrics:**
```
# API Requests
api_requests_total{method="GET|POST|PUT|DELETE", path="/api/v1/*", status="2xx|3xx|4xx|5xx"} counter
api_request_duration_seconds{method="*", path="*"} histogram

# Business Metrics
api_calls_initiated_total counter
api_calls_terminated_total counter
api_registrations_total counter
api_carriers_active gauge

# Authentication
api_auth_attempts_total{result="success|failure"} counter
api_tokens_active gauge
api_rate_limit_exceeded_total counter

# WebSocket Connections
api_websocket_connections_active gauge
api_websocket_messages_total{direction="in|out"} counter
```

**Implementation in Go/Node.js:**
```go
// Go implementation example
import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
    apiRequests = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "api_requests_total",
            Help: "Total API requests",
        },
        []string{"method", "path", "status"},
    )
)

func init() {
    prometheus.MustRegister(apiRequests)
}

// Metrics endpoint
http.Handle("/metrics", promhttp.Handler())
```

## Service Labels Requirements

All Kubernetes services exposing metrics MUST have the following labels:

```yaml
metadata:
  labels:
    app: <component-name>  # e.g., kamailio, rtpengine, api-gateway
    component: <specific-component>  # e.g., sip, media, api
```

**Example Service Definition:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: kamailio-metrics
  namespace: warp-core
  labels:
    app: kamailio
    component: sip
spec:
  selector:
    app: kamailio
  ports:
  - name: metrics
    port: 9090
    targetPort: 9090
```

## Implementation Checklist

### Kamailio
- [ ] Configure xhttp module for HTTP endpoint
- [ ] Enable statistics collection
- [ ] Expose metrics in Prometheus format
- [ ] Add custom counters for business metrics
- [ ] Ensure metrics port is accessible

### RTPEngine
- [ ] Enable statistics collection in daemon
- [ ] Configure Graphite export (can be scraped by Prometheus)
- [ ] Implement metrics endpoint wrapper if needed
- [ ] Monitor kernel module statistics

### API Gateway
- [ ] Add Prometheus client library
- [ ] Implement request middleware for metrics
- [ ] Track business-specific metrics
- [ ] Expose /metrics endpoint
- [ ] Add WebSocket metrics

## Testing Metrics

### Manual Testing
```bash
# Test Kamailio metrics
curl http://kamailio-pod:9090/metrics

# Test API Gateway metrics
curl http://api-gateway-pod:9090/metrics

# Test from within cluster
kubectl exec -it <prometheus-pod> -n monitoring -- wget -O- http://kamailio-metrics.warp-core:9090/metrics
```

### Verify in Prometheus
1. Access Prometheus UI
2. Go to Status → Targets
3. Verify all endpoints show as "UP"
4. Query metrics:
   ```promql
   # Check if metrics are being collected
   up{job="kamailio"}
   kamailio_calls_active
   rate(api_requests_total[5m])
   ```

## Alert Rules

Example alert rules that should be configured:

```yaml
groups:
- name: sip-alerts
  rules:
  - alert: HighSIPErrorRate
    expr: rate(kamailio_sip_responses_total{status_code=~"5.."}[5m]) > 0.1
    annotations:
      summary: "High SIP 5xx error rate"
      
  - alert: LowRegistrations
    expr: kamailio_registrations_active < 10
    for: 5m
    annotations:
      summary: "Low number of active registrations"
      
  - alert: HighCallVolume
    expr: kamailio_calls_active > 1000
    annotations:
      summary: "High number of concurrent calls"

- name: media-alerts
  rules:
  - alert: HighPacketLoss
    expr: rtpengine_packet_loss_rate > 0.05
    annotations:
      summary: "High media packet loss rate"
      
  - alert: HighJitter
    expr: histogram_quantile(0.95, rtpengine_jitter_seconds) > 0.1
    annotations:
      summary: "High media jitter"

- name: api-alerts
  rules:
  - alert: HighAPIErrorRate
    expr: rate(api_requests_total{status=~"5.."}[5m]) > 0.1
    annotations:
      summary: "High API error rate"
      
  - alert: APIRateLimitExceeded
    expr: rate(api_rate_limit_exceeded_total[5m]) > 1
    annotations:
      summary: "API rate limits being exceeded"
```

## Grafana Dashboard Queries

Essential queries for dashboards:

```promql
# Call setup success rate
sum(rate(kamailio_sip_responses_total{status_code=~"2.."}[5m])) /
sum(rate(kamailio_sip_requests_total{method="INVITE"}[5m]))

# Average call duration
rate(kamailio_call_duration_sum[5m]) /
rate(kamailio_call_duration_count[5m])

# Media quality score
1 - (rtpengine_packet_loss_rate + (histogram_quantile(0.95, rtpengine_jitter_seconds) * 10))

# API response time by endpoint
histogram_quantile(0.95,
  sum(rate(api_request_duration_seconds_bucket[5m])) by (path, le)
)
```

## Next Steps

1. Implement metrics endpoints in each application
2. Deploy updated applications with metrics support
3. Verify metrics collection in Prometheus
4. Create comprehensive Grafana dashboards
5. Configure meaningful alerts
6. Set up notification channels in AlertManager