# API Gateway Configuration - Correct URLs

**Date**: 2025-11-26
**Status**: ✅ Correct URLs Documented

---

## ✅ Correct API Gateway URL

**Domain**: `api.rns.ringer.tel`
**IP**: `34.58.150.254`
**DNS**: ✅ Correctly configured

**Verification**:
```bash
dig api.rns.ringer.tel +short
# Returns: 34.58.150.254 ✅
```

---

## 🌐 Production URLs

**API Gateway**:
- HTTP: `http://api.rns.ringer.tel`
- HTTPS: `https://api.rns.ringer.tel` (TODO: Fix SSL cert)

**Customer Portal**:
- `https://customer.rns.ringer.tel`

**Admin Portal**:
- `https://admin.rns.ringer.tel`

**Monitoring**:
- Grafana: `https://grafana.ringer.tel`
- Prometheus: `https://prometheus.ringer.tel`

---

## 🔧 Current Configuration

**Customer Portal** (`.env.local`):
```bash
VITE_API_URL=http://api.rns.ringer.tel
VITE_WS_URL=ws://api.rns.ringer.tel/ws
```

**Note**: Using HTTP for now because HTTPS has SSL certificate issues. Need to configure cert-manager.

---

## ⚠️ Known Issue: HTTPS/SSL

**Problem**: HTTPS returns SSL protocol error
**Cause**: Certificate not properly configured
**Workaround**: Use HTTP
**Fix**: Configure cert-manager + Ingress for SSL certificate

---

## 📋 To Enable HTTPS

1. **Check existing certificate**:
```bash
kubectl get certificate -n warp-api
kubectl get ingress -A
```

2. **Create Ingress with cert-manager**:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-gateway-ingress
  namespace: warp-api
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - api.rns.ringer.tel
    secretName: api-gateway-tls
  rules:
  - host: api.rns.ringer.tel
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-gateway
            port:
              number: 8080
```

3. **Apply and wait for certificate**:
```bash
kubectl apply -f ingress.yaml
kubectl get certificate -n warp-api -w
```

---

## 📝 Summary

**Correct API URL**: `api.rns.ringer.tel` ✅
**All documentation updated**: ✅
**DNS configured correctly**: ✅
**HTTP working**: ✅
**HTTPS needs**: cert-manager configuration

**No DNS issues! The correct domain is properly configured.**
