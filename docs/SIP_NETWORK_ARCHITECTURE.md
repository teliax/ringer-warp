# SIP Network Architecture Decisions

## Core Design: Shared Infrastructure Model

### Decision: Multi-Tenant Shared Resources
- **Kamailio Pods**: Shared across all customers (5-10 replicas)
- **RTPEngine VMs**: Shared pool (not per-customer)
- **Isolation**: Logical via database/config (not physical)
- **Rationale**: Cost efficiency (10-100x cheaper than dedicated)

### Enterprise Option
- Dedicated namespace/resources available at premium pricing
- Required for certain compliance scenarios (HIPAA, government)

## IP Address Architecture

### Origination IPs (Ringer → Customer)
**Decision: Static IP Pool with Cloud NAT**

```yaml
Production IPs:
  Primary Pool (us-central1):
    - 34.123.45.10  # origination-ip-1
    - 34.123.45.11  # origination-ip-2
    - 34.123.45.12  # origination-ip-3

  Backup Pool (us-east1):
    - 35.234.56.20  # origination-backup-1
    - 35.234.56.21  # origination-backup-2

Customer Requirements:
  - Must whitelist ALL 5 IPs
  - Document in customer portal
  - Provide IP reputation monitoring
```

### Termination IPs (Customer → Ringer)
**Decision: Single Anycast IP with Load Balancer**

```yaml
Ingress IP:
  - 34.123.100.1  # Single anycast IP for all customers
  - Cloud Load Balancer distributes to Kamailio pods
  - DDoS protection via Cloud Armor
```

### Media (RTP) IPs
**Decision: Separate IP Range for RTP**

```yaml
RTP Pool:
  - 34.123.46.0/28  # 16 IPs for RTPEngine VMs
  - Customer opens UDP 10000-20000 from this range
  - NAT traversal handled by RTPEngine
```

## Authentication Architecture

### Customer Trunk Authentication
**Decision: IP ACL Primary, Registration Secondary**

```yaml
Default Configuration:
  - 90% customers: IP ACL only
  - 10% customers: SIP Registration (dynamic IPs)
  - Both options available simultaneously

Database Schema:
  auth_type: 'IP_ACL' | 'DIGEST' | 'BOTH' | 'NONE'
```

### IP ACL Configuration
- Multiple IPs per customer (main + backup)
- Subnet ranges supported (/24, /28, etc.)
- Friendly descriptions per IP
- Change management via portal

### Registration Configuration
- Username/password with realm
- 3600 second registration expiry
- NAT keep-alive via OPTIONS
- TLS required for credentials

## Termination vs Origination Architecture

### Termination (Customer → Ringer → PSTN)
```yaml
Complexity: HIGH
- LCR routing algorithm
- Real-time rating
- Zone classification (Interstate/Intrastate)
- Multiple vendor attempts
- Fraud detection critical

Database Load: HEAVY
- Rate table lookups (100k+ rows)
- Override checks
- Exclusion rules
- Balance validation
```

### Origination (PSTN → Ringer → Customer)
```yaml
Complexity: LOW
- Simple DID → Customer lookup
- Single destination (maybe failover)
- No complex routing needed
- Minimal fraud risk

Database Load: LIGHT
- DID ownership lookup
- Endpoint retrieval
- Basic forwarding rules
```

## Capacity Planning

### Kamailio Pods
```yaml
Per Pod Capacity:
  - CPU: 2-4 vCPU
  - Memory: 4-8 GB
  - Concurrent Calls: 5,000-10,000
  - CPS: 200

Scaling Formula:
  Pods Needed = Peak CPS / 200

Example (1000 CPS):
  - Minimum: 5 pods
  - Recommended: 7 pods (with headroom)
  - Serves: 500-1000 customers
```

### RTPEngine VMs
```yaml
Per VM Capacity:
  - CPU: 8-16 vCPU
  - Memory: 32-64 GB
  - Concurrent Streams: 2,000-5,000
  - Bandwidth: 1-10 Gbps

Scaling Formula:
  VMs Needed = Peak Concurrent Calls / 2000

Example (10,000 calls):
  - Minimum: 5 VMs
  - Recommended: 8 VMs (with redundancy)
```

## Load Balancing Strategy

### SIP Load Balancing
```yaml
Method: 5-tuple hash (consistent)
- Source IP + Port
- Destination IP + Port
- Protocol

Benefits:
  - Session affinity
  - Even distribution
  - Predictable routing
```

### RTP Load Balancing
```yaml
Method: Call-ID based selection
- RTPEngine selected per call
- Both legs use same RTPEngine
- Minimizes transcoding hops
```

## Network Security

### Ingress Protection
```yaml
Cloud Armor Rules:
  - Rate limiting: 100 CPS per source IP
  - Geographic filtering: Block high-risk countries
  - Protocol validation: SIP message sanity
  - DDoS mitigation: Automatic
```

### Egress Control
```yaml
Cloud NAT Configuration:
  - Static IP allocation
  - Port exhaustion monitoring
  - Connection tracking
  - Logging enabled
```

## Monitoring Requirements

### SIP Metrics
- Registrations per customer
- Active calls per trunk
- CPS per customer
- Failed authentications
- Geographic distribution

### Network Metrics
- IP utilization
- Port exhaustion warnings
- Packet loss per route
- Latency measurements
- Bandwidth per customer

## Admin UI Requirements

### Customer View
- Current origination IPs (for whitelist)
- Authentication configuration
- IP ACL management
- Registration status
- Active call count

### System View
- Pod utilization
- VM capacity
- IP pool health
- Port availability
- Geographic distribution

## Migration Path

### Phase 1: MVP
- 3 static IPs for origination
- IP ACL only
- Single region

### Phase 2: Production
- 5 IPs across 2 regions
- Registration support
- Geographic redundancy

### Phase 3: Enterprise
- Dedicated IP options
- Custom IP ranges
- White-label DNS

---

## Summary of Decisions

1. **Shared Infrastructure**: Multi-tenant Kamailio/RTPEngine
2. **Static IP Pool**: 3-5 IPs for origination via Cloud NAT
3. **Authentication**: IP ACL primary, registration available
4. **Separation**: Different architectures for termination vs origination
5. **Scaling**: Horizontal for Kamailio, vertical then horizontal for RTPEngine

These decisions provide cost-effective wholesale SIP trunking while maintaining flexibility for enterprise requirements.