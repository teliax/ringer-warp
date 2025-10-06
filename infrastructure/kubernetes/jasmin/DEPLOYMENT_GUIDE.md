# Jasmin SMSC Deployment Guide for Kubernetes

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Pre-Deployment Configuration](#pre-deployment-configuration)
5. [Deployment Steps](#deployment-steps)
6. [Post-Deployment Configuration](#post-deployment-configuration)
7. [Testing](#testing)
8. [Monitoring](#monitoring)
9. [Troubleshooting](#troubleshooting)
10. [Maintenance](#maintenance)

## Overview

This guide covers the deployment of Jasmin SMSC (Short Message Service Centre) on Kubernetes with Sinch SMPP integration. Jasmin provides a robust SMS gateway with support for SMPP protocol, HTTP API, and advanced routing capabilities.

## Architecture

### Components

1. **Jasmin SMSC** (2 replicas)
   - SMPP Server (port 2775/2776)
   - HTTP API (port 8080)
   - Management CLI (port 8990)

2. **RabbitMQ** (3-node cluster)
   - Message queue for reliable delivery
   - Management UI (port 15672)

3. **Redis** (1 replica)
   - Session cache
   - Rate limiting
   - Message tracking

4. **Monitoring**
   - Prometheus metrics
   - Grafana dashboards
   - Custom exporters

### Network Architecture

```
Internet
    |
    v
[Ingress Controller]
    |
    +--> HTTP API (sms-api.warp-platform.com)
    |
    +--> RabbitMQ Mgmt (rabbitmq.warp-platform.com)
    
[Load Balancer] <-- SMPP Traffic (2775/2776)
    |
    v
[Jasmin SMSC Pods] <--> [RabbitMQ Cluster] <--> [Redis]
    |
    v
[Sinch SMPP Gateway]
```

## Prerequisites

### 1. Kubernetes Cluster

- Kubernetes 1.20 or higher
- At least 3 worker nodes
- 8 CPU cores and 16GB RAM available
- Storage class for PersistentVolumes

### 2. Required Tools

```bash
# Check kubectl
kubectl version --client

# Check cluster access
kubectl cluster-info

# Check available resources
kubectl top nodes
```

### 3. Networking Requirements

- Ingress controller (nginx-ingress recommended)
- Cert-manager for SSL certificates
- External IP for SMPP LoadBalancer
- DNS records for ingress hosts

### 4. Sinch Account

- Active Sinch account with SMPP access
- SMPP credentials (host, port, username, password)
- Whitelisted IP addresses for your cluster

## Pre-Deployment Configuration

### 1. Clone Configuration

```bash
cd /path/to/your/repo
cd kubernetes/jasmin
```

### 2. Configure Secrets

Copy and edit the secret templates:

```bash
# Copy templates
cp secrets/jasmin-secrets.yaml.template secrets/jasmin-secrets.yaml
cp secrets/sinch-secrets.yaml.template secrets/sinch-secrets.yaml
cp secrets/rabbitmq-secrets.yaml.template secrets/rabbitmq-secrets.yaml

# Edit each file with your credentials
vi secrets/jasmin-secrets.yaml
vi secrets/sinch-secrets.yaml
vi secrets/rabbitmq-secrets.yaml
```

#### Jasmin Secrets Configuration

Edit `secrets/jasmin-secrets.yaml`:

```yaml
stringData:
  admin-password: "GenerateStrongPassword123!"  # For jCLI access
  http-api-username: "api-user"
  http-api-password: "GenerateAPIPassword456!"  # For HTTP API
```

#### Sinch Secrets Configuration

Edit `secrets/sinch-secrets.yaml`:

```yaml
stringData:
  # Primary connection
  host: "smpp.sinch.com"  # Replace with your Sinch SMPP host
  port: "2775"
  username: "your-sinch-username"
  password: "your-sinch-password"
  system-id: "your-system-id"
  
  # Get your cluster's external IP
  allowed-ips: "YOUR_CLUSTER_EXTERNAL_IP"
```

To find your cluster's external IP:

```bash
# For AWS EKS
curl -s http://checkip.amazonaws.com

# For GKE
gcloud compute addresses list

# For other clouds
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- curl -s http://ifconfig.me
```

#### RabbitMQ Secrets Configuration

Edit `secrets/rabbitmq-secrets.yaml`:

```yaml
stringData:
  password: "GenerateRabbitPassword789!"
  erlang-cookie: "GenerateRandomCookie123456789"  # Must be same for all nodes
```

### 3. Configure Domain Names

Update ingress configurations in `ingress/jasmin-ingress.yaml`:

```yaml
spec:
  tls:
  - hosts:
    - sms-api.your-domain.com  # Change to your domain
  rules:
  - host: sms-api.your-domain.com  # Change to your domain
```

### 4. Configure Resource Limits (Optional)

Adjust resource requests/limits in deployment files based on your expected load:

```yaml
resources:
  requests:
    memory: "1Gi"
    cpu: "500m"
  limits:
    memory: "2Gi"
    cpu: "2000m"
```

## Deployment Steps

### 1. Run the Deployment Script

```bash
cd scripts
./deploy.sh
```

### 2. Manual Deployment (Alternative)

If you prefer manual deployment:

```bash
# Create namespace
kubectl apply -f ../namespace.yaml

# Apply configurations
kubectl apply -f ../configmaps/
kubectl apply -f ../secrets/

# Deploy infrastructure
kubectl apply -f ../deployments/redis.yaml
kubectl apply -f ../services/redis-service.yaml

kubectl apply -f ../deployments/rabbitmq.yaml
kubectl apply -f ../services/rabbitmq-service.yaml

# Wait for dependencies
kubectl wait --for=condition=ready pod -l app=rabbitmq -n messaging --timeout=600s
kubectl wait --for=condition=ready pod -l app=redis -n messaging --timeout=300s

# Deploy Jasmin
kubectl apply -f ../deployments/jasmin.yaml
kubectl apply -f ../services/jasmin-service.yaml

# Apply ingress and monitoring
kubectl apply -f ../ingress/
kubectl apply -f ../monitoring/
```

### 3. Verify Deployment

```bash
# Check pod status
kubectl get pods -n messaging

# Check services
kubectl get svc -n messaging

# Check ingress
kubectl get ingress -n messaging

# Check logs
kubectl logs -f deployment/jasmin-smsc -n messaging
```

## Post-Deployment Configuration

### 1. Initialize Jasmin Configuration

The initialization script runs automatically, but you can verify or reconfigure:

```bash
# Connect to Jasmin CLI
kubectl exec -it deployment/jasmin-smsc -n messaging -- telnet localhost 8990

# Login with admin credentials
Username: admin
Password: <from jasmin-secrets>

# List SMPP connectors
jcli> smppccm -l

# List routing rules
jcli> mtrouter -l
```

### 2. Configure 10DLC Campaigns (US Traffic)

For US messaging, configure 10DLC campaigns:

```bash
# Connect to Redis
kubectl exec -it deployment/redis -n messaging -- redis-cli

# Add 10DLC campaign
SET 10dlc:campaign:12345678901:user1 '{"campaign_id":"C123456","brand_id":"B123456","hourly_limit":1000,"daily_limit":10000,"content_filter":{"require_opt_out":true}}'
```

### 3. Configure HTTP API Access

Create HTTP API users:

```bash
# In Jasmin CLI
jcli> user -a
Adding a new User:
username user1
password StrongPassword123!
mt_messaging_cred quota http_send 1000
mt_messaging_cred quota smpps_send 1000
ok
```

### 4. Setup Basic Authentication for RabbitMQ

```bash
# Create htpasswd file
htpasswd -c auth admin

# Create secret
kubectl create secret generic rabbitmq-basic-auth --from-file=auth -n messaging

# Apply ingress (already included)
```

## Testing

### 1. Test SMPP Connection

```bash
# Check connector status
kubectl exec -it deployment/jasmin-smsc -n messaging -- bash -c "
echo 'smppccm -l' | timeout 10 telnet localhost 8990 | grep -A20 'Connector id'
"
```

### 2. Send Test SMS via HTTP API

```bash
# Port-forward for local testing
kubectl port-forward service/jasmin-http-service 8080:8080 -n messaging

# In another terminal
cd ../scripts
./test-sms.sh test +1234567890 "Test message from Jasmin"
```

### 3. Send Test SMS via SMPP

Use an SMPP client like SMPPSim or smppcli:

```bash
# Get external IP
kubectl get svc jasmin-smpp-service -n messaging

# Connect with SMPP client
smppcli --host <EXTERNAL_IP> --port 2775 --systemid testuser --password testpass
```

### 4. Check Message Flow

```bash
# Check RabbitMQ queues
kubectl exec -it rabbitmq-0 -n messaging -- rabbitmqctl list_queues -p jasmin

# Check Redis for message tracking
kubectl exec -it deployment/redis -n messaging -- redis-cli
> KEYS msg:tracking:*
```

## Monitoring

### 1. Access Grafana Dashboard

```bash
# If Grafana is deployed
kubectl port-forward service/grafana 3000:3000 -n monitoring

# Access at http://localhost:3000
# Import dashboard from monitoring/jasmin-dashboard.json
```

### 2. Check Prometheus Metrics

```bash
# Port-forward Prometheus
kubectl port-forward service/prometheus 9090:9090 -n monitoring

# Query metrics
# - jasmin_messages_sent_total
# - jasmin_smpp_connections_active
# - rabbitmq_queue_messages
```

### 3. Monitor Logs

```bash
# Jasmin logs
kubectl logs -f deployment/jasmin-smsc -n messaging

# RabbitMQ logs
kubectl logs -f statefulset/rabbitmq -n messaging

# Follow all pods
kubectl logs -f -l app=jasmin -n messaging --all-containers=true
```

## Troubleshooting

### Common Issues

#### 1. SMPP Connection Fails

```bash
# Check Sinch credentials
kubectl get secret sinch-credentials -n messaging -o yaml

# Check network connectivity
kubectl exec -it deployment/jasmin-smsc -n messaging -- nc -zv smpp.sinch.com 2775

# Check Jasmin logs for connection errors
kubectl logs deployment/jasmin-smsc -n messaging | grep -i error
```

#### 2. Messages Not Routing

```bash
# Check routing table
kubectl exec -it deployment/jasmin-smsc -n messaging -- bash -c "
echo -e 'admin\nYOUR_ADMIN_PASS\nmtrouter -l\nquit' | telnet localhost 8990
"

# Check RabbitMQ connectivity
kubectl exec -it deployment/jasmin-smsc -n messaging -- nc -zv rabbitmq-service 5672
```

#### 3. High Latency

```bash
# Check resource usage
kubectl top pods -n messaging

# Scale Jasmin if needed
kubectl scale deployment jasmin-smsc --replicas=3 -n messaging

# Check RabbitMQ queue depth
kubectl exec -it rabbitmq-0 -n messaging -- rabbitmqctl list_queues -p jasmin name messages
```

#### 4. Pod Crashes

```bash
# Check events
kubectl get events -n messaging --sort-by='.lastTimestamp'

# Describe pod
kubectl describe pod <pod-name> -n messaging

# Check previous logs
kubectl logs <pod-name> -n messaging --previous
```

### Debug Mode

Enable debug logging:

```bash
# Edit ConfigMap
kubectl edit configmap jasmin-config -n messaging

# Change log_level to DEBUG
log_level = DEBUG

# Restart pods
kubectl rollout restart deployment/jasmin-smsc -n messaging
```

## Maintenance

### Backup

```bash
# Backup Redis data
kubectl exec -it deployment/redis -n messaging -- redis-cli BGSAVE

# Backup RabbitMQ definitions
kubectl exec -it rabbitmq-0 -n messaging -- rabbitmqctl export_definitions /tmp/definitions.json
kubectl cp messaging/rabbitmq-0:/tmp/definitions.json ./rabbitmq-backup.json
```

### Updates

```bash
# Update Jasmin image
kubectl set image deployment/jasmin-smsc jasmin=jookies/jasmin:0.10.1 -n messaging

# Monitor rollout
kubectl rollout status deployment/jasmin-smsc -n messaging
```

### Scaling

```bash
# Scale Jasmin
kubectl scale deployment jasmin-smsc --replicas=3 -n messaging

# Scale RabbitMQ (requires care)
kubectl scale statefulset rabbitmq --replicas=5 -n messaging
```

### Monitoring Disk Usage

```bash
# Check PVC usage
kubectl exec -it rabbitmq-0 -n messaging -- df -h /var/lib/rabbitmq
kubectl exec -it deployment/redis -n messaging -- df -h /data
```

## Security Considerations

1. **Network Policies**: Implement network policies to restrict traffic
2. **RBAC**: Use proper RBAC for service accounts
3. **Secrets**: Rotate passwords regularly
4. **TLS**: Ensure all ingress uses HTTPS
5. **Firewall**: Whitelist only necessary IPs for SMPP

## Performance Tuning

1. **Jasmin**: Adjust submit_throughput based on Sinch limits
2. **RabbitMQ**: Tune vm_memory_high_watermark for your workload
3. **Redis**: Configure maxmemory policy appropriately
4. **Kubernetes**: Use appropriate resource requests/limits

## Support

For issues:
1. Check logs first
2. Verify configuration
3. Test connectivity
4. Review Sinch documentation
5. Contact support with detailed error logs