# DNS and SSL Deployment Guide for Ringer Platform

## Current Status

### ✅ What's Working:
- Kubernetes cluster is running with 6 nodes
- 4 Kamailio LoadBalancer services are active:
  - `ringer-warp-v01/kamailio-sip-tcp`: 34.72.244.248
  - `ringer-warp-v01/kamailio-sip-udp`: 35.188.57.164
  - `warp-core/kamailio-sip-tcp`: 34.41.176.225
  - `warp-core/kamailio-sip-udp`: 34.61.253.247
- Monitoring services (Prometheus, Grafana) are running as ClusterIP
- API services are running as ClusterIP

### ❌ What's Missing:
- **Gandi API Key** not in Google Secret Manager
- **cert-manager** not installed
- **NGINX Ingress Controller** not installed
- **DNS records** not configured

## Deployment Steps

### Step 1: Create Gandi API Key Secret (REQUIRED FIRST!)

1. Get your Gandi API key from: https://account.gandi.net/
2. Run the setup script:
```bash
cd /home/daldworth/repos/ringer-warp/scripts/dns/
./setup-gandi-secret.sh YOUR_ACTUAL_GANDI_API_KEY
```

### Step 2: Run the Comprehensive Deployment Script

```bash
cd /home/daldworth/repos/ringer-warp/scripts/
./deploy-dns-ssl.sh
```

This script will:
1. Check all prerequisites
2. Deploy DNS records for SIP services
3. Install cert-manager
4. Install NGINX Ingress Controller
5. Install Gandi webhook for DNS-01 challenges
6. Verify all deployments

### Step 3: Update DNS for Web Services

After the NGINX Ingress Controller is deployed, you'll get an external IP. You need to manually update DNS records for:
- `api.rns.ringer.tel` → Ingress IP
- `grafana.ringer.tel` → Ingress IP
- `prometheus.ringer.tel` → Ingress IP
- `homer.ringer.tel` → Ingress IP (if Homer is deployed)

### Step 4: Deploy SSL Certificates

```bash
cd /home/daldworth/repos/ringer-warp/kubernetes/ssl/

# Apply certificate issuers (start with staging)
kubectl apply -f issuers/02-letsencrypt-staging-issuer.yaml

# Apply certificate requests
kubectl apply -f certificates/

# Apply ingress configurations
kubectl apply -f ingress/
```

### Step 5: Monitor Certificate Issuance

```bash
# Watch certificate status
kubectl get certificate --all-namespaces -w

# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager -f

# Check challenge status
kubectl get challenge --all-namespaces
```

### Step 6: Switch to Production (After Testing)

Once staging certificates work:
1. Update all YAML files: replace `letsencrypt-staging` with `letsencrypt-production`
2. Apply production issuer:
   ```bash
   kubectl apply -f issuers/03-letsencrypt-production-issuer.yaml
   ```
3. Delete existing certificates to force renewal:
   ```bash
   kubectl delete certificate --all --all-namespaces
   ```
4. Reapply certificate configurations

## DNS Configuration Summary

### A Records (will be created automatically):
- `sip.ringer.tel` → 34.41.176.225 (warp-core TCP LoadBalancer)
- `sip-v01.ringer.tel` → 34.72.244.248 (ringer-warp-v01 TCP LoadBalancer)

### SRV Records (will be created automatically):
- `_sip._udp.ringer.tel` → `sip.ringer.tel:5060`
- `_sip._tcp.ringer.tel` → `sip.ringer.tel:5060`
- `_sip._tls.ringer.tel` → `sip.ringer.tel:5061`

### Manual Updates Required (after Ingress deployment):
- `api.rns.ringer.tel` → [NGINX Ingress IP]
- `grafana.ringer.tel` → [NGINX Ingress IP]
- `prometheus.ringer.tel` → [NGINX Ingress IP]
- `homer.ringer.tel` → [NGINX Ingress IP]

## Troubleshooting

### DNS Issues:
```bash
# Test DNS resolution
host sip.ringer.tel
dig +short sip.ringer.tel

# Check Gandi DNS records
cd /home/daldworth/repos/ringer-warp/scripts/dns/
./test-dns-records.sh
```

### SSL Certificate Issues:
```bash
# Check cert-manager pods
kubectl get pods -n cert-manager

# Check certificate status
kubectl describe certificate -n [namespace] [certificate-name]

# Check challenges
kubectl describe challenge -n [namespace] [challenge-name]

# Check Gandi webhook
kubectl logs -n cert-manager deployment/cert-manager-webhook-gandi
```

### NGINX Ingress Issues:
```bash
# Check ingress controller
kubectl get pods -n ingress-nginx
kubectl logs -n ingress-nginx deployment/nginx-ingress-ingress-nginx-controller

# Check ingress resources
kubectl get ingress --all-namespaces
kubectl describe ingress -n [namespace] [ingress-name]
```

## Important Notes

1. **Gandi API Key**: This is absolutely required before anything else can work
2. **DNS Propagation**: DNS changes can take 5-30 minutes to propagate
3. **Let's Encrypt Rate Limits**: Use staging first to avoid hitting production rate limits
4. **LoadBalancer IPs**: These are already assigned and working for SIP services
5. **Ingress IP**: Will be assigned when NGINX Ingress Controller is deployed

## Next Steps After Deployment

1. Configure monitoring dashboards in Grafana
2. Set up alerts in Prometheus
3. Configure Homer for SIP traffic analysis
4. Test SIP connectivity through the new DNS records
5. Implement backup and disaster recovery for certificates