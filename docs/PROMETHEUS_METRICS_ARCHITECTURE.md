# Prometheus Metrics Architecture for WARP Platform

## Overview
Comprehensive real-time metrics collection using Prometheus for all platform components, enabling low-latency dashboards and alerting without database table scans.

## Core Metrics Philosophy
- **Push metrics at event time** - No polling or batch processing
- **Pre-aggregate common queries** - Avoid runtime calculations
- **Account-level granularity** - Every metric tagged with account/customer
- **High cardinality support** - Use appropriate storage (Cortex/Thanos)
- **Real-time alerting** - Sub-minute detection of issues

## Metrics Collection Points

### 1. Call Metrics (Kamailio/RTPEngine)

#### Per-Call Metrics
```prometheus
# Call attempts counter
warp_call_attempts_total{
  account="12345",
  trunk="trunk_id",
  direction="inbound|outbound",
  zone="INTERSTATE|INTRASTATE|LOCAL|INTL|TOLLFREE",
  destination_country="US",
  origination_country="US"
}

# Call duration histogram (seconds)
warp_call_duration_seconds{
  account="12345",
  trunk="trunk_id",
  direction="inbound|outbound",
  zone="INTERSTATE|INTRASTATE|LOCAL|INTL|TOLLFREE",
  status="completed|failed|short"
}

# Post-Dial Delay histogram (milliseconds)
warp_pdd_milliseconds{
  account="12345",
  trunk="trunk_id",
  provider="provider_id",
  zone="INTERSTATE|INTRASTATE|LOCAL|INTL|TOLLFREE"
}

# Active calls gauge
warp_active_calls{
  account="12345",
  trunk="trunk_id",
  direction="inbound|outbound"
}

# Call termination reasons
warp_call_terminations_total{
  account="12345",
  trunk="trunk_id",
  reason="normal|busy|no_answer|failed|timeout",
  sip_code="200|486|487|503|408"
}
```

#### Quality Metrics
```prometheus
# Answer-Seizure Ratio (ASR)
warp_asr_ratio{
  account="12345",
  trunk="trunk_id",
  provider="provider_id",
  zone="INTERSTATE|INTRASTATE|LOCAL|INTL|TOLLFREE",
  window="5m|1h|24h"
}

# Average Call Duration (ACD)
warp_acd_seconds{
  account="12345",
  trunk="trunk_id",
  provider="provider_id",
  zone="INTERSTATE|INTRASTATE|LOCAL|INTL|TOLLFREE",
  window="5m|1h|24h"
}

# Network Effectiveness Ratio (NER)
warp_ner_ratio{
  account="12345",
  trunk="trunk_id",
  provider="provider_id"
}

# Short Call Ratio (calls < 6 seconds)
warp_short_call_ratio{
  account="12345",
  trunk="trunk_id",
  threshold_seconds="6"
}
```

#### Media Quality Metrics (from RTPEngine)
```prometheus
# RTP packet loss
warp_rtp_packet_loss_ratio{
  account="12345",
  call_id="uuid",
  direction="inbound|outbound",
  codec="PCMU|PCMA|G729"
}

# RTP jitter (milliseconds)
warp_rtp_jitter_ms{
  account="12345",
  call_id="uuid",
  direction="inbound|outbound"
}

# MOS score estimation
warp_mos_score{
  account="12345",
  call_id="uuid"
}
```

### 2. Financial Metrics

#### Usage & Spend
```prometheus
# Running spend counter (cents)
warp_spend_cents_total{
  account="12345",
  service="voice|sms|toll_free",
  zone="INTERSTATE|INTRASTATE|LOCAL|INTL|TOLLFREE"
}

# Minutes used counter
warp_minutes_used_total{
  account="12345",
  trunk="trunk_id",
  zone="INTERSTATE|INTRASTATE|LOCAL|INTL|TOLLFREE",
  billable="true|false"
}

# Account balance gauge
warp_account_balance_dollars{
  account="12345",
  type="prepaid|postpaid"
}

# Credit limit gauge
warp_credit_limit_dollars{
  account="12345"
}

# Margin calculation
warp_margin_percentage{
  account="12345",
  trunk="trunk_id",
  zone="INTERSTATE|INTRASTATE|LOCAL|INTL|TOLLFREE"
}
```

### 3. SMS/Messaging Metrics

```prometheus
# SMS sent counter
warp_sms_sent_total{
  account="12345",
  campaign="campaign_id",
  status="delivered|failed|pending",
  direction="outbound|inbound",
  carrier="att|verizon|tmobile|other"
}

# SMS segments counter (for long messages)
warp_sms_segments_total{
  account="12345",
  campaign="campaign_id"
}

# 10DLC throughput gauge
warp_10dlc_throughput_per_second{
  account="12345",
  campaign="campaign_id",
  brand="brand_id"
}

# SMS delivery latency
warp_sms_delivery_latency_seconds{
  account="12345",
  carrier="att|verizon|tmobile",
  percentile="50|95|99"
}
```

### 4. API & System Metrics

```prometheus
# API request rate
warp_api_requests_total{
  account="12345",
  endpoint="/v1/calls|/v1/trunks|/v1/numbers",
  method="GET|POST|PUT|DELETE",
  status="2xx|4xx|5xx"
}

# API latency histogram
warp_api_latency_milliseconds{
  account="12345",
  endpoint="/v1/calls|/v1/trunks",
  method="GET|POST|PUT|DELETE",
  percentile="50|95|99"
}

# Rate limit hits
warp_rate_limit_hits_total{
  account="12345",
  limit_type="api|calls_per_second|concurrent_calls"
}

# Authentication failures
warp_auth_failures_total{
  account="12345",
  reason="invalid_credentials|expired_token|rate_limited"
}
```

### 5. DIP (Real-time Query) Metrics

```prometheus
# LRN dip latency
warp_lrn_dip_latency_milliseconds{
  provider="telique",
  status="success|failure|timeout"
}

# CIC dip latency
warp_cic_dip_latency_milliseconds{
  status="success|failure|timeout"
}

# CNAM dip latency
warp_cnam_dip_latency_milliseconds{
  provider="transunion",
  status="success|failure|timeout"
}

# DIP cache hit ratio
warp_dip_cache_hit_ratio{
  dip_type="lrn|cic|cnam",
  window="5m|1h"
}
```

### 6. Infrastructure Metrics

```prometheus
# Kamailio health
warp_kamailio_health{
  instance="kamailio-1",
  status="healthy|degraded|unhealthy"
}

# RTPEngine capacity
warp_rtpengine_sessions_active{
  instance="rtpengine-1"
}

warp_rtpengine_capacity_percentage{
  instance="rtpengine-1"
}

# Database connection pool
warp_db_connections_active{
  service="api|kamailio|billing",
  database="postgres|mysql"
}

# Redis memory usage
warp_redis_memory_used_bytes{
  instance="redis-1",
  db="0|1|2"
}
```

## Exporters Architecture

### 1. Kamailio Exporter
```go
// Custom exporter embedded in Kamailio Lua scripts
type KamailioExporter struct {
    pushGateway string
    metrics     map[string]prometheus.Metric
}

// Push metrics on every call event
func (e *KamailioExporter) OnCallStart(call *CallInfo) {
    metrics.CallAttempts.WithLabelValues(
        call.Account,
        call.Trunk,
        call.Direction,
        call.Zone,
    ).Inc()
}

func (e *KamailioExporter) OnCallEnd(call *CallInfo) {
    metrics.CallDuration.WithLabelValues(
        call.Account,
        call.Trunk,
        call.Status,
    ).Observe(call.Duration.Seconds())

    // Update ASR/ACD in real-time
    e.updateQualityMetrics(call)
}
```

### 2. Billing Exporter
```go
// Real-time billing metrics pusher
type BillingExporter struct {
    db          *sql.DB
    pushGateway string
    interval    time.Duration
}

func (e *BillingExporter) PushSpendMetrics(cdr *CDR) {
    metrics.SpendCents.WithLabelValues(
        cdr.Account,
        cdr.Service,
        cdr.Zone,
    ).Add(float64(cdr.CostCents))

    metrics.MinutesUsed.WithLabelValues(
        cdr.Account,
        cdr.Trunk,
        cdr.Zone,
        strconv.FormatBool(cdr.Billable),
    ).Add(cdr.Duration.Minutes())
}
```

### 3. API Gateway Exporter
```go
// Middleware for API metrics
func PrometheusMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()

        c.Next()

        duration := time.Since(start)
        status := strconv.Itoa(c.Writer.Status())

        metrics.APIRequests.WithLabelValues(
            c.GetString("account_id"),
            c.Request.URL.Path,
            c.Request.Method,
            status,
        ).Inc()

        metrics.APILatency.WithLabelValues(
            c.GetString("account_id"),
            c.Request.URL.Path,
            c.Request.Method,
        ).Observe(duration.Seconds())
    }
}
```

## Storage Strategy

### Prometheus + Cortex/Thanos
```yaml
# High cardinality support for account-level metrics
storage:
  backend: cortex  # or thanos
  retention:
    raw: 7d       # Raw metrics for 7 days
    5m: 30d       # 5-minute aggregates for 30 days
    1h: 90d       # Hourly aggregates for 90 days
    1d: 365d      # Daily aggregates for 1 year

  # Sharding by account for scalability
  sharding:
    key: account
    shards: 16
```

## Grafana Dashboards

### 1. Account Overview Dashboard
```json
{
  "dashboard": "Account Overview",
  "panels": [
    {
      "title": "Current Spend Rate",
      "query": "rate(warp_spend_cents_total[5m])"
    },
    {
      "title": "Active Calls",
      "query": "warp_active_calls"
    },
    {
      "title": "Call Volume (24h)",
      "query": "increase(warp_call_attempts_total[24h])"
    },
    {
      "title": "ASR Trend",
      "query": "warp_asr_ratio{window='5m'}"
    },
    {
      "title": "Average PDD",
      "query": "histogram_quantile(0.95, warp_pdd_milliseconds)"
    }
  ]
}
```

### 2. Quality Monitoring Dashboard
```json
{
  "dashboard": "Quality Metrics",
  "panels": [
    {
      "title": "ASR by Provider",
      "query": "warp_asr_ratio{window='5m'} by (provider)"
    },
    {
      "title": "Short Call Percentage",
      "query": "warp_short_call_ratio * 100"
    },
    {
      "title": "Network Effectiveness",
      "query": "warp_ner_ratio"
    },
    {
      "title": "RTP Quality Issues",
      "query": "warp_rtp_packet_loss_ratio > 0.01"
    }
  ]
}
```

## Alerting Rules

```yaml
groups:
  - name: account_alerts
    rules:
      - alert: HighSpendRate
        expr: rate(warp_spend_cents_total[5m]) > 10000  # $100/5min
        for: 5m
        annotations:
          summary: "Account {{ $labels.account }} spending rapidly"

      - alert: LowASR
        expr: warp_asr_ratio{window="5m"} < 0.3
        for: 10m
        annotations:
          summary: "Low ASR for account {{ $labels.account }}"

      - alert: HighShortCalls
        expr: warp_short_call_ratio > 0.5
        for: 15m
        annotations:
          summary: "High short call ratio for {{ $labels.account }}"

      - alert: ApproachingCreditLimit
        expr: |
          warp_account_balance_dollars / warp_credit_limit_dollars < 0.1
        for: 5m
        annotations:
          summary: "Account {{ $labels.account }} near credit limit"
```

## Implementation Priority

### Phase 1: Core Call Metrics
1. Call attempts, duration, completion
2. ASR/ACD/NER calculations
3. Account spend tracking
4. Active call gauges

### Phase 2: Quality Metrics
1. PDD tracking
2. Short call detection
3. RTP quality metrics
4. Provider performance

### Phase 3: Advanced Analytics
1. Predictive spend alerts
2. Fraud detection metrics
3. Capacity planning metrics
4. Margin analysis

## Benefits

1. **Real-time Dashboards** - Sub-second updates without DB queries
2. **Historical Analysis** - Pre-aggregated data for fast queries
3. **Alerting** - Immediate notification of issues
4. **Capacity Planning** - Trend analysis and forecasting
5. **Cost Optimization** - Identify high-cost routes/patterns
6. **Quality Monitoring** - Instant visibility into call quality
7. **Fraud Detection** - Anomaly detection on spending patterns

## Integration Points

- **Kamailio**: Lua scripts push metrics on every call event
- **RTPEngine**: Native Prometheus exporter + custom metrics
- **API Gateway**: Middleware for request metrics
- **Billing Service**: Push metrics on CDR processing
- **SMS Gateway**: Metrics on message events
- **DIP Services**: Latency and cache metrics

## Query Examples

```promql
# Account daily spend
increase(warp_spend_cents_total[24h]) / 100

# Concurrent calls per account
max_over_time(warp_active_calls[1h])

# Provider performance ranking
sort_desc(
  avg_over_time(warp_asr_ratio{window="1h"}[24h]) by (provider)
)

# Fraud detection - unusual spend spike
rate(warp_spend_cents_total[5m]) >
  avg_over_time(rate(warp_spend_cents_total[5m])[1h:5m]) * 3
```

---

This architecture provides comprehensive, real-time visibility into all aspects of the platform without expensive database operations, enabling instant dashboards and proactive monitoring.