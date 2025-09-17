# Homer SIP Capture Architecture for WARP Platform

## Overview
Homer provides comprehensive SIP/RTP packet capture, monitoring, and troubleshooting capabilities for the WARP platform. This document defines the deployment strategy and integration points.

## Capture Architecture

### HEP (Homer Encapsulation Protocol) Strategy

```
┌─────────────────────────────────────────────────────────┐
│                   SIP Traffic Flow                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Customers ──SIP──> Kamailio ──SIP──> Providers        │
│      │                 │                    │           │
│      │                 │                    │           │
│      └────HEP v3──────┼────────HEP v3─────┘           │
│                        ↓                                │
│                  Homer Capture                          │
│                     Server                              │
│                                                          │
│  Customers <──RTP──> RTPEngine <──RTP──> Providers     │
│      │                 │                    │           │
│      │                 │                    │           │
│      └────HEP v3──────┼────────HEP v3─────┘           │
│                        ↓                                │
│                  Homer Capture                          │
│                     Server                              │
└─────────────────────────────────────────────────────────┘
```

## Component Integration

### 1. Kamailio Integration (Control Plane)

#### Native HEP Module Configuration
```kamailio
# kamailio.cfg
loadmodule "siptrace.so"

# HEP Configuration
modparam("siptrace", "duplicate_uri", "sip:homer-collector.homer.svc.cluster.local:9060")
modparam("siptrace", "hep_mode_on", 1)
modparam("siptrace", "hep_version", 3)
modparam("siptrace", "hep_capture_id", 2001)  # Unique ID for this Kamailio instance
modparam("siptrace", "trace_to_database", 0)
modparam("siptrace", "trace_flag", 22)
modparam("siptrace", "trace_on", 1)

# Capture all SIP methods
modparam("siptrace", "traced_user_avp", "$avp(trace_user)")
modparam("siptrace", "trace_mode", 1)  # Capture everything

# In routing logic
route {
    # Enable tracing for all messages
    sip_trace();
    setflag(22);

    # Add correlation ID for tracking
    $avp(trace_user) = $ci;  # Call-ID as correlation

    # Regular routing logic continues...
}
```

**What Gets Captured:**
- All SIP messages (INVITE, REGISTER, OPTIONS, etc.)
- SIP responses (100, 180, 200, 4xx, 5xx)
- Transaction states
- Call-ID correlation
- Source/destination IPs
- Timestamps with microsecond precision

### 2. RTPEngine Integration (Media Plane)

#### HEP Support in RTPEngine
```yaml
# rtpengine.conf
[rtpengine]
# Basic configuration
interface = private/10.0.0.10;public/35.x.x.x
listen-ng = 22222
pidfile = /var/run/rtpengine.pid

# Homer HEP integration
homer = homer-collector.homer.svc.cluster.local:9060
homer-protocol = udp
homer-id = 3001  # Unique ID for this RTPEngine instance
homer-capture-mode = all  # Options: all, rtcp, none

# What to capture
recording-method = pcap
recording-format = raw
pcap-capture = all  # Capture all RTP packets
rtcp-capture = on   # Include RTCP for quality metrics
```

**What Gets Captured:**
- RTP packet headers (not payload by default for performance)
- RTCP packets (quality metrics)
- Packet loss indicators
- Jitter measurements
- MOS score calculations
- DTMF events

### 3. Homer Collector Deployment

#### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: homer-collector
  namespace: homer
spec:
  replicas: 3  # HA configuration
  selector:
    matchLabels:
      app: homer-collector
  template:
    metadata:
      labels:
        app: homer-collector
    spec:
      containers:
      - name: heplify-server
        image: sipcapture/heplify-server:latest
        ports:
        - containerPort: 9060
          protocol: UDP
          name: hep
        - containerPort: 9090
          name: prometheus
        env:
        - name: HEPLIFYSERVER_HEPADDR
          value: "0.0.0.0:9060"
        - name: HEPLIFYSERVER_DBDRIVER
          value: "postgres"
        - name: HEPLIFYSERVER_DBADDR
          value: "homer-postgres:5432"
        - name: HEPLIFYSERVER_DBUSER
          value: "homer"
        - name: HEPLIFYSERVER_DBPASS
          valueFrom:
            secretKeyRef:
              name: homer-secrets
              key: db-password
        - name: HEPLIFYSERVER_DBDATABASE
          value: "homer"
        - name: HEPLIFYSERVER_CORRELATIONID
          value: "true"
        - name: HEPLIFYSERVER_PROMADDR
          value: "0.0.0.0:9090"
```

## Capture Strategy

### What We Capture

#### Level 1: Essential (Always On)
- **SIP Signaling**: All SIP messages
- **Call States**: INVITE, BYE, CANCEL
- **Registrations**: REGISTER, authentication
- **Errors**: 4xx, 5xx responses
- **Timeouts**: No response scenarios

#### Level 2: Diagnostic (On-Demand or Sampling)
- **RTP Headers**: For quality analysis
- **RTCP**: Quality reports
- **OPTIONS**: Keep-alive and health checks
- **NOTIFY/SUBSCRIBE**: Presence and events

#### Level 3: Deep Debug (Specific Troubleshooting)
- **Full RTP Payload**: Actual media (storage intensive)
- **TLS Decryption**: If keys available
- **All SIP Headers**: Including custom headers

### Sampling Strategy

```yaml
# To manage volume at scale
sampling:
  default_rate: 100  # Capture 100% in dev/staging
  production:
    signaling: 100   # Always capture all SIP
    rtp_headers: 10  # Sample 10% of RTP headers
    rtp_payload: 0   # Don't capture payload unless debugging
    by_customer:     # Override per customer
      premium: 100   # Premium customers get full capture
      standard: 20   # Standard customers sampled
```

## Storage & Retention

### Database Schema
```sql
-- PostgreSQL for Homer
CREATE TABLE homer_data (
    id BIGSERIAL PRIMARY KEY,
    date timestamp NOT NULL,
    micro_ts BIGINT NOT NULL,
    method VARCHAR(50),
    reply_reason VARCHAR(100),
    ruri VARCHAR(200),
    ruri_user VARCHAR(100),
    from_user VARCHAR(100),
    from_tag VARCHAR(64),
    to_user VARCHAR(100),
    to_tag VARCHAR(64),
    pid_user VARCHAR(100),
    contact_user VARCHAR(100),
    call_id VARCHAR(100),
    callid_aleg VARCHAR(100),
    via_1 VARCHAR(256),
    via_1_branch VARCHAR(80),
    cseq VARCHAR(25),
    reason VARCHAR(200),
    content_type VARCHAR(256),
    authorization VARCHAR(256),
    user_agent VARCHAR(256),
    source_ip VARCHAR(60),
    source_port INTEGER,
    destination_ip VARCHAR(60),
    destination_port INTEGER,
    originator_ip VARCHAR(60),
    originator_port INTEGER,
    correlation_id VARCHAR(256),
    proto INTEGER,
    family INTEGER,
    type INTEGER,
    node VARCHAR(100),
    msg TEXT
) PARTITION BY RANGE (date);

-- Create daily partitions
CREATE TABLE homer_data_20250117 PARTITION OF homer_data
    FOR VALUES FROM ('2025-01-17') TO ('2025-01-18');
```

### Retention Policy
```yaml
retention:
  signaling:
    production: 30_days
    staging: 7_days
    development: 1_day
  rtp_headers:
    production: 7_days
    staging: 1_day
  pcap_files:
    production: 24_hours  # Only for active debug

  # Automatic cleanup
  cleanup_schedule: "0 2 * * *"  # 2 AM daily
  archive_to_gcs: true
  gcs_bucket: "warp-homer-archive"
```

## API Integration

### Homer API Endpoints for WARP
```javascript
// Search for calls by Call-ID
GET /api/v3/search/call
{
  "timestamp": {
    "from": "2025-01-17T00:00:00Z",
    "to": "2025-01-17T23:59:59Z"
  },
  "param": {
    "search": {
      "call_id": "abc123@warp.ringer.tel"
    }
  }
}

// Get call flow diagram
GET /api/v3/call/transaction/{callid}

// Export PCAP
GET /api/v3/export/call/{callid}/pcap

// Quality metrics
GET /api/v3/call/quality/{callid}
{
  "mos": 4.2,
  "packets_lost": 15,
  "jitter_avg": 20,
  "rtt": 45
}
```

### Integration with Customer Portal
```javascript
// Embed Homer search in customer portal
POST /api/v1/troubleshooting/search
{
  "customer_ban": "12345",
  "call_id": "xyz789",
  "date_range": "last_24_hours"
}

// Returns Homer URL with pre-auth token
{
  "homer_url": "https://homer.ringer.tel/call/xyz789",
  "auth_token": "temp_token_abc",
  "expires_in": 3600
}
```

## Performance Considerations

### Network Impact
```yaml
overhead_calculation:
  sip_message: ~2KB average
  hep_header: 60 bytes
  total_overhead: ~3% for SIP

  rtp_packet: 200 bytes average
  hep_encapsulation: 60 bytes
  total_overhead: ~30% for RTP headers only

  # At 1000 concurrent calls
  bandwidth_required:
    sip_signaling: ~100 Kbps
    rtp_headers: ~10 Mbps (sampled at 10%)
    total_homer: ~10.1 Mbps
```

### Storage Requirements
```yaml
storage_calculation:
  per_call:
    sip_messages: ~50KB
    call_duration_avg: 4_minutes
    rtp_headers_sampled: ~200KB
    total_per_call: ~250KB

  daily_volume:
    calls_per_day: 1_000_000
    storage_required: 250GB
    with_compression: 50GB  # 5:1 compression

  monthly_storage: 1.5TB (compressed)
```

## Monitoring & Alerting

### Prometheus Metrics from Homer
```yaml
# Metrics exposed by Homer
homer_captured_packets_total
homer_sip_methods_total{method="INVITE"}
homer_response_codes_total{code="200"}
homer_capture_errors_total
homer_database_inserts_per_second
homer_search_queries_per_second
```

### Alert Rules
```yaml
groups:
- name: homer_alerts
  rules:
  - alert: HomerCaptureDown
    expr: up{job="homer-collector"} == 0
    for: 5m
    annotations:
      summary: "Homer collector is down"

  - alert: HomerHighPacketLoss
    expr: rate(homer_capture_errors_total[5m]) > 100
    annotations:
      summary: "Homer dropping packets"

  - alert: HomerStorageFull
    expr: homer_storage_used_percent > 90
    annotations:
      summary: "Homer storage above 90%"
```

## Security Considerations

1. **HEP Transport Security**
   - Use IPSec for HEP if crossing networks
   - Or use TLS-enabled HEP (HEP over TLS)

2. **Access Control**
   - Homer UI behind Auth0
   - API access via JWT tokens
   - Customer isolation (can only see own calls)

3. **Data Privacy**
   - No RTP payload capture by default
   - PII masking in SIP headers option
   - Automatic purge after retention period

4. **Compliance**
   - Lawful intercept capability (separate config)
   - Audit logs for all searches
   - Data residency controls

## Implementation Priority

### Phase 1: Basic Capture (Week 1)
- Deploy Homer collectors
- Configure Kamailio HEP
- Basic SIP capture working

### Phase 2: RTP Integration (Week 2)
- RTPEngine HEP configuration
- RTCP capture
- Quality metrics

### Phase 3: Portal Integration (Week 3)
- Customer portal search
- Admin troubleshooting tools
- API integration

### Phase 4: Advanced Features (Week 4)
- Alerting rules
- Archival to GCS
- Performance optimization

---
*Homer is critical for troubleshooting and quality assurance in production*