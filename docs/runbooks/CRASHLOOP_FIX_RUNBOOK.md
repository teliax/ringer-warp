# CrashLoopBackOff Fix Runbook

**Date Created**: October 1, 2025
**Issue Type**: Critical Service Failures
**Affected Components**: Kamailio, Jasmin SMSC

---

## Executive Summary

This runbook documents the resolution of critical CrashLoopBackOff issues affecting Kamailio and Jasmin SMSC pods that have been failing for 9+ days with 2000+ restarts each.

### Root Causes Identified

1. **Kamailio**: Configuration syntax error - placeholder `__LOG_LEVEL__` on line 11 not being substituted
2. **Jasmin SMSC**: Missing `RABBITMQ_USERNAME` environment variable causing authentication failures

---

## Issue 1: Kamailio CrashLoopBackOff

### Symptoms
```
kamailio-6f7d84b9c9-w4qsm    1/2  CrashLoopBackOff  2647 restarts
kamailio-756897d4c9-4g7zm    1/2  CrashLoopBackOff  2647 restarts
kamailio-7857dc477b-4tn6t    1/2  CrashLoopBackOff  2649 restarts
```

### Root Cause
```
CRITICAL: parse error in config file /etc/kamailio/kamailio.cfg, line 11, column 7-19: syntax error
```

**Line 11 in kamailio.cfg:**
```
debug=__LOG_LEVEL__
```

The placeholder `__LOG_LEVEL__` is not being substituted, causing Kamailio to fail at startup.

### Analysis

The deployment in namespace `ringer-warp-v01` appears to be using an incorrect or outdated configuration. The repository contains a correct deployment manifest at `warp/k8s/kamailio/deployment.yaml` which:

1. Uses namespace `warp-sip` (not `ringer-warp-v01`)
2. Properly configures environment variables via ConfigMap
3. Uses LOG_LEVEL from environment variables

### Solution

#### Option A: Deploy Correct Configuration (Recommended)

1. **Delete old deployments:**
   ```bash
   kubectl delete deployment -n ringer-warp-v01 -l app=kamailio
   kubectl delete configmap -n ringer-warp-v01 kamailio-config
   ```

2. **Create correct namespace:**
   ```bash
   kubectl create namespace warp-sip
   ```

3. **Apply correct deployment:**
   ```bash
   kubectl apply -f warp/k8s/kamailio/deployment.yaml
   ```

4. **Verify:**
   ```bash
   kubectl get pods -n warp-sip -l app=kamailio
   kubectl logs -n warp-sip -l app=kamailio
   ```

#### Option B: Fix Docker Image Entrypoint

If you need to keep the current namespace, update the Docker image's entrypoint script to substitute placeholders:

```bash
# In the entrypoint script, add:
LOG_LEVEL=${LOG_LEVEL:-2}
sed -i "s|__LOG_LEVEL__|${LOG_LEVEL}|g" /etc/kamailio/kamailio.cfg
sed -i "s|__PRIVATE_IP__|${PRIVATE_IP}|g" /etc/kamailio/kamailio.cfg
sed -i "s|__PUBLIC_IP__|${PUBLIC_IP}|g" /etc/kamailio/kamailio.cfg
```

### Quick Fix Script

Run the automated fix script:
```bash
./scripts/fix-kamailio-crashloop.sh
```

---

## Issue 2: Jasmin SMSC RabbitMQ Authentication

### Symptoms
```
jasmin-smsc-5bf588c4dd-hfbls   0/1  CrashLoopBackOff  2081 restarts
```

### Root Cause
```
ERROR AMQP authentication failed
Connection to the other side was lost in a non-clean fashion
```

**Analysis:**
- RabbitMQ has user `jasmin` (confirmed via `rabbitmqctl list_users`)
- Jasmin deployment has `RABBITMQ_PASSWORD` environment variable
- **Missing**: `RABBITMQ_USERNAME` environment variable
- The init-config script attempts to substitute username but variable doesn't exist

### Solution

#### Fix Applied to kubernetes/jasmin/deployments/jasmin.yaml

**Added environment variable:**
```yaml
env:
- name: RABBITMQ_USERNAME
  value: "jasmin"
- name: RABBITMQ_PASSWORD
  valueFrom:
    secretKeyRef:
      name: rabbitmq-credentials
      key: password
```

**Updated sed substitution:**
```bash
sed -i "s|jasmin|$RABBITMQ_USERNAME|g" /config/jasmin.cfg
sed -i "s|jasmin-pass|$RABBITMQ_PASSWORD|g" /config/jasmin.cfg
```

#### Apply Fix

1. **Apply updated deployment:**
   ```bash
   kubectl apply -f kubernetes/jasmin/deployments/jasmin.yaml
   ```

2. **Delete existing pods to force recreation:**
   ```bash
   kubectl delete pod -n messaging -l app=jasmin
   ```

3. **Watch pod startup:**
   ```bash
   kubectl get pods -n messaging -l app=jasmin -w
   ```

4. **Check logs for successful connection:**
   ```bash
   kubectl logs -n messaging -l app=jasmin -f | grep -E "Connection|AMQP|RabbitMQ"
   ```

### Quick Fix Script

Run the automated fix script:
```bash
./scripts/fix-jasmin-rabbitmq.sh
```

---

## Verification Checklist

### Kamailio Verification

- [ ] Pods in `Running` state without restarts
- [ ] No parse errors in logs
- [ ] SIP ports accessible (5060, 5061, 8080)
- [ ] Prometheus metrics endpoint responding (9090)
- [ ] Database connectivity working
- [ ] RTPEngine integration functional

```bash
# Check pod status
kubectl get pods -n warp-sip -l app=kamailio

# Check logs
kubectl logs -n warp-sip -l app=kamailio | tail -50

# Test SIP connectivity
nc -zv <kamailio-lb-ip> 5060
```

### Jasmin SMSC Verification

- [ ] Pods in `Running` state without restarts
- [ ] Successful RabbitMQ connection in logs
- [ ] Redis connection working
- [ ] HTTP API responding (port 8080)
- [ ] SMPP ports accessible (2775, 2776)
- [ ] Admin CLI accessible (port 8990)

```bash
# Check pod status
kubectl get pods -n messaging -l app=jasmin

# Check logs for successful connections
kubectl logs -n messaging -l app=jasmin | grep -i "connection\|rabbitmq\|redis"

# Test HTTP API
kubectl port-forward -n messaging svc/jasmin-http 8080:8080
curl http://localhost:8080/ping
```

---

## Post-Fix Monitoring

### Metrics to Monitor

1. **Pod Restart Count**
   ```bash
   kubectl get pods --all-namespaces | grep -E 'kamailio|jasmin'
   ```

2. **Error Logs**
   ```bash
   kubectl logs -n warp-sip -l app=kamailio --tail=100 | grep -i error
   kubectl logs -n messaging -l app=jasmin --tail=100 | grep -i error
   ```

3. **Resource Usage**
   ```bash
   kubectl top pods -n warp-sip -l app=kamailio
   kubectl top pods -n messaging -l app=jasmin
   ```

4. **Service Health**
   - Prometheus: https://prometheus.ringer.tel
   - Grafana: https://grafana.ringer.tel

---

## Rollback Procedures

### Rollback Kamailio

```bash
# If new deployment fails, rollback
kubectl rollout undo deployment/kamailio -n warp-sip

# Check rollout status
kubectl rollout status deployment/kamailio -n warp-sip
```

### Rollback Jasmin

```bash
# Restore previous version from git
git checkout HEAD~1 kubernetes/jasmin/deployments/jasmin.yaml

# Reapply
kubectl apply -f kubernetes/jasmin/deployments/jasmin.yaml

# Or use kubectl rollout
kubectl rollout undo deployment/jasmin-smsc -n messaging
```

---

## Prevention

### Kamailio

1. **CI/CD Validation**: Add config validation step
   ```bash
   kamailio -f /etc/kamailio/kamailio.cfg -c
   ```

2. **Env Var Validation**: Ensure all placeholders are substituted in entrypoint

3. **Health Checks**: Proper liveness/readiness probes

### Jasmin

1. **Secret Validation**: Verify RabbitMQ credentials before deployment
   ```bash
   kubectl get secret -n messaging rabbitmq-credentials -o yaml
   ```

2. **Config Testing**: Test jasmin.cfg with actual env vars in staging

3. **Init Container Validation**: Add validation step in init-config container

---

## Related Documentation

- [Kamailio Deployment](../warp/k8s/kamailio/deployment.yaml)
- [Jasmin Deployment](../kubernetes/jasmin/deployments/jasmin.yaml)
- [Status Report](../docs/STATUS_2025-10-01.md)
- [Architecture](../warp/docs/ARCHITECTURE.md)

---

## Incident Timeline

| Date | Event |
|------|-------|
| Sep 23, 2025 | Services deployed |
| Sep 23-Oct 1 | CrashLoopBackOff (9+ days, 2000+ restarts) |
| Oct 1, 2025 | Root cause analysis completed |
| Oct 1, 2025 | Fixes implemented and documented |

---

## Success Criteria

✅ **Fixed** when:
1. Kamailio pods running for 24+ hours without restarts
2. Jasmin pods running for 24+ hours without restarts
3. Zero CrashLoopBackOff events
4. All health checks passing
5. Services responding to requests
6. No authentication errors in logs

---

**Last Updated**: October 1, 2025
**Status**: Fixes Implemented - Awaiting Deployment
**Next Review**: October 2, 2025
