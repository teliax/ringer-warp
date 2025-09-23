# Phase 2 Component Remediation Plan

**Date**: September 23, 2025  
**Status**: Critical Issues Identified

## 🚨 Critical Issues Requiring Immediate Action

### 1. Jasmin SMSC - Authentication Failures

**Current State**: CrashLoopBackOff (0/1 pods ready)

**Root Causes**:
1. Redis authentication error: "ERR AUTH <password> called without any password configured"
2. RabbitMQ authentication failure: Connection lost during AMQP authentication

**Remediation Steps**:

#### Step 1: Fix Redis Configuration
```bash
# Check if Redis has authentication enabled
kubectl exec -n messaging deployment/redis -- redis-cli CONFIG GET requirepass

# Update Jasmin ConfigMap to remove Redis password
kubectl edit configmap -n messaging jasmin-config

# Remove or comment out the password line in [redis-client] section:
# password = your_redis_password
```

#### Step 2: Fix RabbitMQ Authentication
```bash
# Check RabbitMQ service
kubectl get svc -n messaging rabbitmq-service

# If RabbitMQ is not deployed, deploy it:
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rabbitmq
  namespace: messaging
spec:
  replicas: 1
  selector:
    matchLabels:
      app: rabbitmq
  template:
    metadata:
      labels:
        app: rabbitmq
    spec:
      containers:
      - name: rabbitmq
        image: rabbitmq:3.12-management
        ports:
        - containerPort: 5672
        - containerPort: 15672
        env:
        - name: RABBITMQ_DEFAULT_USER
          value: "guest"
        - name: RABBITMQ_DEFAULT_PASS
          value: "guest"
---
apiVersion: v1
kind: Service
metadata:
  name: rabbitmq-service
  namespace: messaging
spec:
  selector:
    app: rabbitmq
  ports:
  - name: amqp
    port: 5672
  - name: management
    port: 15672
EOF
```

#### Step 3: Restart Jasmin
```bash
kubectl rollout restart deployment/jasmin-smsc -n messaging
kubectl logs -n messaging deployment/jasmin-smsc -f
```

### 2. Kong API Gateway - No Routes Configured

**Current State**: Running but returning 404 for all endpoints

**Root Cause**: Kong is deployed but no routes/services are configured

**Remediation Steps**:

```bash
# Configure Kong routes for warp-api
kubectl apply -f - <<EOF
apiVersion: configuration.konghq.com/v1
kind: KongIngress
metadata:
  name: warp-api-upstream
  namespace: kong
upstream:
  healthchecks:
    active:
      healthy:
        interval: 5
        successes: 3
      http_path: /health
      type: http
    passive:
      healthy:
        successes: 3
      unhealthy:
        http_failures: 3
---
apiVersion: v1
kind: Service
metadata:
  name: warp-api-service
  namespace: kong
  annotations:
    konghq.com/upstream: warp-api-upstream
spec:
  type: ExternalName
  externalName: warp-api.warp-api.svc.cluster.local
  ports:
  - port: 8080
    name: http
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: warp-api-routes
  namespace: kong
  annotations:
    konghq.com/strip-path: "false"
    konghq.com/plugins: "jwt-auth,rate-limiting,cors"
spec:
  ingressClassName: kong
  rules:
  - http:
      paths:
      - path: /v1
        pathType: Prefix
        backend:
          service:
            name: warp-api-service
            port:
              number: 8080
      - path: /health
        pathType: Exact
        backend:
          service:
            name: warp-api-service
            port:
              number: 8080
EOF
```

### 3. RTPEngine - Service Not Running on VMs

**Current State**: VMs are running but RTPEngine service not accessible

**Root Cause**: RTPEngine not installed/started on the VMs

**Remediation Steps**:

```bash
# SSH into each RTPEngine VM and install/configure
for i in 1 2 3; do
  gcloud compute ssh warp-rtpengine-$i --zone=us-central1-$(echo a b c | cut -d' ' -f$i) --project=ringer-warp-v01 --command="
    # Install RTPEngine
    sudo apt-get update
    sudo apt-get install -y rtpengine
    
    # Configure RTPEngine
    sudo tee /etc/rtpengine/rtpengine.conf <<EOL
[rtpengine]
interface = eth0
listen-ng = 22222
port-min = 30000
port-max = 40000
log-level = 6
EOL
    
    # Start service
    sudo systemctl enable rtpengine
    sudo systemctl start rtpengine
    sudo systemctl status rtpengine
  "
done
```

## 📋 Verification Tests After Remediation

### Jasmin SMSC Health Check
```bash
# Check pod status
kubectl get pods -n messaging -l app=jasmin

# Test HTTP API
curl -X POST http://34.28.244.11:8080/send \
  -d "username=test&password=test&to=+1234567890&content=Test"

# Test SMPP port
nc -zv 34.28.244.11 2775
```

### Kong API Gateway Verification
```bash
# Test health endpoint
curl http://34.41.176.225/health

# Test authenticated endpoint
curl http://34.41.176.225/v1/customers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### RTPEngine Verification
```bash
# Test control port
for ip in 34.123.38.31 35.222.101.214 35.225.65.80; do
  echo "Testing $ip..."
  nc -zv $ip 22222
done

# Check Kamailio integration
kubectl exec -n ringer-warp-v01 deployment/kamailio-sip -- \
  rtpengine-ctl -s udp:34.123.38.31:22222 list
```

## 🎯 Success Criteria

- [ ] Jasmin SMSC: Pod running without restarts for 5+ minutes
- [ ] Kong Gateway: Returns valid responses for configured routes
- [ ] RTPEngine: All 3 instances respond on port 22222
- [ ] Integration: Kamailio can communicate with RTPEngine

## 📊 Risk Assessment

| Component | Risk Level | Impact | Mitigation |
|-----------|------------|--------|------------|
| Jasmin SMSC | HIGH | No SMS capability | Deploy Redis/RabbitMQ if missing |
| Kong Gateway | MEDIUM | No API routing | Configure routes manually |
| RTPEngine | MEDIUM | No media handling | Install from package manager |

## 🔄 Rollback Plan

If remediation fails:
1. Document all error messages
2. Check component logs for root causes
3. Consider deploying fresh instances
4. Escalate to infrastructure team if needed