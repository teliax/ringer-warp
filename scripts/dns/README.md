# DNS Management Scripts

This directory contains scripts for managing DNS records for the Ringer platform using the Gandi API.

## Prerequisites

1. **Gandi API Key**: You need a Gandi API key with DNS management permissions
2. **Google Cloud SDK**: For storing API key in Secret Manager
3. **kubectl**: For Kubernetes integration (optional)
4. **Tools**: `dig`, `curl`, `jq`, `nc` (netcat)

## Scripts Overview

### 1. `setup-gandi-secret.sh`
Sets up the Gandi API key in Google Secret Manager.

```bash
./setup-gandi-secret.sh <your-gandi-api-key>
```

### 2. `create-dns-records.sh`
Creates all DNS records for services including A records and SRV records.

```bash
# For production (ringer.tel)
./create-dns-records.sh production

# For staging (ringer.net) - if available
./create-dns-records.sh staging
```

### 3. `test-dns-records.sh`
Tests DNS resolution and service connectivity.

```bash
# Test production domain
./test-dns-records.sh ringer.tel

# Test staging domain
./test-dns-records.sh ringer.net
```

### 4. `update-dns-loadbalancers.sh`
Discovers LoadBalancer IPs from Kubernetes and updates DNS records.

```bash
./update-dns-loadbalancers.sh
```

### 5. `rollback-dns-records.sh`
Removes managed DNS records or restores from backup.

```bash
# Remove all managed records
./rollback-dns-records.sh

# Restore from specific backup
./rollback-dns-records.sh ringer.tel backups/dns_backup_ringer.tel_20240115_120000.json
```

### 6. `setup-external-dns.sh`
Sets up External DNS in Kubernetes for automatic DNS management.

```bash
./setup-external-dns.sh
```

## Configuration Files

### `dns-config.sh`
Central configuration file containing:
- Service IPs
- Domain names
- TTL values
- Subdomain mappings

### `gandi-dns-lib.sh`
Library of reusable functions for Gandi API operations.

## DNS Record Structure

### A Records Created:
- `api-v2.ringer.tel` → API Gateway (34.41.135.92)
- `sip.ringer.tel` → Kamailio SIP (35.188.144.139)
- `prometheus.ringer.tel` → Prometheus (35.224.246.74)
- `grafana.ringer.tel` → Grafana (35.224.100.108)
- `homer.ringer.tel` → HOMER (35.223.187.94)

### SRV Records Created:
- `_sip._udp.ringer.tel` → sip.ringer.tel:5060
- `_sip._tcp.ringer.tel` → sip.ringer.tel:5060
- `_sip._tls.ringer.tel` → sip.ringer.tel:5061

## Quick Start

1. **Store API Key**:
   ```bash
   ./setup-gandi-secret.sh your-gandi-api-key-here
   ```

2. **Create DNS Records**:
   ```bash
   ./create-dns-records.sh
   ```

3. **Test Records**:
   ```bash
   ./test-dns-records.sh
   ```

## Kubernetes Integration

### Option 1: External DNS (Recommended)
Deploy External DNS to automatically manage DNS records:
```bash
./setup-external-dns.sh
```

Then annotate your services:
```yaml
metadata:
  annotations:
    external-dns.alpha.kubernetes.io/hostname: api-v2.ringer.tel
    external-dns.alpha.kubernetes.io/ttl: "300"
```

### Option 2: Manual Updates
Use the update script to sync LoadBalancer IPs:
```bash
./update-dns-loadbalancers.sh
```

## Environment Variables

- `ENVIRONMENT`: Set to "staging" to use staging domain
- `CREATE_WILDCARD`: Set to "true" to create wildcard records
- `TEST_PROPAGATION`: Set to "false" to skip propagation test
- `DELETE_WILDCARD`: Set to "true" to delete wildcard on rollback

## Troubleshooting

### DNS Not Resolving
1. Wait for TTL to expire (5-60 minutes)
2. Clear local DNS cache
3. Test with different DNS servers
4. Check Gandi DNS panel

### API Authentication Failed
1. Verify API key in Secret Manager:
   ```bash
   gcloud secrets versions access latest --secret=gandi-api-key
   ```
2. Check API key permissions in Gandi

### Service Not Accessible
1. Verify LoadBalancer IP is correct
2. Check firewall rules
3. Test direct IP connectivity
4. Verify service is running

## Security Notes

- API keys are stored in Google Secret Manager
- Never commit API keys to git
- Use service account permissions for production
- Rotate API keys regularly

## Support

For issues:
1. Check script logs
2. Verify DNS propagation
3. Test with dig/nslookup
4. Check Gandi API status