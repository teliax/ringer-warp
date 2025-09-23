# WARP Phase 2 QA Test Execution Plan

**Date**: September 23, 2025
**QA Specialist**: Integration Testing Coordinator
**Current Environment**: Production (`ringer-warp-v01`)

## 📋 Component Status Overview

### ✅ Successfully Deployed Components
1. **Kong API Gateway**
   - Status: Running (3 replicas)
   - LoadBalancer IP: 34.41.176.225
   - Admin API: Available on ClusterIP
   - Database: PostgreSQL configured

2. **RTPEngine VMs**
   - Status: 3 instances RUNNING
   - IPs: 34.123.38.31, 35.222.101.214, 35.225.65.80
   - Zones: us-central1-a/b/c

### ❌ Components with Issues
1. **Jasmin SMSC**
   - Status: CrashLoopBackOff
   - Issue: Redis authentication failure
   - Secondary Issue: RabbitMQ authentication failure
   - Pods: 0/1 ready

### ✅ Cleaned Up Components
1. **LoadBalancers**
   - Status: Deprecated services identified
   - Action: Pending removal

## 🧪 Test Execution Plan

### Phase 1: Kong API Gateway Testing (Immediate)

#### A. Authentication Tests
```bash
# 1. JWT Authentication
python3 /home/daldworth/repos/ringer-warp/tests/phase2/api-gateway/scripts/kong-test-suite.py \
  --url http://34.41.176.225 \
  --test auth

# 2. API Key Authentication
curl -X GET http://34.41.176.225/v1/health \
  -H "X-API-Key: test-key-123456"
```

#### B. Rate Limiting Tests
```bash
# Rate limit verification
python3 /home/daldworth/repos/ringer-warp/tests/phase2/api-gateway/scripts/kong-test-suite.py \
  --url http://34.41.176.225 \
  --test rate-limit
```

#### C. Routing and Performance
```bash
# Full test suite
python3 /home/daldworth/repos/ringer-warp/tests/phase2/api-gateway/scripts/kong-test-suite.py \
  --url http://34.41.176.225 \
  --test all
```

### Phase 2: RTPEngine Validation

#### A. Connectivity Tests
```bash
# 1. SSH connectivity to VMs
for ip in 34.123.38.31 35.222.101.214 35.225.65.80; do
  echo "Testing RTPEngine at $ip"
  gcloud compute ssh warp-rtpengine-${ip##*.} --zone=us-central1-a \
    --command="sudo systemctl status rtpengine"
done

# 2. Port availability (22222 for control)
for ip in 34.123.38.31 35.222.101.214 35.225.65.80; do
  nc -zv $ip 22222
done
```

#### B. Kamailio Integration Test
```bash
# Check if Kamailio can reach RTPEngine
kubectl exec -n ringer-warp-v01 deployment/kamailio-sip -- \
  rtpengine-ctl list
```

### Phase 3: Jasmin SMSC Remediation

#### A. Diagnose Issues
```bash
# 1. Check Redis connectivity
kubectl exec -n messaging deployment/jasmin-smsc -- \
  redis-cli -h redis-service ping

# 2. Check RabbitMQ status
kubectl get pods -n messaging -l app=rabbitmq

# 3. Review Jasmin configuration
kubectl describe configmap -n messaging jasmin-config
```

#### B. Fix Authentication
```yaml
# Update Jasmin ConfigMap to remove Redis password
apiVersion: v1
kind: ConfigMap
metadata:
  name: jasmin-config
  namespace: messaging
data:
  jasmin.cfg: |
    [redis-client]
    host = redis-service
    port = 6379
    # Remove password line or set to empty
    
    [amqp-broker]
    host = rabbitmq-service
    port = 5672
    username = guest
    password = guest
```

### Phase 4: Integration Testing (After Fixes)

#### A. End-to-End Voice Test
```bash
# SIP registration and call flow
sipp -sn uac -d 10000 -s +12125551234 34.72.244.248:5060 \
  -m 1 -r 1 -rp 1000
```

#### B. SMS Flow Test (Once Jasmin Fixed)
```bash
# HTTP API test
/home/daldworth/repos/ringer-warp/tests/phase2/sms/scripts/http-api-test.sh

# SMPP test
python3 /home/daldworth/repos/ringer-warp/tests/phase2/sms/scripts/smpp-test-client.py
```

### Phase 5: LoadBalancer Cleanup

#### A. Identify Deprecated Services
```bash
# List all LoadBalancer services
kubectl get svc --all-namespaces -o json | \
  jq '.items[] | select(.spec.type=="LoadBalancer") | 
  {name: .metadata.name, namespace: .metadata.namespace, ip: .status.loadBalancer.ingress[0].ip}'
```

#### B. Remove Deprecated LoadBalancers
```bash
# Remove monitoring LoadBalancers (now using Ingress)
kubectl delete svc -n monitoring warp-monitoring-grafana-lb
kubectl delete svc -n monitoring warp-monitoring-prometheus-lb
```

## 📊 Test Metrics to Collect

1. **Kong API Gateway**
   - Authentication success rate
   - Average response time
   - Rate limiting accuracy
   - Error rates by endpoint

2. **RTPEngine**
   - Service availability
   - Port connectivity
   - Integration with Kamailio

3. **Jasmin SMSC**
   - Service startup success
   - Redis connectivity
   - RabbitMQ connectivity
   - API endpoint availability

## 🚨 Blocker Issues

1. **Jasmin SMSC**: Cannot start due to Redis auth
   - Impact: No SMS functionality
   - Fix: Update ConfigMap, remove auth requirement

2. **RabbitMQ**: Authentication failure
   - Impact: No message queuing for Jasmin
   - Fix: Verify RabbitMQ deployment and credentials

## 📈 Success Criteria

- [ ] Kong API Gateway: 90%+ test pass rate
- [ ] RTPEngine: All 3 instances accessible
- [ ] Jasmin SMSC: Service running without restarts
- [ ] Integration: End-to-end call and SMS flow working
- [ ] Performance: <100ms API response time

## 🔄 Next Steps

1. Execute Kong test suite immediately
2. Verify RTPEngine connectivity
3. Fix Jasmin authentication issues
4. Re-run full test suite after fixes
5. Generate final QA report