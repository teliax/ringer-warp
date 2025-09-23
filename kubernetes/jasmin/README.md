# Jasmin SMSC Kubernetes Deployment

This directory contains the complete Kubernetes deployment configuration for Jasmin SMSC with Sinch SMPP integration.

## Architecture Overview

The Jasmin SMSC deployment consists of:

1. **RabbitMQ** - Message queue for reliable message delivery
2. **Redis** - Cache and session storage
3. **Jasmin SMSC** - Core SMS gateway with SMPP and HTTP API
4. **Monitoring** - Prometheus metrics and health checks

## Directory Structure

```
jasmin/
├── README.md                    # This file
├── namespace.yaml              # Kubernetes namespace
├── configmaps/
│   ├── jasmin-config.yaml      # Jasmin configuration
│   ├── redis-config.yaml       # Redis configuration
│   └── rabbitmq-config.yaml    # RabbitMQ configuration
├── secrets/
│   ├── jasmin-secrets.yaml     # Jasmin credentials (template)
│   ├── sinch-secrets.yaml      # Sinch SMPP credentials (template)
│   └── rabbitmq-secrets.yaml   # RabbitMQ credentials (template)
├── deployments/
│   ├── rabbitmq.yaml           # RabbitMQ StatefulSet
│   ├── redis.yaml              # Redis Deployment
│   └── jasmin.yaml             # Jasmin SMSC Deployment
├── services/
│   ├── rabbitmq-service.yaml   # RabbitMQ Service
│   ├── redis-service.yaml      # Redis Service
│   └── jasmin-service.yaml     # Jasmin SMSC Service
├── ingress/
│   └── jasmin-ingress.yaml     # HTTP API Ingress
├── monitoring/
│   └── jasmin-servicemonitor.yaml # Prometheus monitoring
└── scripts/
    ├── deploy.sh               # Deployment script
    └── test-sms.sh            # SMS testing script
```

## Prerequisites

1. Kubernetes cluster (1.20+)
2. kubectl configured
3. Storage class available for PersistentVolumes
4. Ingress controller installed
5. Prometheus operator (optional, for monitoring)

## Configuration

### 1. Secrets Setup

Copy and edit the secret templates:

```bash
cp secrets/jasmin-secrets.yaml.template secrets/jasmin-secrets.yaml
cp secrets/sinch-secrets.yaml.template secrets/sinch-secrets.yaml
cp secrets/rabbitmq-secrets.yaml.template secrets/rabbitmq-secrets.yaml
```

Edit each file with your credentials.

### 2. Sinch Integration

Configure Sinch SMPP settings in `secrets/sinch-secrets.yaml`:
- SMPP host
- SMPP port (usually 2775)
- Username
- Password
- System ID
- System Type

### 3. Configure Jasmin

Edit `configmaps/jasmin-config.yaml` for:
- Throughput limits
- Routing rules
- 10DLC compliance settings
- HTTP API configuration

## Deployment

### Step 1: Deploy Prerequisites

```bash
# Create namespace
kubectl apply -f namespace.yaml

# Deploy secrets (ensure they're configured first!)
kubectl apply -f secrets/

# Deploy ConfigMaps
kubectl apply -f configmaps/
```

### Step 2: Deploy Infrastructure

```bash
# Deploy RabbitMQ
kubectl apply -f deployments/rabbitmq.yaml
kubectl apply -f services/rabbitmq-service.yaml

# Wait for RabbitMQ to be ready
kubectl wait --for=condition=ready pod -l app=rabbitmq -n messaging --timeout=300s

# Deploy Redis
kubectl apply -f deployments/redis.yaml
kubectl apply -f services/redis-service.yaml

# Wait for Redis to be ready
kubectl wait --for=condition=ready pod -l app=redis -n messaging --timeout=300s
```

### Step 3: Deploy Jasmin SMSC

```bash
# Deploy Jasmin
kubectl apply -f deployments/jasmin.yaml
kubectl apply -f services/jasmin-service.yaml

# Deploy Ingress for HTTP API
kubectl apply -f ingress/jasmin-ingress.yaml

# Deploy monitoring
kubectl apply -f monitoring/
```

### Step 4: Initialize Jasmin

Connect to Jasmin CLI to configure Sinch connector:

```bash
kubectl exec -it deployment/jasmin-smsc -n messaging -- telnet localhost 8990
```

Or use the automated initialization script:

```bash
kubectl exec -it deployment/jasmin-smsc -n messaging -- /etc/jasmin/scripts/init-jasmin.sh
```

## Testing

### Test SMPP Connection

```bash
# Check Sinch connection status
kubectl exec -it deployment/jasmin-smsc -n messaging -- jasmin-cli smppccm -l
```

### Send Test SMS via HTTP API

```bash
./scripts/test-sms.sh +1234567890 "Test message from Jasmin"
```

### Check Logs

```bash
# Jasmin logs
kubectl logs -f deployment/jasmin-smsc -n messaging

# RabbitMQ logs
kubectl logs -f statefulset/rabbitmq -n messaging

# Redis logs
kubectl logs -f deployment/redis -n messaging
```

## Monitoring

Access metrics at:
- Jasmin metrics: http://<jasmin-service>:9100/metrics
- RabbitMQ management: http://<rabbitmq-service>:15672
- HTTP API health: http://<jasmin-http-api>/ping

## Troubleshooting

### Common Issues

1. **Connection to Sinch fails**
   - Check credentials in secrets
   - Verify network connectivity
   - Check Sinch IP whitelist

2. **Messages not routing**
   - Check routing rules in jCli
   - Verify connector status
   - Check RabbitMQ queues

3. **High latency**
   - Check resource limits
   - Monitor RabbitMQ performance
   - Scale Jasmin replicas

### Useful Commands

```bash
# Check Jasmin status
kubectl get pods -n messaging -l app=jasmin

# View Jasmin configuration
kubectl exec -it deployment/jasmin-smsc -n messaging -- cat /etc/jasmin/jasmin.cfg

# Access Jasmin CLI
kubectl exec -it deployment/jasmin-smsc -n messaging -- telnet localhost 8990

# Check SMPP connectors
kubectl exec -it deployment/jasmin-smsc -n messaging -- jasmin-cli smppccm -l

# View routing table
kubectl exec -it deployment/jasmin-smsc -n messaging -- jasmin-cli mtrouter -l
```

## Scaling

To scale Jasmin for high availability:

```bash
kubectl scale deployment jasmin-smsc --replicas=3 -n messaging
```

Note: Ensure session affinity is configured for HTTP API clients.

## Security

1. All secrets are stored as Kubernetes secrets
2. SMPP SSL/TLS is supported on port 2776
3. HTTP API should be accessed via HTTPS ingress
4. Network policies can restrict access

## Integration with Warp Platform

Jasmin integrates with the Warp platform for:
- SMS/MMS message routing
- 10DLC compliance checking
- Billing and usage tracking
- Multi-vendor failover