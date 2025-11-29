# DNS Management Strategy

## Decision: Dual-Domain Approach

### Production Domain: ringer.tel (Gandi)
- Remains in Gandi for stability
- Manual changes only for production
- Protects against automation errors

### Staging/Dev Domain: ringer.net (Cloud DNS)
- Fully automated via Terraform/gcloud
- Rapid iteration and testing
- Complete IaC integration

## DNS Architecture

### 1. Staging Environment (ringer.net)
```yaml
Cloud DNS Managed Zone: ringer-net
Domain: ringer.net
Management: Terraform + gcloud

Records:
  # API Services
  api.ringer.net          → Cloud Load Balancer IP
  api-staging.ringer.net  → Cloud Load Balancer IP

  # Frontend (Vercel CNAME)
  console.ringer.net       → cname.vercel-dns.com
  admin.ringer.net         → cname.vercel-dns.com

  # SIP Services
  sip.ringer.net          → A record: LB IP
  _sip._udp.ringer.net    → SRV: 10 10 5060 sip.ringer.net
  _sip._tcp.ringer.net    → SRV: 10 10 5060 sip.ringer.net

  # Monitoring
  grafana.ringer.net      → Internal LB IP
  homer.ringer.net        → Internal LB IP
  prometheus.ringer.net   → Internal LB IP

  # Customer Trunks (Dynamic)
  *.trunk.ringer.net      → Wildcard to trunk handler
  customer1.ringer.net    → Customer-specific IP
```

### 2. Production Domain (ringer.tel)
```yaml
DNS Provider: Gandi
Domain: ringer.tel
Management: Manual via Gandi UI (for now)

Records:
  # Production Services
  api.ringer.tel          → Production LB IP
  console.ringer.tel      → Production Vercel
  admin.ringer.tel        → Production Vercel
  sip.ringer.tel          → Production SIP

  # Staging Subdomain (Optional)
  *.staging.ringer.tel    → CNAME to ringer.net equivalents
```

## Implementation Plan

### Phase 1: Set Up Cloud DNS (Immediate)
```bash
# Create Cloud DNS zone
gcloud dns managed-zones create ringer-net \
  --dns-name="ringer.net." \
  --description="WARP Platform Staging Domain"

# Get name servers
gcloud dns managed-zones describe ringer-net

# Update ringer.net nameservers at registrar to point to Cloud DNS
# ns-cloud-a1.googledomains.com
# ns-cloud-a2.googledomains.com
# ns-cloud-a3.googledomains.com
# ns-cloud-a4.googledomains.com
```

### Phase 2: Terraform Configuration
```hcl
# terraform/dns.tf
resource "google_dns_managed_zone" "staging" {
  name        = "ringer-net"
  dns_name    = "ringer.net."
  description = "WARP Platform Staging DNS"

  dnssec_config {
    state = "on"
  }
}

resource "google_dns_record_set" "api" {
  name = "api.${google_dns_managed_zone.staging.dns_name}"
  type = "A"
  ttl  = 300

  managed_zone = google_dns_managed_zone.staging.name
  rrdatas      = [google_compute_global_address.api_lb.address]
}

resource "google_dns_record_set" "sip_srv_udp" {
  name = "_sip._udp.${google_dns_managed_zone.staging.dns_name}"
  type = "SRV"
  ttl  = 300

  managed_zone = google_dns_managed_zone.staging.name
  rrdatas      = ["10 10 5060 sip.ringer.net."]
}

# Dynamic customer trunk subdomains
resource "google_dns_record_set" "trunk_wildcard" {
  name = "*.trunk.${google_dns_managed_zone.staging.dns_name}"
  type = "A"
  ttl  = 60  # Short TTL for dynamic updates

  managed_zone = google_dns_managed_zone.staging.name
  rrdatas      = [google_compute_global_address.trunk_handler.address]
}
```

### Phase 3: API-Driven DNS Management
```typescript
// services/dns-manager/src/index.ts
import { DNS } from '@google-cloud/dns';

class DnsManager {
  private dns = new DNS();
  private zone = this.dns.zone('ringer-net');

  async createCustomerTrunk(customerId: string, ip: string) {
    const record = this.zone.record('a', {
      name: `${customerId}.trunk.ringer.net.`,
      ttl: 300,
      data: ip
    });

    await this.zone.addRecords(record);

    // Also create SRV records for SIP
    const srvRecord = this.zone.record('srv', {
      name: `_sip._udp.${customerId}.trunk.ringer.net.`,
      ttl: 300,
      data: {
        priority: 10,
        weight: 10,
        port: 5060,
        target: `${customerId}.trunk.ringer.net.`
      }
    });

    await this.zone.addRecords(srvRecord);
  }

  async updateCustomerIP(customerId: string, oldIp: string, newIp: string) {
    const oldRecord = this.zone.record('a', {
      name: `${customerId}.trunk.ringer.net.`,
      data: oldIp
    });

    const newRecord = this.zone.record('a', {
      name: `${customerId}.trunk.ringer.net.`,
      data: newIp
    });

    await this.zone.replaceRecords(oldRecord, newRecord);
  }
}
```

## DNS Requirements by Service

### SIP Trunking Requirements
```yaml
Customer Termination:
  - A record: customer1.trunk.ringer.net → Customer IP
  - SRV records: _sip._udp, _sip._tcp
  - PTR record: For IP reputation

Carrier Interconnection:
  - A records for each carrier endpoint
  - Geographic DNS for closest PoP
  - Failover records with health checks
```

### API Services
```yaml
Public API:
  - A record: api.ringer.net
  - AAAA record: IPv6 support
  - CAA record: Certificate authority authorization

Webhooks:
  - Consistent domain for all callbacks
  - No IP-based URLs (use DNS)
```

### Certificate Management
```yaml
Wildcard Certificates:
  - *.ringer.net (covers all subdomains)
  - Managed by Google Certificate Manager
  - Auto-renewal via DNS validation

Per-Service Certificates:
  - api.ringer.net
  - sip.ringer.net (for TLS/SRTP)
```

## Migration Path

### Option 1: Full ringer.net for Staging (Recommended)
```
Pros:
- Complete isolation from production
- Full automation capability
- No risk to production DNS
- Clean separation of concerns

Cons:
- Different domain from production
- Need to maintain two domains
```

### Option 2: Subdomain Delegation (staging.ringer.tel)
```
Pros:
- Single domain to manage
- Consistent branding

Cons:
- Risk of affecting production
- Gandi API limitations
- More complex setup
```

### Option 3: Gandi API Integration
```
Pros:
- Single source of truth
- Direct control

Cons:
- Gandi API rate limits
- Less reliable than Cloud DNS
- No Terraform provider
- Risk to production records
```

## DNS Record Types Needed

### Essential Records
| Type | Purpose | Example |
|------|---------|---------|
| A | IPv4 address | api.ringer.net → 34.102.136.180 |
| AAAA | IPv6 address | api.ringer.net → 2001:db8::1 |
| CNAME | Aliases | www.ringer.net → ringer.net |
| SRV | SIP service discovery | _sip._udp → 10 10 5060 sip.ringer.net |
| TXT | SPF, DKIM, verification | "v=spf1 include:_spf.google.com ~all" |
| MX | Email routing | 10 mx.google.com |
| CAA | Certificate authority | 0 issue "letsencrypt.org" |
| NS | Nameserver delegation | customer1.ringer.net NS ns1.customer.com |

### SIP-Specific Records
```yaml
# Standard SIP SRV records
_sip._udp.ringer.net.   300 IN SRV 10 10 5060 sip.ringer.net.
_sip._tcp.ringer.net.   300 IN SRV 10 10 5060 sip.ringer.net.
_sip._tls.ringer.net.   300 IN SRV 10 10 5061 sip.ringer.net.

# NAPTR for ENUM lookups (future)
*.e164.ringer.net. 300 IN NAPTR 10 10 "u" "E2U+sip" "!^.*$!sip:info@ringer.net!" .

# WebRTC STUN/TURN
_stun._udp.ringer.net.  300 IN SRV 10 10 3478 stun.ringer.net.
_turn._udp.ringer.net.  300 IN SRV 10 10 3478 turn.ringer.net.
```

## Automation Scripts

### Create Customer Subdomain
```bash
#!/bin/bash
# create-customer-dns.sh
CUSTOMER_ID=$1
CUSTOMER_IP=$2
ZONE="ringer-net"

# Create A record
gcloud dns record-sets create ${CUSTOMER_ID}.trunk.ringer.net. \
  --zone=${ZONE} \
  --type=A \
  --ttl=300 \
  --rrdatas=${CUSTOMER_IP}

# Create SRV records
gcloud dns record-sets create _sip._udp.${CUSTOMER_ID}.trunk.ringer.net. \
  --zone=${ZONE} \
  --type=SRV \
  --ttl=300 \
  --rrdatas="10 10 5060 ${CUSTOMER_ID}.trunk.ringer.net."

echo "DNS records created for ${CUSTOMER_ID}"
```

### Health Check & Failover
```yaml
# Cloud DNS with health checks
resource "google_dns_record_set" "api_failover" {
  name = "api.ringer.net."
  type = "A"
  ttl  = 30  # Short TTL for quick failover

  routing_policy {
    wrr {
      weight = 100
      rrdatas = [google_compute_global_address.primary.address]
    }
    wrr {
      weight = 0  # Standby
      rrdatas = [google_compute_global_address.secondary.address]
    }
  }
}
```

## Cost Analysis

### Cloud DNS Costs
- Managed zone: $0.20/month
- Queries: $0.40 per million
- Estimated monthly: ~$5-10

### Gandi API Costs
- API calls: Free but rate-limited
- LiveDNS: Included with domain
- Risk cost: Potential production impact

## Security Considerations

### DNSSEC
- Enable on Cloud DNS zones
- Automatic key rotation
- Protection against DNS hijacking

### Access Control
- Service account for DNS updates
- IAM roles for DNS administration
- Audit logging for all changes

### Rate Limiting
- Cloud DNS: 100 QPS per zone
- Implement caching at application layer
- Use appropriate TTL values

## Recommendation

**Use ringer.net with Cloud DNS for all staging/development**:
1. Complete automation capability
2. No risk to production
3. Full Terraform/IaC integration
4. Cost-effective (~$10/month)
5. SIP-friendly domain

**Keep ringer.tel in Gandi for production** until platform is stable, then consider migration.

## Implementation Checklist

- [ ] Transfer ringer.net to Google Domains (optional, for convenience)
- [ ] Create Cloud DNS zone for ringer.net
- [ ] Update nameservers at registrar
- [ ] Create Terraform configs for all records
- [ ] Set up DNS update API for dynamic records
- [ ] Configure health checks and failover
- [ ] Enable DNSSEC
- [ ] Document DNS update procedures
- [ ] Create monitoring for DNS resolution
- [ ] Test SIP SRV record resolution

---
*Decision: Use ringer.net with Cloud DNS for complete staging automation*