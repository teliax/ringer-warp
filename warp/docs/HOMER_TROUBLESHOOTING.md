# Homer SIP Capture & Troubleshooting Platform

## Overview
Homer (HEP/EEP Capture Server) provides real-time SIP packet capture, call flow visualization, and troubleshooting capabilities for the WARP platform. It enables support teams to diagnose call issues, analyze SIP signaling, and monitor quality metrics.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              SIP Traffic Sources                     │
│  Kamailio | RTPEngine | Customer SIP Endpoints      │
└─────────────────────────────────────────────────────┘
                        │
                   HEP Protocol
                        │
┌─────────────────────────────────────────────────────┐
│              Homer Capture Server                    │
│  HEP Collector | Correlation Engine | DB Writer     │
└─────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────┐
│                Homer Database                        │
│  PostgreSQL with TimescaleDB | Partitioned Tables   │
└─────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────┐
│              Homer Web Interface                     │
│  Search | Call Flow | Analytics | Export            │
└─────────────────────────────────────────────────────┘
```

## Deployment on GKE

### 1. Kubernetes Manifests

```yaml
# homer-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: homer
---
# homer-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: homer-config
  namespace: homer
data:
  homer.toml: |
    # Homer 7 Configuration
    [server]
    listen = "0.0.0.0:9060"

    [database]
    type = "postgresql"
    host = "homer-postgres"
    port = 5432
    user = "homer"
    password = "${HOMER_DB_PASSWORD}"
    database = "homer"

    [hep]
    listen = "0.0.0.0:9060"
    protocol = "udp"

    [prometheus]
    enabled = true
    listen = "0.0.0.0:9096"

    [retention]
    sip_data_days = 30
    rtp_data_days = 7
    logs_days = 14
---
# homer-postgres.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: homer-postgres
  namespace: homer
spec:
  serviceName: homer-postgres
  replicas: 1
  selector:
    matchLabels:
      app: homer-postgres
  template:
    metadata:
      labels:
        app: homer-postgres
    spec:
      containers:
      - name: postgres
        image: timescale/timescaledb:2.11.0-pg15
        env:
        - name: POSTGRES_DB
          value: homer
        - name: POSTGRES_USER
          value: homer
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: homer-secrets
              key: db-password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: standard-rwo
      resources:
        requests:
          storage: 100Gi
---
# homer-app.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: homer-app
  namespace: homer
spec:
  replicas: 3
  selector:
    matchLabels:
      app: homer-app
  template:
    metadata:
      labels:
        app: homer-app
    spec:
      containers:
      - name: homer-app
        image: sipcapture/homer-app:latest
        env:
        - name: DB_HOST
          value: homer-postgres
        - name: DB_USER
          value: homer
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: homer-secrets
              key: db-password
        ports:
        - containerPort: 9060
          protocol: UDP
          name: hep
        - containerPort: 9080
          name: http
        - containerPort: 9096
          name: metrics
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1"
---
# homer-webapp.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: homer-webapp
  namespace: homer
spec:
  replicas: 2
  selector:
    matchLabels:
      app: homer-webapp
  template:
    metadata:
      labels:
        app: homer-webapp
    spec:
      containers:
      - name: homer-webapp
        image: sipcapture/homer-webapp:latest
        env:
        - name: API_URL
          value: "http://homer-api:9080"
        ports:
        - containerPort: 80
          name: http
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
# homer-services.yaml
apiVersion: v1
kind: Service
metadata:
  name: homer-hep
  namespace: homer
spec:
  type: LoadBalancer
  ports:
  - port: 9060
    protocol: UDP
    targetPort: 9060
  selector:
    app: homer-app
---
apiVersion: v1
kind: Service
metadata:
  name: homer-api
  namespace: homer
spec:
  ports:
  - port: 9080
    targetPort: 9080
  selector:
    app: homer-app
---
apiVersion: v1
kind: Service
metadata:
  name: homer-web
  namespace: homer
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 80
  selector:
    app: homer-webapp
---
# homer-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: homer-ingress
  namespace: homer
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - homer.warp.io
    secretName: homer-tls
  rules:
  - host: homer.warp.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: homer-web
            port:
              number: 80
```

### 2. Helm Deployment (Alternative)

```bash
# Add Homer Helm repository
helm repo add homer https://sipcapture.github.io/homer-helm
helm repo update

# Create values file
cat > homer-values.yaml <<EOF
global:
  storageClass: standard-rwo

postgresql:
  enabled: true
  auth:
    database: homer
    username: homer
    password: ${HOMER_DB_PASSWORD}
  primary:
    persistence:
      size: 100Gi
  metrics:
    enabled: true

homer:
  image:
    tag: latest
  replicaCount: 3
  resources:
    requests:
      memory: 1Gi
      cpu: 500m
    limits:
      memory: 2Gi
      cpu: 1000m

  hep:
    enabled: true
    service:
      type: LoadBalancer
      port: 9060
      protocol: UDP

  webapp:
    enabled: true
    replicaCount: 2
    ingress:
      enabled: true
      hostname: homer.warp.io
      tls: true
      annotations:
        cert-manager.io/cluster-issuer: letsencrypt-prod

  persistence:
    enabled: true
    size: 50Gi

  retention:
    sip_data_days: 30
    rtp_data_days: 7
    logs_days: 14

  prometheus:
    enabled: true
    serviceMonitor:
      enabled: true
EOF

# Deploy Homer
helm install homer homer/homer \
  --namespace homer \
  --create-namespace \
  -f homer-values.yaml
```

## Kamailio HEP Integration

### 1. Kamailio Configuration

```bash
# kamailio.cfg modifications

#!define WITH_HOMER

loadmodule "siptrace.so"

# Homer HEP parameters
modparam("siptrace", "duplicate_uri", "sip:homer-hep.homer.svc.cluster.local:9060")
modparam("siptrace", "hep_mode_on", 1)
modparam("siptrace", "hep_version", 3)
modparam("siptrace", "hep_capture_id", 2001)
modparam("siptrace", "trace_to_database", 0)
modparam("siptrace", "trace_flag", 22)
modparam("siptrace", "trace_on", 1)
modparam("siptrace", "trace_mode", 1)

# Correlation header for call-id tracking
modparam("siptrace", "correlation_id_header", "X-CID")

# Main routing logic
request_route {
    # Start tracing for all messages
    sip_trace();
    setflag(22);

    # Add correlation ID
    if (!is_present_hf("X-CID")) {
        append_hf("X-CID: $ci\r\n");
    }

    # Your existing routing logic
    ...
}

# Response route
onreply_route {
    # Trace responses
    sip_trace();
    setflag(22);
}

# Failure route
failure_route[MANAGE_FAILURE] {
    # Trace failures for debugging
    sip_trace();

    # Log to Homer with extended info
    if (t_check_status("^[4-6][0-9][0-9]")) {
        xlog("L_INFO", "Call failed with $rs $rr - traced to Homer\n");
    }
}
```

### 2. RTPEngine HEP Integration

```bash
# rtpengine.conf

[rtpengine]
interface = eth0/10.0.0.10
listen-ng = 22222
port-min = 10000
port-max = 20000

# Homer HEP settings
homer = homer-hep.homer.svc.cluster.local:9060
homer-protocol = udp
homer-id = 2002
hep-capture-id = 2002

# Enable RTCP stats to Homer
rtcp-mux = true
rtcp-stats = true
```

## Homer Database Schema

### 1. TimescaleDB Optimization

```sql
-- Enable TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Create SIP capture table
CREATE TABLE sip_capture (
    id BIGSERIAL,
    date TIMESTAMP NOT NULL DEFAULT NOW(),
    micro_ts BIGINT NOT NULL,
    method VARCHAR(50),
    reply_reason VARCHAR(100),
    ruri VARCHAR(200),
    ruri_user VARCHAR(100),
    ruri_domain VARCHAR(100),
    from_user VARCHAR(100),
    from_domain VARCHAR(100),
    from_tag VARCHAR(64),
    to_user VARCHAR(100),
    to_domain VARCHAR(100),
    to_tag VARCHAR(64),
    pid_user VARCHAR(100),
    contact_user VARCHAR(120),
    auth_user VARCHAR(120),
    callid VARCHAR(120) NOT NULL,
    callid_aleg VARCHAR(120),
    via_1 VARCHAR(256),
    via_1_branch VARCHAR(80),
    cseq VARCHAR(25),
    diversion VARCHAR(256),
    reason VARCHAR(200),
    content_type VARCHAR(256),
    auth VARCHAR(256),
    user_agent VARCHAR(256),
    source_ip VARCHAR(60),
    source_port INTEGER,
    destination_ip VARCHAR(60),
    destination_port INTEGER,
    contact_ip VARCHAR(60),
    contact_port INTEGER,
    originator_ip VARCHAR(60),
    originator_port INTEGER,
    correlation_id VARCHAR(120),
    proto INTEGER,
    family INTEGER,
    rtp_stat TEXT,
    type INTEGER,
    node VARCHAR(125),
    msg TEXT,
    PRIMARY KEY (id, date)
);

-- Convert to hypertable
SELECT create_hypertable('sip_capture', 'date',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Create indexes
CREATE INDEX sip_capture_callid_idx ON sip_capture(callid, date DESC);
CREATE INDEX sip_capture_from_user_idx ON sip_capture(from_user, date DESC);
CREATE INDEX sip_capture_to_user_idx ON sip_capture(to_user, date DESC);
CREATE INDEX sip_capture_method_idx ON sip_capture(method, date DESC);
CREATE INDEX sip_capture_source_ip_idx ON sip_capture(source_ip, date DESC);

-- Compression policy (after 7 days)
ALTER TABLE sip_capture SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'callid,method'
);

SELECT add_compression_policy('sip_capture', INTERVAL '7 days');

-- Retention policy (30 days)
SELECT add_retention_policy('sip_capture', INTERVAL '30 days');

-- RTP statistics table
CREATE TABLE rtcp_capture (
    id BIGSERIAL,
    date TIMESTAMP NOT NULL DEFAULT NOW(),
    micro_ts BIGINT NOT NULL,
    correlation_id VARCHAR(120),
    source_ip VARCHAR(60),
    source_port INTEGER,
    destination_ip VARCHAR(60),
    destination_port INTEGER,
    ssrc BIGINT,
    packets INTEGER,
    lost INTEGER,
    jitter INTEGER,
    mos NUMERIC(3,2),
    r_factor NUMERIC(4,2),
    PRIMARY KEY (id, date)
);

SELECT create_hypertable('rtcp_capture', 'date',
    chunk_time_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);
```

## Support Dashboard Integration

### 1. Custom Homer Queries

```sql
-- Find all calls for a customer in last hour
SELECT
    callid,
    date,
    method,
    from_user,
    to_user,
    source_ip,
    destination_ip,
    msg
FROM sip_capture
WHERE date >= NOW() - INTERVAL '1 hour'
  AND (from_user = '${customer_did}' OR to_user = '${customer_did}')
ORDER BY date DESC;

-- Get call flow for specific call-id
SELECT
    date,
    micro_ts,
    method,
    source_ip || ':' || source_port as source,
    destination_ip || ':' || destination_port as destination,
    msg
FROM sip_capture
WHERE callid = '${call_id}'
  AND date BETWEEN '${start_time}' AND '${end_time}'
ORDER BY micro_ts;

-- Failed calls analysis
SELECT
    COUNT(*) as failed_calls,
    reply_reason,
    destination_ip as carrier,
    AVG(EXTRACT(EPOCH FROM (date - LAG(date) OVER (PARTITION BY callid ORDER BY date)))) as avg_pdd
FROM sip_capture
WHERE method = 'INVITE'
  AND reply_reason LIKE '4%' OR reply_reason LIKE '5%'
  AND date >= NOW() - INTERVAL '1 hour'
GROUP BY reply_reason, destination_ip
ORDER BY failed_calls DESC;

-- Quality metrics by trunk
SELECT
    s.correlation_id,
    s.from_user,
    s.to_user,
    r.mos,
    r.jitter,
    r.lost,
    r.packets
FROM sip_capture s
JOIN rtcp_capture r ON s.correlation_id = r.correlation_id
WHERE s.date >= NOW() - INTERVAL '1 hour'
  AND r.mos < 3.5  -- Poor quality threshold
ORDER BY r.mos ASC;
```

### 2. API Integration

```go
// Homer API client for WARP support tools
package homer

import (
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

type HomerClient struct {
    BaseURL  string
    APIKey   string
    Username string
    Password string
    client   *http.Client
}

type CallFlow struct {
    CallID    string    `json:"callid"`
    StartTime time.Time `json:"start_time"`
    EndTime   time.Time `json:"end_time"`
    Messages  []SIPMessage `json:"messages"`
}

type SIPMessage struct {
    Timestamp   time.Time `json:"timestamp"`
    Method      string    `json:"method"`
    Source      string    `json:"source"`
    Destination string    `json:"destination"`
    Message     string    `json:"raw_message"`
}

func (h *HomerClient) GetCallFlow(callID string) (*CallFlow, error) {
    // Search for call in Homer
    searchReq := map[string]interface{}{
        "timestamp": map[string]interface{}{
            "from": time.Now().Add(-24 * time.Hour).Unix() * 1000,
            "to":   time.Now().Unix() * 1000,
        },
        "param": map[string]interface{}{
            "search": map[string]interface{}{
                "callid": callID,
            },
            "limit": 200,
        },
    }

    resp, err := h.post("/search/call/data", searchReq)
    if err != nil {
        return nil, err
    }

    var callFlow CallFlow
    if err := json.Unmarshal(resp, &callFlow); err != nil {
        return nil, err
    }

    return &callFlow, nil
}

func (h *HomerClient) GetFailedCalls(customerID string, duration time.Duration) ([]CallSummary, error) {
    query := fmt.Sprintf(`
        SELECT callid, from_user, to_user, reply_reason, date
        FROM sip_capture
        WHERE (from_user LIKE '%%%s%%' OR to_user LIKE '%%%s%%')
          AND reply_reason NOT LIKE '200%%'
          AND date >= NOW() - INTERVAL '%d minutes'
        ORDER BY date DESC
    `, customerID, customerID, int(duration.Minutes()))

    return h.executeQuery(query)
}

func (h *HomerClient) GetQualityMetrics(trunkID string) (*QualityReport, error) {
    // Get quality metrics for trunk
    query := fmt.Sprintf(`
        SELECT
            AVG(mos) as avg_mos,
            AVG(jitter) as avg_jitter,
            AVG(lost::float / packets::float) as packet_loss,
            COUNT(*) as call_count
        FROM rtcp_capture
        WHERE correlation_id IN (
            SELECT DISTINCT correlation_id
            FROM sip_capture
            WHERE from_user LIKE '%%%s%%'
              AND date >= NOW() - INTERVAL '1 hour'
        )
    `, trunkID)

    return h.executeQualityQuery(query)
}
```

## Support Tools Integration

### 1. CLI Tool for Support

```bash
#!/bin/bash
# homer-search.sh - Support tool for call troubleshooting

HOMER_URL="https://homer.warp.io"
HOMER_USER="${HOMER_USER:-support}"
HOMER_PASS="${HOMER_PASS}"

search_call() {
    local call_id=$1
    curl -s -X POST "$HOMER_URL/api/v3/search/call/data" \
        -H "Content-Type: application/json" \
        -u "$HOMER_USER:$HOMER_PASS" \
        -d '{
            "timestamp": {
                "from": "'$(date -d '24 hours ago' +%s000)'",
                "to": "'$(date +%s000)'"
            },
            "param": {
                "search": {
                    "callid": "'$call_id'"
                },
                "limit": 200
            }
        }' | jq '.'
}

get_pcap() {
    local call_id=$1
    curl -s -X GET "$HOMER_URL/api/v3/export/call/pcap/$call_id" \
        -u "$HOMER_USER:$HOMER_PASS" \
        -o "$call_id.pcap"
    echo "PCAP saved to $call_id.pcap"
}

show_call_flow() {
    local call_id=$1
    curl -s -X GET "$HOMER_URL/api/v3/call/flow/$call_id" \
        -u "$HOMER_USER:$HOMER_PASS" \
        -H "Accept: text/plain" | less
}

# Usage
case "$1" in
    search)
        search_call "$2"
        ;;
    pcap)
        get_pcap "$2"
        ;;
    flow)
        show_call_flow "$2"
        ;;
    *)
        echo "Usage: $0 {search|pcap|flow} <call-id>"
        exit 1
        ;;
esac
```

### 2. Web UI Integration

```typescript
// Homer integration for WARP support portal
import axios from 'axios';

class HomerService {
  private apiUrl = process.env.HOMER_API_URL;
  private apiKey = process.env.HOMER_API_KEY;

  async searchCalls(params: CallSearchParams): Promise<CallResult[]> {
    const response = await axios.post(
      `${this.apiUrl}/search/call/data`,
      {
        timestamp: {
          from: params.startTime.getTime(),
          to: params.endTime.getTime()
        },
        param: {
          search: params.filters,
          limit: params.limit || 100
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.data;
  }

  async getCallFlow(callId: string): Promise<CallFlow> {
    const response = await axios.get(
      `${this.apiUrl}/call/flow/${callId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      }
    );

    return response.data;
  }

  async exportPCAP(callId: string): Promise<Blob> {
    const response = await axios.get(
      `${this.apiUrl}/export/call/pcap/${callId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        responseType: 'blob'
      }
    );

    return response.data;
  }

  async getQualityMetrics(filters: QualityFilters): Promise<QualityMetrics> {
    const response = await axios.post(
      `${this.apiUrl}/stats/quality`,
      filters,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      }
    );

    return response.data;
  }
}

// React component for call troubleshooting
const CallTroubleshooter: React.FC = () => {
  const [callId, setCallId] = useState('');
  const [callFlow, setCallFlow] = useState<CallFlow | null>(null);
  const [loading, setLoading] = useState(false);

  const homer = new HomerService();

  const handleSearch = async () => {
    setLoading(true);
    try {
      const flow = await homer.getCallFlow(callId);
      setCallFlow(flow);
    } catch (error) {
      console.error('Failed to fetch call flow:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPCAP = async () => {
    const blob = await homer.exportPCAP(callId);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${callId}.pcap`;
    a.click();
  };

  return (
    <div className="call-troubleshooter">
      <input
        type="text"
        value={callId}
        onChange={(e) => setCallId(e.target.value)}
        placeholder="Enter Call-ID"
      />
      <button onClick={handleSearch}>Search</button>
      <button onClick={handleExportPCAP}>Export PCAP</button>

      {callFlow && (
        <CallFlowDiagram flow={callFlow} />
      )}
    </div>
  );
};
```

## Monitoring & Alerts

### 1. Prometheus Metrics

```yaml
# prometheus-rules.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: homer-alerts
  namespace: homer
spec:
  groups:
  - name: homer.rules
    interval: 30s
    rules:
    - alert: HomerHighIngestionLag
      expr: |
        homer_ingestion_lag_seconds > 5
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Homer ingestion lag is high"
        description: "Homer is {{ $value }} seconds behind in processing HEP packets"

    - alert: HomerDatabaseFull
      expr: |
        pg_database_size_bytes{datname="homer"} / 1024/1024/1024 > 80
      for: 10m
      labels:
        severity: critical
      annotations:
        summary: "Homer database is nearly full"
        description: "Homer database is using {{ $value }}GB of storage"

    - alert: HomerHighFailureRate
      expr: |
        rate(sip_capture_failed_total[5m]) > 100
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High SIP failure rate detected"
        description: "{{ $value }} failed calls per second"
```

### 2. Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Homer SIP Monitoring",
    "panels": [
      {
        "title": "Call Volume",
        "targets": [
          {
            "expr": "rate(homer_messages_total[5m])",
            "legendFormat": "{{ method }}"
          }
        ]
      },
      {
        "title": "Response Codes",
        "targets": [
          {
            "expr": "sum by (code) (rate(homer_response_codes_total[5m]))",
            "legendFormat": "{{ code }}"
          }
        ]
      },
      {
        "title": "Call Quality (MOS)",
        "targets": [
          {
            "expr": "histogram_quantile(0.5, homer_mos_bucket)",
            "legendFormat": "Median MOS"
          }
        ]
      },
      {
        "title": "Packet Loss",
        "targets": [
          {
            "expr": "avg(homer_packet_loss_ratio)",
            "legendFormat": "Avg Packet Loss"
          }
        ]
      }
    ]
  }
}
```

## Security & Access Control

### 1. RBAC Configuration

```yaml
# homer-rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: homer-viewer
  namespace: homer
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: homer-viewer
  namespace: homer
rules:
- apiGroups: [""]
  resources: ["pods", "services"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["pods/log"]
  verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: homer-viewer-binding
  namespace: homer
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: homer-viewer
subjects:
- kind: ServiceAccount
  name: homer-viewer
  namespace: homer
```

### 2. User Access Levels

```sql
-- Homer user roles
CREATE TABLE homer_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    customer_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Role definitions
-- 'admin': Full access to all data
-- 'support': Access to all customer data for troubleshooting
-- 'customer': Access only to their own data
-- 'readonly': Read-only access to assigned data

INSERT INTO homer_users (username, password_hash, role) VALUES
('admin', '$2b$10$...', 'admin'),
('support_team', '$2b$10$...', 'support'),
('customer_abc', '$2b$10$...', 'customer');

-- Row-level security for customer isolation
ALTER TABLE sip_capture ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_isolation ON sip_capture
    FOR SELECT
    USING (
        current_setting('app.current_user_role') = 'admin' OR
        current_setting('app.current_user_role') = 'support' OR
        (current_setting('app.current_user_role') = 'customer' AND
         (from_user LIKE current_setting('app.customer_prefix') || '%' OR
          to_user LIKE current_setting('app.customer_prefix') || '%'))
    );
```

## Troubleshooting Playbooks

### 1. Call Failure Investigation

```markdown
## Playbook: Investigating Failed Calls

1. **Get Call-ID from customer or CDR**
   ```bash
   homer-search.sh search <call-id>
   ```

2. **Check SIP flow**
   - Look for INVITE
   - Check response codes
   - Verify routing decisions

3. **Common failure patterns**:
   - 403 Forbidden: Authentication issue
   - 404 Not Found: Routing problem
   - 486 Busy: Endpoint issue
   - 503 Service Unavailable: Carrier issue

4. **Export PCAP for detailed analysis**
   ```bash
   homer-search.sh pcap <call-id>
   wireshark <call-id>.pcap
   ```

5. **Check RTP quality if call connected**
   - Look for RTCP reports
   - Check MOS score
   - Verify packet loss
```

### 2. Quality Issues Investigation

```sql
-- Find calls with poor quality
SELECT
    s.callid,
    s.from_user,
    s.to_user,
    r.mos,
    r.jitter,
    r.lost::float / r.packets::float * 100 as packet_loss_pct
FROM sip_capture s
JOIN rtcp_capture r ON s.correlation_id = r.correlation_id
WHERE s.date >= NOW() - INTERVAL '1 hour'
  AND (r.mos < 3.5 OR r.lost::float / r.packets::float > 0.01)
ORDER BY r.mos ASC
LIMIT 20;
```

## Integration with Support System

```typescript
// Integration with WARP support ticket system
class SupportIntegration {
  async attachCallDetailsToTicket(ticketId: string, callId: string) {
    // Get call details from Homer
    const callFlow = await this.homer.getCallFlow(callId);
    const quality = await this.homer.getQualityMetrics(callId);

    // Generate report
    const report = this.generateCallReport(callFlow, quality);

    // Attach to support ticket
    await this.ticketSystem.addAttachment(ticketId, {
      type: 'call_analysis',
      content: report,
      callId: callId,
      timestamp: new Date()
    });

    // Export PCAP if requested
    if (this.shouldExportPCAP(callFlow)) {
      const pcap = await this.homer.exportPCAP(callId);
      await this.ticketSystem.addFile(ticketId, pcap, `${callId}.pcap`);
    }
  }

  generateCallReport(flow: CallFlow, quality: QualityMetrics): string {
    return `
# Call Analysis Report

## Call Details
- Call ID: ${flow.callId}
- Start Time: ${flow.startTime}
- Duration: ${flow.duration}s
- From: ${flow.from}
- To: ${flow.to}

## Quality Metrics
- MOS Score: ${quality.mos}
- Packet Loss: ${quality.packetLoss}%
- Jitter: ${quality.jitter}ms

## SIP Flow
${flow.messages.map(m => `${m.timestamp}: ${m.method} ${m.source} -> ${m.destination}`).join('\n')}

## Recommendation
${this.generateRecommendation(flow, quality)}
    `;
  }
}
```