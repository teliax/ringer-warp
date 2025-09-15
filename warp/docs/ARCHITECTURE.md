# WARP Platform Architecture

## Overview
WARP is a carrier-grade SIP trunking and messaging platform built on Google Cloud Platform, designed for wholesale telecom carriers requiring high availability, scalability, and API-driven automation.

## Technology Stack

### Cloud Infrastructure
- **Provider**: Google Cloud Platform (GCP)
- **Orchestration**: Kubernetes (GKE with Autopilot)
- **Networking**: Cloud NAT, Private Service Connect
- **Security**: Cloud Armor, Cloud IAM
- **Load Balancing**: Cloud Load Balancing (L4/L7)

### Core Components

| Component | Technology | Deployment | Purpose |
|-----------|------------|------------|---------|
| SIP Control | Kamailio | GKE Autopilot | SIP signaling, routing |
| Media Processing | RTPEngine | GCP VMs | RTP/transcoding |
| API Services | Go, Rust | GKE Autopilot | Business logic |
| Web Portal | Next.js/TypeScript | Vercel | Customer UI |
| SMSC | Jasmin | GKE | SMS/MMS gateway |
| SIP Capture | Homer | GKE | Troubleshooting/Debug |
| Service Discovery | Consul | GKE | Service mesh |
| Auth | Auth0/Keycloak | Managed/GKE | OAuth/RBAC |

### Data Stores

| Store | Technology | Use Case |
|-------|------------|----------|
| Primary DB | PostgreSQL (Cloud SQL) | Customers, configs |
| Analytics DB | BigQuery | CDRs, MDRs, usage analytics |
| Cache | Redis Cluster | Sessions, routing cache, prepaid balance |
| Config Store | Consul | Service configuration |
| Time-Series | BigQuery (partitioned) | Real-time metrics |

## Architecture Layers

### 1. Presentation Layer
```
┌──────────────────────────────────────┐
│         Customer Portal              │
│    Next.js + TypeScript + Tailwind   │
│         Deployed on Vercel           │
└──────────────────────────────────────┘
            ↓ HTTPS/WSS
```

### 2. API Gateway Layer
```
┌──────────────────────────────────────┐
│         Cloud Load Balancer          │
│         + Cloud Armor (DDoS)         │
└──────────────────────────────────────┘
            ↓
┌──────────────────────────────────────┐
│          API Gateway                 │
│    Rate Limiting, Auth, Routing      │
└──────────────────────────────────────┘
```

### 3. Application Services Layer
```
┌────────────┬────────────┬────────────┐
│  Customer  │   Trunk    │  Billing   │
│   Service  │  Service   │  Service   │
│    (Go)    │   (Go)     │   (Rust)   │
├────────────┼────────────┼────────────┤
│  Routing   │ Messaging  │ Analytics  │
│  Service   │  Service   │  Service   │
│   (Rust)   │    (Go)    │   (Java)   │
└────────────┴────────────┴────────────┘
     All deployed on GKE Autopilot
```

### 4. Communication Layer
```
┌────────────┬────────────┬────────────┐
│ Kamailio   │ RTPEngine  │  Jasmin    │
│   (SIP)    │  (Media)   │   (SMS)    │
└────────────┴────────────┴────────────┘
```

### 5. Data Layer
```
┌────────────┬────────────┬────────────┐
│PostgreSQL  │  BigQuery  │   Redis    │
│ (Cloud SQL)│ (CDR/MDR)  │  Cluster   │
└────────────┴────────────┴────────────┘
```

## Deployment Architecture

### GKE Autopilot Clusters

```yaml
Primary Region: us-central1
- Control Plane Services
- API Services
- Jasmin SMSC
- CockroachDB nodes
- Consul servers

Secondary Region: us-east1
- Standby Control Plane
- Read replicas
- Disaster recovery
```

### GCP VM Instance Groups

```yaml
Media Processing VMs:
- Machine Type: n2-standard-8
- Regions: us-central1, us-east1
- Autoscaling: 2-100 instances
- Software: RTPEngine
- Discovery: Consul agents
```

## Network Architecture

### External Connectivity
```
Internet → Cloud CDN → Cloud LB → Cloud Armor
                ↓
         GKE Ingress Controller
                ↓
         Internal Services
```

### Internal Networking
```
Service Mesh (Consul):
- Service discovery
- Health checking
- Configuration management
- mTLS between services

Private Service Connect:
- Cloud SQL access
- Redis access
- Cross-region connectivity
```

### SIP/RTP Flow
```
Customer SIP → Cloud LB (UDP/TCP 5060)
     ↓
Kamailio (GKE)
     ↓
RTPEngine (VMs) ← RTP/SRTP Media
     ↓
Carrier Network
```

## Security Architecture

### Authentication & Authorization
- **OAuth Provider**: Auth0 or Keycloak
- **Token Type**: JWT with refresh tokens
- **MFA**: Required for admin roles
- **RBAC**: 7 role types with granular permissions

### Network Security
- **DDoS Protection**: Cloud Armor
- **WAF**: Cloud Armor security policies
- **Firewall**: VPC firewall rules
- **Private IPs**: RFC1918 for internal services
- **Encryption**: TLS 1.3 for APIs, SRTP for media

### Data Security
- **Encryption at Rest**: Cloud KMS
- **Encryption in Transit**: TLS/mTLS
- **Secrets Management**: Google Secret Manager
- **Audit Logging**: Cloud Audit Logs

## Scalability Design

### Horizontal Scaling
- **API Services**: GKE Autopilot auto-scaling
- **Kamailio**: Multiple instances behind LB
- **RTPEngine**: VM instance groups with autoscaling
- **Databases**: Read replicas and sharding

### Vertical Scaling
- **PostgreSQL**: Cloud SQL automatic storage increase
- **Redis**: Cluster mode with resharding
- **CockroachDB**: Automatic data distribution

### Geographic Scaling
- **Multi-Region**: Active-passive setup
- **CDN**: Cloud CDN for static assets
- **Edge Locations**: Vercel edge for UI

## High Availability

### Service Redundancy
- **Kamailio**: N+1 redundancy
- **RTPEngine**: Geographic distribution
- **API Services**: Multiple replicas
- **Databases**: Multi-zone deployments

### Failover Strategy
- **RTO**: < 5 minutes
- **RPO**: < 1 minute
- **Health Checks**: Every 5 seconds
- **Automatic Failover**: Via Cloud LB

### Backup Strategy
- **Database Backups**: Daily automated
- **CDR Archives**: 7-year retention
- **Configuration Backups**: Git versioned
- **Disaster Recovery**: Cross-region replication

## Monitoring & Observability

### Metrics Collection
- **Infrastructure**: Google Cloud Monitoring
- **Application**: Prometheus + Grafana
- **SIP/RTP**: Homer SIP capture
- **Traces**: OpenTelemetry → Cloud Trace

### Logging
- **Centralized Logging**: Cloud Logging
- **Log Aggregation**: Fluentd
- **Retention**: 30 days hot, 1 year cold
- **Analysis**: BigQuery for log analytics

### Alerting
- **Platform**: PagerDuty integration
- **Channels**: Email, SMS, Slack
- **SLO Monitoring**: 99.999% uptime target
- **Escalation**: 3-tier on-call rotation

## CI/CD Pipeline

### Source Control
```
GitHub Repository Structure:
├── services/
│   ├── api/          # Go/Rust services
│   ├── web/          # Next.js portal
│   └── config/       # Kamailio configs
├── infrastructure/
│   ├── terraform/    # IaC definitions
│   ├── k8s/         # Kubernetes manifests
│   └── helm/        # Helm charts
└── docs/
    ├── api/         # OpenAPI specs
    └── architecture/
```

### Build Pipeline
1. **Code Commit** → GitHub
2. **CI Tests** → GitHub Actions
3. **Container Build** → Cloud Build
4. **Image Push** → Artifact Registry
5. **Security Scan** → Container Analysis

### Deployment Pipeline
1. **Dev Environment** → Automatic
2. **Staging Environment** → Automatic
3. **Production** → Manual approval
4. **Rollback** → Automated on failure

## Performance Targets

### API Performance
- **Latency p50**: < 50ms
- **Latency p99**: < 200ms
- **Throughput**: 10,000 req/s
- **Error Rate**: < 0.1%

### SIP Performance
- **Call Setup Time**: < 500ms
- **Registration Time**: < 100ms
- **CPS (Calls/Second)**: 1,000
- **Concurrent Calls**: 100,000

### SMS Performance
- **Submit Response**: < 100ms
- **Delivery Time**: < 5 seconds
- **MPS (Messages/Second)**: 500
- **Queue Capacity**: 1M messages

## Cost Optimization

### Resource Management
- **Preemptible VMs**: For batch processing
- **Committed Use**: 3-year for stable workloads
- **Autoscaling**: Scale down during low usage
- **Regional Resources**: Use closest regions

### Data Management
- **Lifecycle Policies**: Archive old CDRs
- **Compression**: For stored data
- **Caching**: Reduce database queries
- **CDN**: Reduce egress costs

## Integration Points

### External APIs
- **Telique**: LERG/LRN lookups
- **Sinch**: A2P SMS delivery
- **Number Portability**: Daily sync
- **E911**: Emergency services
- **CNAM**: Caller ID services

### Carrier Integrations
- **SIP Trunking**: Standard SIP/RTP
- **SMPP**: Version 3.4/5.0
- **MM4**: For MMS delivery
- **REST APIs**: Webhook notifications

## Disaster Recovery

### Backup Locations
- **Primary**: us-central1
- **Secondary**: us-east1
- **Archive**: Cloud Storage (multi-region)

### Recovery Procedures
1. **Detection**: Automated monitoring
2. **Assessment**: Impact analysis
3. **Failover**: Automated or manual
4. **Validation**: Service health checks
5. **Communication**: Status page updates

### Testing Schedule
- **Monthly**: Backup restoration test
- **Quarterly**: Failover drill
- **Annually**: Full DR exercise

## Compliance & Regulatory

### Standards
- **GDPR**: Data protection compliance
- **HIPAA**: Healthcare communications
- **PCI DSS**: Payment card data
- **SOC 2**: Security controls

### Telecom Regulations
- **FCC**: USF compliance
- **STIR/SHAKEN**: Call authentication
- **TCPA**: Messaging compliance
- **E911**: Emergency services

## Future Considerations

### Planned Enhancements
- **WebRTC**: Browser-based calling
- **Video**: Video calling support
- **AI/ML**: Fraud detection, QoS optimization
- **Global Expansion**: EU and APAC regions
- **5G Integration**: Network slicing support

### Technology Evolution
- **Service Mesh**: Istio migration
- **Serverless**: Cloud Run for stateless services
- **Edge Computing**: Regional PoPs
- **Quantum-Safe**: Post-quantum cryptography