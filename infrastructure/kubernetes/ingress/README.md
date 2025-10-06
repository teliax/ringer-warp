# Monitoring Services Ingress Configuration

## Created Ingress Resources

1. **Grafana Ingress** (`grafana-ingress.yaml`)
   - Host: grafana.ringer.tel
   - Service: warp-monitoring-grafana (port 80)
   - Namespace: monitoring
   - SSL: Enabled with Let's Encrypt Staging

2. **Prometheus Ingress** (`prometheus-ingress.yaml`)
   - Host: prometheus.ringer.tel
   - Service: warp-monitoring-prometheus (port 9090)
   - Namespace: monitoring
   - SSL: Enabled with Let's Encrypt Staging

3. **HOMER Ingress** (`homer-ingress.yaml`)
   - Host: homer.ringer.tel
   - Service: homer (port 9080) - *Service not yet deployed*
   - Namespace: homer
   - SSL: Enabled with Let's Encrypt Staging
   - WebSocket support enabled

## Current Status

### Applied Resources
- ✅ Grafana ingress created and applied
- ✅ Prometheus ingress created and applied
- ⏳ HOMER ingress created but not applied (waiting for HOMER deployment)

### Certificate Status
- ⚠️ Certificates are pending due to DNS misconfiguration
- Both Grafana and Prometheus certificates are waiting for ACME challenge validation

## DNS Configuration Issue

**CRITICAL**: The DNS records for the monitoring services are pointing to incorrect IP addresses:

| Service | Current DNS IP | Should Point To |
|---------|----------------|-----------------|
| grafana.ringer.tel | 35.224.100.108 | 34.72.20.183 |
| prometheus.ringer.tel | 35.224.246.74 | 34.72.20.183 |
| homer.ringer.tel | (not configured) | 34.72.20.183 |

The DNS records must be updated to point to the NGINX Ingress Controller's external IP: **34.72.20.183**

## Next Steps

1. **Update DNS Records**: Update A records for all three domains to point to 34.72.20.183
2. **Wait for DNS Propagation**: Usually takes 5-30 minutes
3. **Monitor Certificate Creation**: 
   ```bash
   kubectl get certificate -n monitoring
   kubectl get challenge -n monitoring
   ```
4. **Deploy HOMER Service**: Before applying homer-ingress.yaml
5. **Update Service Types**: Change services from LoadBalancer to ClusterIP (separate task)

## Verification Commands

```bash
# Check ingress status
kubectl get ingress -n monitoring
kubectl get ingress -n homer

# Check certificate status
kubectl get certificate -n monitoring
kubectl get certificate -n homer

# Check ACME challenges
kubectl get challenge -n monitoring
kubectl describe challenge <challenge-name> -n monitoring

# Verify DNS resolution
nslookup grafana.ringer.tel
nslookup prometheus.ringer.tel
nslookup homer.ringer.tel
```