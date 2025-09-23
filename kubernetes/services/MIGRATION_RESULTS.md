# Service Migration Results

**Date**: September 23, 2025  
**Time**: 12:15 PM UTC

## Executive Summary

The Kubernetes service migration assessment has been completed. Key findings:

1. **No migration needed** - All monitoring services are already configured as ClusterIP
2. **Certificate issues resolved** - Grafana certificate was misconfigured but has been fixed
3. **Scripts created** - Full migration toolkit ready for future use

## Service Type Status

### ✅ Monitoring Services (Already ClusterIP)
- `warp-monitoring-grafana` - ClusterIP ✓
- `warp-monitoring-prometheus` - ClusterIP ✓  
- `warp-monitoring-alertmanager` - ClusterIP ✓

### ✅ Kamailio Services (Correctly LoadBalancer)
- `kamailio-sip-tcp` - LoadBalancer ✓
- `kamailio-sip-udp` - LoadBalancer ✓

## Certificate Resolution

### Issue Found
- `grafana-tls` certificate was attempting to issue for internal domain `grafana.warp-monitoring.local`
- Multiple Ingresses were conflicting over the same secret name
- Missing production Let's Encrypt issuer

### Actions Taken
1. Created `letsencrypt-prod` ClusterIssuer
2. Updated `grafana-ingress` to use unique secret name `grafana-ringer-tel-tls`
3. Successfully issued staging certificate for `grafana.ringer.tel`

### Current Certificate Status
- ✅ `prometheus-tls` - Ready (staging cert valid until Dec 22, 2025)
- ✅ `grafana-ringer-tel-tls` - Ready (staging cert valid until Dec 22, 2025)
- ✅ `api-v2-ringer-tel-tls` - Ready (staging cert valid until Dec 22, 2025)

## Remaining Issues

### 1. HTTPS Connectivity
While certificates are issued, HTTPS connectivity is not working:
- Connection refused on port 443
- May need to check Ingress controller configuration
- Possible firewall rules needed

### 2. Production Certificates
Currently using staging certificates. To move to production:
```bash
# Update ingress annotations
kubectl annotate ingress grafana-ingress -n monitoring \
  cert-manager.io/cluster-issuer=letsencrypt-prod --overwrite

kubectl annotate ingress prometheus-ingress -n monitoring \
  cert-manager.io/cluster-issuer=letsencrypt-prod --overwrite
```

### 3. Internal Domain Certificates
The `grafana.warp-monitoring.local` domain cannot get Let's Encrypt certificates.
Options:
- Use self-signed certificates for internal domains
- Remove the internal ingresses if not needed
- Use a proper internal CA

## Migration Scripts Created

### 1. Main Migration Script
**Path**: `/kubernetes/services/scripts/migrate-services.sh`

Features:
- Pre-flight checks
- Automatic backups
- Service type migration
- Connectivity testing
- Rollback support

### 2. Rollback Script  
**Path**: `/kubernetes/services/scripts/rollback-services.sh`

Usage modes:
- Interactive menu
- Command-line options
- Timestamp-based rollback
- Service-specific rollback

### 3. Certificate Monitor
**Path**: `/kubernetes/services/scripts/monitor-certificates.sh`

Features:
- Real-time certificate status
- Challenge monitoring
- Domain connectivity tests
- Continuous monitoring mode

## Documentation Created

1. **MIGRATION_GUIDE.md** - Comprehensive migration guide
2. **CURRENT_STATUS.md** - Initial status assessment
3. **MIGRATION_RESULTS.md** - This file

## Next Steps

### Immediate Actions
1. Investigate HTTPS connectivity issue:
   ```bash
   kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
   ```

2. Check Ingress controller configuration:
   ```bash
   kubectl get svc -n ingress-nginx
   ```

3. Test internal connectivity:
   ```bash
   kubectl run test-curl --rm -it --image=curlimages/curl -- \
     curl -v http://warp-monitoring-grafana.monitoring.svc.cluster.local
   ```

### Future Improvements
1. Set up monitoring alerts for certificate expiry
2. Automate certificate renewal verification
3. Create internal CA for `.local` domains
4. Document firewall rules for external access

## Conclusion

While the initial goal was to migrate services from LoadBalancer to ClusterIP, the investigation revealed that:
1. Services are already properly configured
2. The main issue was certificate misconfiguration
3. HTTPS connectivity needs additional troubleshooting

The migration scripts and documentation created will be valuable for:
- Future service migrations
- Certificate management
- Troubleshooting connectivity issues
- Maintaining service configurations