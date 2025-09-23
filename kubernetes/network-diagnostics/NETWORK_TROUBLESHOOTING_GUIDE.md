# GKE Network Troubleshooting Guide

## Overview
This guide covers common network issues in GKE clusters, specifically focusing on:
- Cloud SQL connectivity from GKE pods
- LoadBalancer service IP allocation issues
- VPC peering and firewall rules

## Architecture Overview
- **GKE Cluster**: `warp-kamailio-cluster` in project `ringer-warp-v01`
- **VPC**: `warp-vpc`
- **Pod CIDR**: `10.1.0.0/16`
- **Service CIDR**: `10.2.0.0/16`
- **Node Subnet**: `warp-gke-subnet` (`10.0.0.0/24`)
- **Cloud SQL Private IP**: `10.126.0.3`

## Issue 1: Cloud SQL Connectivity

### Symptoms
- Pods cannot connect to Cloud SQL instance
- Database connection timeouts
- CrashLoopBackOff due to DB connection failures

### Verification Steps

1. **Test basic connectivity from a pod:**
```bash
kubectl run test-connectivity --image=busybox --restart=Never --rm -i \
  --command -- timeout 5 nc -zv 10.126.0.3 5432
```

2. **Check VPC peering status:**
```bash
gcloud compute networks peerings list --network=warp-vpc --project=ringer-warp-v01
```
Look for `servicenetworking-googleapis-com` peering in ACTIVE state.

3. **Verify firewall rules:**
```bash
gcloud compute firewall-rules list --filter="network:warp-vpc" \
  --project=ringer-warp-v01 --format="table(name,sourceRanges,allowed[].ports)"
```

### Resolution Steps

If connectivity fails:

1. **Ensure VPC peering is configured:**
```bash
# Check if private service connection exists
gcloud services vpc-peerings list --service=servicenetworking.googleapis.com \
  --network=warp-vpc --project=ringer-warp-v01
```

2. **Create firewall rule if missing:**
```bash
gcloud compute firewall-rules create allow-gke-to-cloudsql \
  --network=warp-vpc \
  --allow=tcp:5432 \
  --source-ranges=10.1.0.0/16 \
  --description="Allow GKE pods to access Cloud SQL" \
  --project=ringer-warp-v01
```

3. **Verify Cloud SQL has private IP:**
```bash
gcloud sql instances describe warp-db --project=ringer-warp-v01 \
  --format="value(ipAddresses[].ipAddress,ipAddresses[].type)"
```

## Issue 2: LoadBalancer Services Stuck in Pending

### Symptoms
- LoadBalancer services show `<pending>` for external IP
- Services never get external IPs assigned
- "Ensuring load balancer" events repeat indefinitely

### Verification Steps

1. **Check service status:**
```bash
kubectl get svc -A | grep LoadBalancer
```

2. **Check service events:**
```bash
kubectl describe svc <service-name> -n <namespace> | grep -A 20 "Events:"
```

3. **Verify GCP quotas:**
```bash
gcloud compute project-info describe --project=ringer-warp-v01 \
  | grep -E "(IN_USE_ADDRESSES|FORWARDING_RULES)"
```

### Resolution Steps

1. **Recreate stuck services:**
```bash
# Run the fix script
./fix-loadbalancer.sh
```

2. **Manual service recreation:**
```bash
# Backup service
kubectl get svc kamailio-sip -n ringer-warp-v01 -o yaml > kamailio-sip-backup.yaml

# Delete service
kubectl delete svc kamailio-sip -n ringer-warp-v01

# Wait 10 seconds
sleep 10

# Recreate service
kubectl apply -f kamailio-sip-backup.yaml
```

3. **Check firewall rules for health checks:**
```bash
# GKE needs these source ranges for health checks
# 130.211.0.0/22, 35.191.0.0/16

gcloud compute firewall-rules create gke-allow-health-checks \
  --network=warp-vpc \
  --allow=tcp \
  --source-ranges=130.211.0.0/22,35.191.0.0/16 \
  --target-tags=gke-warp-kamailio-cluster-de471df2-node \
  --project=ringer-warp-v01
```

## Issue 3: Pod-to-Pod Communication

### Verification Steps

1. **Test pod-to-pod connectivity:**
```bash
# Create two test pods
kubectl run test-pod-1 --image=nicolaka/netshoot -- sleep 3600
kubectl run test-pod-2 --image=nicolaka/netshoot -- sleep 3600

# Get pod IPs
kubectl get pods -o wide | grep test-pod

# Test connectivity
kubectl exec test-pod-1 -- ping -c 3 <test-pod-2-ip>
```

2. **Check network policies:**
```bash
kubectl get networkpolicies -A
```

### Resolution Steps

If pod-to-pod communication fails:

1. **Ensure no restrictive network policies:**
```bash
kubectl delete networkpolicies --all -A
```

2. **Check kube-proxy:**
```bash
kubectl get pods -n kube-system | grep kube-proxy
kubectl logs -n kube-system -l k8s-app=kube-proxy --tail=50
```

## Common Commands Reference

### Network Diagnostics
```bash
# Run comprehensive network check
./check-network-connectivity.sh

# Test specific service connectivity
kubectl run test-service --image=busybox --restart=Never --rm -i \
  --command -- wget -qO- http://<service-name>.<namespace>.svc.cluster.local:<port>

# DNS debugging
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup kubernetes.default
```

### GKE Cluster Operations
```bash
# Get cluster credentials
gcloud container clusters get-credentials warp-kamailio-cluster \
  --zone us-central1 --project ringer-warp-v01

# Check cluster networking config
gcloud container clusters describe warp-kamailio-cluster \
  --zone us-central1 --project ringer-warp-v01 \
  --format="value(networkConfig,ipAllocationPolicy)"
```

### Firewall Rules
```bash
# List all firewall rules
gcloud compute firewall-rules list --filter="network:warp-vpc" \
  --project=ringer-warp-v01

# Create allow rule for specific port
gcloud compute firewall-rules create <rule-name> \
  --network=warp-vpc \
  --allow=tcp:<port>,udp:<port> \
  --source-ranges=<source-cidr> \
  --target-tags=<target-tags> \
  --project=ringer-warp-v01
```

## Prevention Best Practices

1. **Always specify resource requests/limits** in pod specs to ensure proper scheduling
2. **Use readiness and liveness probes** to detect connectivity issues early
3. **Monitor LoadBalancer quota usage** in GCP
4. **Implement proper health checks** for services
5. **Use internal LoadBalancers** when external access isn't needed
6. **Document all custom firewall rules** and their purposes

## Additional Resources

- [GKE Networking Overview](https://cloud.google.com/kubernetes-engine/docs/concepts/network-overview)
- [Troubleshooting GKE](https://cloud.google.com/kubernetes-engine/docs/troubleshooting)
- [Cloud SQL Private IP](https://cloud.google.com/sql/docs/mysql/private-ip)
- [GKE LoadBalancer Services](https://cloud.google.com/kubernetes-engine/docs/concepts/service-load-balancer)