# HTTPS Setup and Troubleshooting Guide

## Current Status

### ✅ Working Components
- NGINX Ingress Controller is properly configured and listening on ports 80 and 443
- LoadBalancer External IP: **34.72.20.183**
- Staging Let's Encrypt certificates are issued and working for:
  - grafana.ringer.tel
  - prometheus.ringer.tel
  - api.rns.ringer.tel
- HTTPS connections work when using the correct IP address

### ❌ Issues Found
- DNS records for grafana.ringer.tel and prometheus.ringer.tel point to wrong IPs
- HTTP to HTTPS redirects are not configured for prometheus and api-v2 ingresses

## DNS Configuration Required

Update the following A records to point to **34.72.20.183**:

| Domain | Current IP | Required IP |
|--------|-----------|-------------|
| grafana.ringer.tel | 35.224.100.108 | 34.72.20.183 |
| prometheus.ringer.tel | 35.224.246.74 | 34.72.20.183 |
| api.rns.ringer.tel | 34.72.20.183 ✓ | 34.72.20.183 |

## Switching to Production Certificates

Once DNS is updated, run:
```bash
./switch-to-production-certs.sh
```

This will update all ingresses to use the production Let's Encrypt issuer.

## Testing SSL/TLS

Use the test script to verify connectivity:
```bash
./test-ssl-connectivity.sh
```

Or test manually:
```bash
# Test with correct Host header (works now)
curl -k -I https://34.72.20.183 -H "Host: grafana.ringer.tel"

# Test actual domain (will work after DNS update)
curl -I https://grafana.ringer.tel
```

## Certificate Management

### View certificates:
```bash
kubectl get certificates -A
```

### Check certificate details:
```bash
kubectl describe certificate grafana-ringer-tel-tls -n monitoring
```

### Monitor certificate issuance:
```bash
kubectl get certificates -A -w
```

## HTTP to HTTPS Redirect

To enable automatic redirects, add this annotation to ingresses:
```yaml
nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
```

Update prometheus-ingress:
```bash
kubectl patch ingress prometheus-ingress -n monitoring --type='json' -p='[
  {"op": "add", "path": "/metadata/annotations/nginx.ingress.kubernetes.io~1force-ssl-redirect", "value": "true"}
]'
```

Update api-gateway-ingress:
```bash
kubectl patch ingress api-gateway-ingress -n default --type='json' -p='[
  {"op": "add", "path": "/metadata/annotations/nginx.ingress.kubernetes.io~1force-ssl-redirect", "value": "true"}
]'
```

## Troubleshooting

### Check NGINX Ingress logs:
```bash
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller
```

### Check cert-manager logs:
```bash
kubectl logs -n cert-manager deployment/cert-manager
```

### Verify HTTP-01 challenge:
```bash
# During certificate issuance, check if challenge is accessible
curl http://<domain>/.well-known/acme-challenge/<token>
```

### Common Issues:
1. **Connection refused**: Usually DNS pointing to wrong IP
2. **Certificate not issued**: Check cert-manager logs, ensure DNS is correct
3. **HTTP-01 challenge fails**: Ensure ingress allows /.well-known/acme-challenge path
4. **Rate limits**: Let's Encrypt has rate limits, use staging for testing