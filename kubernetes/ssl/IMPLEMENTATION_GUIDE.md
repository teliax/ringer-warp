# Let's Encrypt SSL/TLS Implementation Guide for Ringer WARP

## Overview
This guide implements automatic SSL/TLS certificate management using Let's Encrypt and cert-manager for all Ringer WARP services.

## Current Services and IPs
- **Kamailio SIP (warp-core)**:
  - TCP: 34.41.176.225
  - UDP: 34.61.253.247
- **Kamailio SIP (ringer-warp-v01)**:
  - TCP: 34.72.244.248
  - UDP: 35.188.57.164
- **API Gateway**: Currently using ClusterIP (needs Ingress)
- **Prometheus**: Currently using ClusterIP (needs Ingress)
- **Grafana**: Currently using ClusterIP (needs Ingress)
- **HOMER**: Not yet deployed

## Architecture Decisions

### 1. Certificate Management: cert-manager
- Automatic certificate provisioning and renewal
- Support for both HTTP-01 and DNS-01 challenges
- Integration with Let's Encrypt ACME protocol
- Kubernetes-native approach

### 2. Challenge Types
- **HTTP-01**: For specific domain certificates (api-v2.ringer.tel, grafana.ringer.tel)
- **DNS-01**: For wildcard certificates (*.ringer.tel, *.sip.ringer.tel)
- DNS-01 requires Gandi webhook for DNS provider integration

### 3. Ingress Controller: NGINX
- Industry standard for Kubernetes
- Supports TCP/UDP load balancing for SIP
- Built-in TLS termination
- WebSocket support for SIP over WSS

### 4. Certificate Strategy
- Start with Let's Encrypt staging environment
- Use wildcard certificates where applicable
- Separate certificates for different security domains
- SIP services use TLS directly (not through Ingress)

## Implementation Steps

### Phase 1: Infrastructure Setup

1. **Install cert-manager**:
```bash
# Install cert-manager v1.16.2
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.2/cert-manager.yaml

# Verify installation
kubectl get pods --namespace cert-manager
kubectl get crd | grep cert-manager
```

2. **Install NGINX Ingress Controller**:
```bash
# Add Helm repo
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install with custom values for GKE
helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.service.annotations."cloud\.google\.com/load-balancer-type"="External" \
  --set controller.metrics.enabled=true \
  --set controller.config.use-forwarded-headers="true" \
  --set tcp.5061="warp-core/kamailio-sip-tcp:5061" \
  --set udp.5060="warp-core/kamailio-sip-udp:5060"

# Get the external IP
kubectl get svc -n ingress-nginx
```

3. **Install Gandi Webhook** (for DNS-01 challenges):
```bash
# Add Helm repo
helm repo add bwolf https://bwolf.github.io/cert-manager-webhook-gandi
helm repo update

# Install webhook
helm install cert-manager-webhook-gandi \
  --namespace cert-manager \
  --set features.apiPriorityAndFairness=true \
  --set logLevel=2 \
  bwolf/cert-manager-webhook-gandi
```

### Phase 2: Secrets Setup

4. **Sync Gandi API Token**:
```bash
# Run the sync script
cd /home/daldworth/repos/ringer-warp/kubernetes/ssl/scripts
./sync-gandi-secret.sh

# Or manually:
gcloud secrets versions access latest --secret="gandi-api-token" --project="ringer-400401" | \
  kubectl create secret generic gandi-api-token \
  --from-file=api-token=/dev/stdin \
  --namespace=cert-manager
```

### Phase 3: Certificate Issuance (Staging)

5. **Create ClusterIssuers**:
```bash
# Apply staging issuer first
kubectl apply -f /home/daldworth/repos/ringer-warp/kubernetes/ssl/issuers/02-letsencrypt-staging-issuer.yaml

# Verify
kubectl get clusterissuer
```

6. **Create Certificates**:
```bash
# Apply certificate resources
kubectl apply -f /home/daldworth/repos/ringer-warp/kubernetes/ssl/certificates/

# Monitor certificate issuance
kubectl get certificate --all-namespaces -w
kubectl describe certificate -n warp-api api-gateway-tls

# Check challenges
kubectl get challenges --all-namespaces
```

### Phase 4: Configure Ingress with TLS

7. **Update/Create Ingress Resources**:
```bash
# Apply TLS-enabled ingress configurations
kubectl apply -f /home/daldworth/repos/ringer-warp/kubernetes/ssl/ingress/08-api-ingress-tls.yaml
kubectl apply -f /home/daldworth/repos/ringer-warp/kubernetes/ssl/ingress/09-monitoring-ingress-tls.yaml
kubectl apply -f /home/daldworth/repos/ringer-warp/kubernetes/ssl/ingress/10-homer-ingress-tls.yaml
```

### Phase 5: DNS Configuration

8. **Configure DNS Records**:
```bash
# Point domains to NGINX Ingress external IP
INGRESS_IP=$(kubectl get svc -n ingress-nginx nginx-ingress-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "Configure these DNS records:"
echo "api-v2.ringer.tel -> $INGRESS_IP"
echo "grafana.ringer.tel -> $INGRESS_IP"
echo "prometheus.ringer.tel -> $INGRESS_IP"
echo "homer.ringer.tel -> $INGRESS_IP"
```

### Phase 6: Testing

9. **Test Staging Certificates**:
```bash
# Check certificate status
kubectl get certificate --all-namespaces

# Test HTTPS endpoints (will show staging certificate warning)
curl -kv https://api-v2.ringer.tel
curl -kv https://grafana.ringer.tel

# Check certificate details
echo | openssl s_client -connect api-v2.ringer.tel:443 2>/dev/null | openssl x509 -noout -text | grep -E "(Subject:|Issuer:)"
```

### Phase 7: Production Deployment

10. **Switch to Production**:
```bash
# Apply production issuer
kubectl apply -f /home/daldworth/repos/ringer-warp/kubernetes/ssl/issuers/03-letsencrypt-production-issuer.yaml

# Update all certificates and ingresses to use production issuer
# Edit files to change: letsencrypt-staging -> letsencrypt-production
sed -i 's/letsencrypt-staging/letsencrypt-production/g' /home/daldworth/repos/ringer-warp/kubernetes/ssl/certificates/*.yaml
sed -i 's/letsencrypt-staging/letsencrypt-production/g' /home/daldworth/repos/ringer-warp/kubernetes/ssl/ingress/*.yaml

# Reapply configurations
kubectl apply -f /home/daldworth/repos/ringer-warp/kubernetes/ssl/certificates/
kubectl apply -f /home/daldworth/repos/ringer-warp/kubernetes/ssl/ingress/

# Delete old staging certificates to force renewal
kubectl delete certificate --all --all-namespaces --field-selector metadata.name=~"*-tls*"
```

### Phase 8: SIP Services TLS

11. **Configure Kamailio for TLS**:
```bash
# Update Kamailio deployments to mount TLS certificates
# This requires modifying the existing Kamailio deployments
# to include volume mounts for the TLS secrets

# Example patch for Kamailio deployment:
kubectl patch deployment kamailio -n warp-core --type='json' -p='[
  {
    "op": "add",
    "path": "/spec/template/spec/volumes/-",
    "value": {
      "name": "tls-certs",
      "secret": {
        "secretName": "kamailio-tls-secret"
      }
    }
  },
  {
    "op": "add",
    "path": "/spec/template/spec/containers/0/volumeMounts/-",
    "value": {
      "name": "tls-certs",
      "mountPath": "/etc/kamailio/tls",
      "readOnly": true
    }
  }
]'
```

## Monitoring & Troubleshooting

### Check Certificate Status
```bash
# List all certificates
kubectl get certificate --all-namespaces

# Describe a specific certificate
kubectl describe certificate -n warp-api api-gateway-tls

# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager

# Check challenges
kubectl get challenges --all-namespaces
kubectl describe challenge -n warp-api <challenge-name>
```

### Common Issues

1. **DNS-01 Challenge Failures**:
   - Verify Gandi API token is correct
   - Check webhook logs: `kubectl logs -n cert-manager -l app=cert-manager-webhook-gandi`
   - Ensure DNS propagation time (may take 2-5 minutes)

2. **HTTP-01 Challenge Failures**:
   - Verify Ingress is accessible from internet
   - Check firewall rules allow port 80
   - Ensure correct DNS records point to Ingress IP

3. **Rate Limiting**:
   - Let's Encrypt has rate limits (50 certs per domain per week)
   - Always test with staging first
   - Use wildcard certificates to reduce certificate count

### Certificate Renewal
- cert-manager automatically renews certificates 30 days before expiry
- No manual intervention required
- Monitor cert-manager logs for renewal status

## Security Considerations

1. **HSTS Headers**: Enabled on all HTTPS services
2. **TLS Versions**: Minimum TLS 1.2 enforced
3. **Basic Auth**: Enabled for monitoring endpoints
4. **Rate Limiting**: Configured on API endpoints
5. **Security Headers**: X-Frame-Options, X-Content-Type-Options, etc.

## Next Steps

1. Configure external-dns for automatic DNS record management
2. Implement mutual TLS (mTLS) for service-to-service communication
3. Set up certificate monitoring and alerting
4. Configure backup and disaster recovery for certificates
5. Implement certificate pinning for mobile clients

## References
- [cert-manager Documentation](https://cert-manager.io/docs/)
- [Let's Encrypt Rate Limits](https://letsencrypt.org/docs/rate-limits/)
- [NGINX Ingress TLS](https://kubernetes.github.io/ingress-nginx/user-guide/tls/)
- [Gandi Webhook](https://github.com/bwolf/cert-manager-webhook-gandi)