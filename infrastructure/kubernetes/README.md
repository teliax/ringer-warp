# WARP Kubernetes Deployments

This directory contains Kubernetes manifests for deploying the WARP telecom services.

## Architecture

### Telecom Namespace
- **Kamailio**: SIP proxy with LuaJIT FFI for high-performance routing
- **RTPEngine**: Media relay (deployed via Terraform on GCE instances)
- **Redis**: State management and caching
- **Consul**: Service discovery

### Messaging Namespace
- **Jasmin SMSC**: SMS/MMS gateway with SMPP interface
- **RabbitMQ**: Message queuing for Jasmin
- **Redis**: SMS routing cache

## Directory Structure

```
kubernetes/
├── base/                    # Base configurations
│   ├── common/             # Shared configs
│   ├── kamailio/          # Kamailio SIP proxy
│   └── jasmin/            # Jasmin SMSC
├── overlays/              # Environment-specific configs
│   └── dev/              # Development environment
│       ├── patches/      # Kustomize patches
│       └── secrets/      # Secret files (git-ignored)
└── deploy.sh             # Deployment script
```

## Prerequisites

1. GKE cluster deployed (via Terraform)
2. kubectl configured
3. Required secrets configured

## Configuration

### 1. Configure Secrets

Copy example files and fill with actual values:

```bash
cd overlays/dev/secrets
cp postgres.env.example postgres.env
cp jasmin.env.example jasmin.env
cp sinch.env.example sinch.env
cp rabbitmq.env.example rabbitmq.env
```

### 2. Required Secret Values

**postgres.env**:
- Database credentials from Terraform output

**jasmin.env**:
- Admin password for Jasmin management

**sinch.env**:
- SMPP credentials from Sinch (IP-based auth)
- Host: smpp1.sinch.com
- Port: 2775

**rabbitmq.env**:
- RabbitMQ password and Erlang cookie

## Deployment

Run the deployment script:

```bash
./deploy.sh
```

The script will:
1. Check prerequisites
2. Configure kubectl
3. Verify secrets
4. Deploy all services
5. Wait for readiness
6. Display service endpoints

## Service Endpoints

After deployment, you'll receive:

- **Kamailio SIP**: LoadBalancer IP on ports 5060 (UDP/TCP) and 5061 (TLS)
- **Jasmin SMPP**: LoadBalancer IP on ports 2775 (TCP) and 2776 (TLS)

## Kamailio Features

- **LuaJIT FFI Integration**: High-performance routing logic
- **Redis Backend**: Caching for route lookups
- **HEP/Homer Support**: SIP tracing and monitoring
- **Prometheus Metrics**: Available on port 8080/metrics
- **Multi-Protocol**: UDP, TCP, and TLS support
- **Rate Limiting**: Built-in rate limiting via Lua

## Jasmin SMSC Features

- **SMPP Interface**: For customer connections (port 2775)
- **HTTP API**: REST interface (port 8080)
- **Sinch Integration**: Upstream SMPP connection
- **RabbitMQ**: Reliable message queuing
- **10DLC Compliance**: Built-in campaign validation
- **Interceptors**: Python-based message processing

## Consul Service Discovery

Services are automatically registered with Consul:
- `kamailio.service.consul`: SIP proxy endpoints
- `jasmin.service.consul`: SMS gateway endpoints

## Monitoring

### Prometheus Endpoints
- Kamailio: `http://kamailio-metrics:8080/metrics`
- Jasmin: `http://jasmin-metrics:9100/metrics`

### Health Checks
- Kamailio: `kamctl ping`
- Jasmin: `http://jasmin-api:8080/ping`

## Management

### Access Jasmin CLI
```bash
kubectl exec -it deployment/jasmin-smsc -n messaging -- telnet localhost 8990
```

### View Logs
```bash
# Kamailio logs
kubectl logs -n telecom deployment/kamailio -f

# Jasmin logs
kubectl logs -n messaging deployment/jasmin-smsc -f
```

### Scale Services
```bash
# Scale Kamailio
kubectl scale deployment/kamailio -n telecom --replicas=5

# Scale Jasmin
kubectl scale deployment/jasmin-smsc -n messaging --replicas=3
```

## Troubleshooting

### Check Pod Status
```bash
kubectl get pods -n telecom
kubectl get pods -n messaging
```

### Describe Failed Pods
```bash
kubectl describe pod <pod-name> -n <namespace>
```

### Check Service Endpoints
```bash
kubectl get svc -n telecom
kubectl get svc -n messaging
```

### View Recent Events
```bash
kubectl get events -n telecom --sort-by='.lastTimestamp'
kubectl get events -n messaging --sort-by='.lastTimestamp'
```

## Security Considerations

1. **Secrets Management**: All sensitive data in Kubernetes secrets
2. **Network Policies**: Implement for production
3. **TLS Support**: Available on dedicated ports
4. **IP Whitelisting**: Configure in LoadBalancer firewall rules
5. **RBAC**: Implement proper Kubernetes RBAC for production

## Next Steps

1. Configure DNS records with LoadBalancer IPs
2. Set up monitoring dashboards
3. Configure backup strategies
4. Implement network policies
5. Set up CI/CD pipelines