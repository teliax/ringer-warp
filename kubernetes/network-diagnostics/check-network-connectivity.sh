#!/bin/bash
# Network connectivity checker for GKE to Cloud SQL

echo "=== GKE Network Connectivity Diagnostics ==="
echo "Date: $(date)"
echo ""

# Check cluster info
echo "1. Cluster Information:"
kubectl cluster-info
echo ""

# Check node status
echo "2. Node Status:"
kubectl get nodes -o wide
echo ""

# Check Cloud SQL connectivity
echo "3. Testing Cloud SQL Connectivity (10.126.0.3:5432):"
kubectl run test-cloudsql-connectivity \
  --image=busybox \
  --restart=Never \
  --rm -i \
  --command -- sh -c "
    echo 'Testing TCP connection to Cloud SQL...'
    timeout 5 nc -zv 10.126.0.3 5432 && echo 'SUCCESS: Can reach Cloud SQL' || echo 'FAILED: Cannot reach Cloud SQL'
  "
echo ""

# Check DNS resolution
echo "4. Testing DNS Resolution:"
kubectl run test-dns \
  --image=busybox \
  --restart=Never \
  --rm -i \
  --command -- sh -c "
    echo 'Testing DNS resolution...'
    nslookup kubernetes.default
    nslookup google.com
  "
echo ""

# Check LoadBalancer services
echo "5. LoadBalancer Services Status:"
kubectl get svc -A | grep LoadBalancer
echo ""

# Check endpoints
echo "6. Service Endpoints:"
kubectl get endpoints -A | grep -E "(kamailio|NAME)"
echo ""

# Check network policies
echo "7. Network Policies:"
kubectl get networkpolicies -A
echo ""

# Check pod networking
echo "8. Pod Network Test:"
kubectl run test-pod-network \
  --image=nicolaka/netshoot \
  --restart=Never \
  --rm -i \
  --command -- sh -c "
    echo 'Pod IP: '
    ip addr show
    echo ''
    echo 'Default route:'
    ip route
    echo ''
    echo 'Testing outbound connectivity:'
    curl -s -o /dev/null -w '%{http_code}' https://www.google.com && echo ' - Internet: OK' || echo ' - Internet: FAILED'
  "