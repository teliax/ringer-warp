# DNS Management via Gandi LiveDNS API

## Decision: Use Gandi API for ringer.tel Staging Subdomains

Since staging subdomains don't overlap with production, we'll use the Gandi LiveDNS API to manage all DNS records under ringer.tel, keeping everything in one place.

## Gandi API Implementation

### Authentication
```bash
# API Key from Gandi account
export GANDI_API_KEY="your-api-key"

# All requests require header
Authorization: Apikey ${GANDI_API_KEY}
```

### Base Configuration
```yaml
API Endpoint: https://api.gandi.net/v5/livedns
Domain: ringer.tel
Rate Limits:
  - 300 requests per minute
  - DNS propagation: ~5 minutes globally
```

## DNS Record Management Service

### TypeScript Implementation
```typescript
// services/dns-manager/src/gandi-dns.ts
import axios from 'axios';

interface DnsRecord {
  rrset_name: string;
  rrset_type: string;
  rrset_ttl: number;
  rrset_values: string[];
}

class GandiDnsManager {
  private baseUrl = 'https://api.gandi.net/v5/livedns';
  private domain = 'ringer.tel';
  private headers: any;

  constructor(apiKey: string) {
    this.headers = {
      'Authorization': `Apikey ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  // Create or update A record
  async createARecord(subdomain: string, ip: string, ttl: number = 300) {
    const endpoint = `${this.baseUrl}/domains/${this.domain}/records/${subdomain}/A`;

    const data = {
      rrset_ttl: ttl,
      rrset_values: [ip]
    };

    try {
      const response = await axios.put(endpoint, data, { headers: this.headers });
      console.log(`Created A record: ${subdomain}.${this.domain} -> ${ip}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to create A record: ${error}`);
      throw error;
    }
  }

  // Create SRV record for SIP
  async createSrvRecord(service: string, target: string, port: number = 5060) {
    const endpoint = `${this.baseUrl}/domains/${this.domain}/records/${service}/SRV`;

    const data = {
      rrset_ttl: 300,
      rrset_values: [`10 10 ${port} ${target}.`]
    };

    try {
      const response = await axios.put(endpoint, data, { headers: this.headers });
      console.log(`Created SRV record: ${service}.${this.domain}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to create SRV record: ${error}`);
      throw error;
    }
  }

  // Create CNAME record (for Vercel frontends)
  async createCnameRecord(subdomain: string, target: string, ttl: number = 300) {
    const endpoint = `${this.baseUrl}/domains/${this.domain}/records/${subdomain}/CNAME`;

    const data = {
      rrset_ttl: ttl,
      rrset_values: [`${target}.`]
    };

    try {
      const response = await axios.put(endpoint, data, { headers: this.headers });
      console.log(`Created CNAME record: ${subdomain}.${this.domain} -> ${target}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to create CNAME record: ${error}`);
      throw error;
    }
  }

  // Bulk update for staging environment setup
  async setupStagingEnvironment(loadBalancerIp: string) {
    const records = [
      // API Gateway
      { type: 'A', name: 'api-staging', value: loadBalancerIp },

      // Vercel frontends (CNAMEs)
      { type: 'CNAME', name: 'console-staging', value: 'cname.vercel-dns.com' },
      { type: 'CNAME', name: 'admin-staging', value: 'cname.vercel-dns.com' },

      // SIP services
      { type: 'A', name: 'sip-staging', value: loadBalancerIp },
      { type: 'SRV', name: '_sip._udp.sip-staging', value: 'sip-staging.ringer.tel' },
      { type: 'SRV', name: '_sip._tcp.sip-staging', value: 'sip-staging.ringer.tel' },

      // Monitoring tools
      { type: 'A', name: 'grafana-staging', value: loadBalancerIp },
      { type: 'A', name: 'homer-staging', value: loadBalancerIp },
      { type: 'A', name: 'prometheus-staging', value: loadBalancerIp }
    ];

    for (const record of records) {
      switch (record.type) {
        case 'A':
          await this.createARecord(record.name, record.value);
          break;
        case 'CNAME':
          await this.createCnameRecord(record.name, record.value);
          break;
        case 'SRV':
          await this.createSrvRecord(record.name, record.value);
          break;
      }
      // Respect rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Create customer trunk subdomain
  async createCustomerTrunk(customerId: string, customerIp: string) {
    // Customer-specific subdomain
    const subdomain = `${customerId}-staging`;

    // Create A record
    await this.createARecord(subdomain, customerIp);

    // Create SRV records for SIP
    await this.createSrvRecord(`_sip._udp.${subdomain}`, `${subdomain}.ringer.tel`);
    await this.createSrvRecord(`_sip._tcp.${subdomain}`, `${subdomain}.ringer.tel`);

    return `${subdomain}.ringer.tel`;
  }

  // Delete record
  async deleteRecord(subdomain: string, type: string) {
    const endpoint = `${this.baseUrl}/domains/${this.domain}/records/${subdomain}/${type}`;

    try {
      await axios.delete(endpoint, { headers: this.headers });
      console.log(`Deleted ${type} record: ${subdomain}.${this.domain}`);
    } catch (error) {
      console.error(`Failed to delete record: ${error}`);
      throw error;
    }
  }

  // List all records
  async listRecords() {
    const endpoint = `${this.baseUrl}/domains/${this.domain}/records`;

    try {
      const response = await axios.get(endpoint, { headers: this.headers });
      return response.data;
    } catch (error) {
      console.error(`Failed to list records: ${error}`);
      throw error;
    }
  }
}

export default GandiDnsManager;
```

## Terraform Integration (Using External Data Source)

```hcl
# terraform/dns-gandi.tf
# Since Gandi doesn't have official Terraform provider for LiveDNS,
# use local-exec provisioner or external data source

resource "null_resource" "staging_dns" {
  provisioner "local-exec" {
    command = <<EOF
      curl -X PUT https://api.gandi.net/v5/livedns/domains/ringer.tel/records/api-staging/A \
        -H "Authorization: Apikey ${var.gandi_api_key}" \
        -H "Content-Type: application/json" \
        -d '{"rrset_ttl": 300, "rrset_values": ["${google_compute_global_address.api_lb.address}"]}'
    EOF
  }

  triggers = {
    lb_ip = google_compute_global_address.api_lb.address
  }
}

# Alternative: Use external data source
data "external" "create_dns_record" {
  program = ["bash", "${path.module}/scripts/gandi-dns.sh"]

  query = {
    subdomain = "api-staging"
    type      = "A"
    value     = google_compute_global_address.api_lb.address
    ttl       = "300"
  }
}
```

## Bash Script for CI/CD

```bash
#!/bin/bash
# scripts/gandi-dns.sh

GANDI_API_KEY="${GANDI_API_KEY}"
DOMAIN="ringer.tel"
BASE_URL="https://api.gandi.net/v5/livedns"

create_a_record() {
  local subdomain=$1
  local ip=$2
  local ttl=${3:-300}

  curl -X PUT "${BASE_URL}/domains/${DOMAIN}/records/${subdomain}/A" \
    -H "Authorization: Apikey ${GANDI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"rrset_ttl\": ${ttl}, \"rrset_values\": [\"${ip}\"]}"
}

create_cname_record() {
  local subdomain=$1
  local target=$2
  local ttl=${3:-300}

  curl -X PUT "${BASE_URL}/domains/${DOMAIN}/records/${subdomain}/CNAME" \
    -H "Authorization: Apikey ${GANDI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"rrset_ttl\": ${ttl}, \"rrset_values\": [\"${target}.\"]}"
}

create_srv_record() {
  local service=$1
  local target=$2
  local port=${3:-5060}
  local ttl=${4:-300}

  curl -X PUT "${BASE_URL}/domains/${DOMAIN}/records/${service}/SRV" \
    -H "Authorization: Apikey ${GANDI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"rrset_ttl\": ${ttl}, \"rrset_values\": [\"10 10 ${port} ${target}.\"]}"
}

# Setup all staging DNS records
setup_staging() {
  local lb_ip=$1

  echo "Setting up staging DNS records..."

  # API Gateway
  create_a_record "api-staging" "${lb_ip}"

  # Vercel frontends
  create_cname_record "console-staging" "cname.vercel-dns.com"
  create_cname_record "admin-staging" "cname.vercel-dns.com"

  # SIP services
  create_a_record "sip-staging" "${lb_ip}"
  create_srv_record "_sip._udp.sip-staging" "sip-staging.ringer.tel" 5060
  create_srv_record "_sip._tcp.sip-staging" "sip-staging.ringer.tel" 5060

  # Monitoring
  create_a_record "grafana-staging" "${lb_ip}"
  create_a_record "homer-staging" "${lb_ip}"
  create_a_record "prometheus-staging" "${lb_ip}"

  echo "Staging DNS setup complete!"
}

# Main execution
case "$1" in
  setup)
    setup_staging "$2"
    ;;
  create-a)
    create_a_record "$2" "$3" "$4"
    ;;
  create-cname)
    create_cname_record "$2" "$3" "$4"
    ;;
  create-srv)
    create_srv_record "$2" "$3" "$4" "$5"
    ;;
  *)
    echo "Usage: $0 {setup|create-a|create-cname|create-srv} [args...]"
    exit 1
    ;;
esac
```

## GitHub Actions Integration

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging

on:
  push:
    branches: [staging]

jobs:
  update-dns:
    runs-on: ubuntu-latest
    needs: deploy-infrastructure

    steps:
      - uses: actions/checkout@v2

      - name: Get Load Balancer IP
        id: get-lb-ip
        run: |
          LB_IP=$(gcloud compute addresses describe api-lb-staging --region=us-central1 --format='value(address)')
          echo "::set-output name=ip::$LB_IP"

      - name: Update DNS Records
        env:
          GANDI_API_KEY: ${{ secrets.GANDI_API_KEY }}
        run: |
          ./scripts/gandi-dns.sh setup ${{ steps.get-lb-ip.outputs.ip }}
```

## DNS Records Required for Staging

| Subdomain | Type | Value | Purpose |
|-----------|------|-------|---------|
| api-staging | A | Load Balancer IP | API Gateway |
| console-staging | CNAME | cname.vercel-dns.com | Customer Portal |
| admin-staging | CNAME | cname.vercel-dns.com | Admin Portal |
| sip-staging | A | Load Balancer IP | SIP signaling |
| _sip._udp.sip-staging | SRV | 10 10 5060 sip-staging.ringer.tel | SIP UDP |
| _sip._tcp.sip-staging | SRV | 10 10 5060 sip-staging.ringer.tel | SIP TCP |
| grafana-staging | A | Load Balancer IP | Monitoring |
| homer-staging | A | Load Balancer IP | SIP capture |
| prometheus-staging | A | Load Balancer IP | Metrics |
| *-staging | A | Dynamic | Customer trunks |

## Customer Trunk DNS Pattern

For each customer, create:
- `{customer-id}-staging.ringer.tel` → Customer's IP
- SRV records for SIP service discovery

Example:
```
acme-corp-staging.ringer.tel    A     52.14.88.102
_sip._udp.acme-corp-staging     SRV   10 10 5060 acme-corp-staging.ringer.tel
```

## Rate Limiting & Best Practices

### Gandi API Limits
- 300 requests per minute
- Batch operations when possible
- Cache DNS responses locally
- Use appropriate TTLs (300s for staging, longer for stable records)

### Error Handling
```typescript
class GandiApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

// Retry logic for rate limiting
async function retryWithBackoff(fn: Function, maxRetries: number = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.response?.status === 429) {
        // Rate limited - wait and retry
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

## Migration Strategy

### Phase 1: Staging Setup (Immediate)
1. Create all staging subdomains via Gandi API
2. Test API integration thoroughly
3. Monitor rate limits and adjust

### Phase 2: Automation (Week 1)
1. Integrate DNS updates into CI/CD
2. Create customer provisioning workflow
3. Add monitoring for DNS health

### Phase 3: Production Planning (Future)
1. If Gandi API proves reliable, continue using it
2. If bottlenecks occur, consider:
   - Cloud DNS for customer subdomains only
   - Gandi's higher-tier API limits
   - Hybrid approach with subdomain delegation

## Security Considerations

### API Key Management
```yaml
# Store in GitHub Secrets / Google Secret Manager
GANDI_API_KEY: "encrypted-key"

# Never commit to code
# Use environment variables only
```

### DNS Security
- Enable DNSSEC through Gandi dashboard
- Monitor for DNS hijacking attempts
- Log all DNS changes for audit trail
- Use CAA records to restrict certificate issuance

## Cost Analysis

### Gandi LiveDNS
- Included with domain registration
- No per-query charges
- No additional cost for API usage

### Comparison with Cloud DNS
| Service | Monthly Cost | Queries | API Limits |
|---------|-------------|---------|------------|
| Gandi | $0 (included) | Unlimited | 300/min |
| Cloud DNS | ~$5-10 | $0.40/million | Unlimited |

## Implementation Checklist

- [ ] Obtain Gandi API key from account
- [ ] Store API key in Google Secret Manager
- [ ] Create DNS management service
- [ ] Test with staging subdomains
- [ ] Integrate with CI/CD pipeline
- [ ] Document DNS update procedures
- [ ] Set up monitoring for DNS resolution
- [ ] Create customer provisioning workflow
- [ ] Test SIP SRV record resolution
- [ ] Enable DNSSEC for ringer.tel

## Advantages of Gandi API Approach

✅ **Single domain management** - Everything under ringer.tel
✅ **No additional cost** - API included with domain
✅ **Immediate propagation** - ~5 minutes globally
✅ **Simple integration** - REST API with good documentation
✅ **No overlap risk** - Staging subdomains clearly separated

## Potential Bottlenecks & Solutions

1. **Rate Limiting (300/min)**
   - Solution: Batch operations, implement queuing

2. **API Reliability**
   - Solution: Retry logic, fallback to manual updates

3. **No Terraform Provider**
   - Solution: Use external data sources or local-exec

4. **Dynamic Customer Provisioning**
   - Solution: Queue DNS updates, process in batches

---
*Decision: Use Gandi LiveDNS API for all staging subdomains under ringer.tel*