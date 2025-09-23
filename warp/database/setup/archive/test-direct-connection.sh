#!/bin/bash

# Test direct connection to Cloud SQL using private IP
# This script helps diagnose connectivity issues

set -e

# Configuration
NAMESPACE="warp-core"
DB_HOST="10.126.0.3"
DB_PORT="5432"
DB_NAME="warp"
DB_USER="warp"
DB_PASSWORD=')T]!sXUi>SE+DeWt6a8Wmy*Q)A4q6R:}'

echo "Testing Cloud SQL connectivity..."
echo "================================"
echo "Database: $DB_HOST:$DB_PORT/$DB_NAME"
echo "User: $DB_USER"
echo ""

# Test 1: Basic network connectivity from a node
echo "Test 1: Network connectivity from GKE node"
kubectl run test-network --rm -it \
  --image=busybox \
  --namespace=$NAMESPACE \
  --overrides='{"spec":{"hostNetwork":true}}' \
  --command -- /bin/sh -c "
    echo 'Testing TCP connection to $DB_HOST:$DB_PORT...'
    if nc -zv $DB_HOST $DB_PORT; then
      echo '✓ Network connectivity successful'
    else
      echo '✗ Network connectivity failed'
      echo 'This indicates a network/firewall issue between GKE and Cloud SQL'
    fi
  " || true

echo ""

# Test 2: PostgreSQL client connection
echo "Test 2: PostgreSQL client connection"
kubectl run test-psql --rm -it \
  --namespace=$NAMESPACE \
  --image=postgres:15-alpine \
  --env="PGHOST=$DB_HOST" \
  --env="PGPORT=$DB_PORT" \
  --env="PGDATABASE=$DB_NAME" \
  --env="PGUSER=$DB_USER" \
  --env="PGPASSWORD=$DB_PASSWORD" \
  --command -- psql -c "
    SELECT version();
    SELECT current_database(), current_user, inet_server_addr(), inet_server_port();
  " || {
    echo "✗ PostgreSQL connection failed"
    echo ""
    echo "Possible causes:"
    echo "1. VPC peering not configured between GKE and Cloud SQL"
    echo "2. Cloud SQL instance doesn't have private IP enabled"
    echo "3. Firewall rules blocking PostgreSQL port 5432"
    echo "4. Wrong credentials or database doesn't exist"
    echo ""
    echo "Debugging steps:"
    echo "1. Check VPC peering:"
    echo "   gcloud compute networks peerings list --network=YOUR_VPC_NAME"
    echo ""
    echo "2. Check Cloud SQL private IP:"
    echo "   gcloud sql instances describe warp-dev-db --format='get(ipAddresses[0].ipAddress)'"
    echo ""
    echo "3. Check firewall rules:"
    echo "   gcloud compute firewall-rules list --filter='sourceRanges:10.0.0.0/8'"
  }

echo ""

# Test 3: Create a debug pod for manual testing
echo "Test 3: Creating debug pod for manual testing"
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: debug-db-connection
  namespace: $NAMESPACE
spec:
  containers:
  - name: postgres-client
    image: postgres:15-alpine
    command: ['sh', '-c', 'echo "Debug pod ready. Use: kubectl exec -it -n $NAMESPACE debug-db-connection -- psql" && sleep 3600']
    env:
    - name: PGHOST
      value: "$DB_HOST"
    - name: PGPORT
      value: "$DB_PORT"
    - name: PGDATABASE
      value: "$DB_NAME"
    - name: PGUSER
      value: "$DB_USER"
    - name: PGPASSWORD
      value: "$DB_PASSWORD"
EOF

echo ""
echo "Debug pod created. To connect manually:"
echo "  kubectl exec -it -n $NAMESPACE debug-db-connection -- psql"
echo ""
echo "To check pod logs:"
echo "  kubectl logs -n $NAMESPACE debug-db-connection"
echo ""
echo "To delete debug pod:"
echo "  kubectl delete pod -n $NAMESPACE debug-db-connection"
echo ""

# Test 4: Check GKE cluster network configuration
echo "Test 4: Checking GKE cluster network configuration"
echo "Getting cluster details..."
CLUSTER_INFO=$(kubectl get nodes -o json | jq -r '.items[0].spec.providerID' | cut -d'/' -f5)
echo "Cluster region/zone: $CLUSTER_INFO"

# Summary
echo ""
echo "================================"
echo "Connectivity Test Summary"
echo "================================"
echo ""
echo "If all tests pass, the issue is likely with the application configuration."
echo "If tests fail, check:"
echo "1. VPC peering between GKE and Cloud SQL networks"
echo "2. Private Service Connect configuration"
echo "3. Firewall rules allowing traffic on port 5432"
echo "4. Cloud SQL instance has private IP enabled"
echo "5. GKE nodes can reach the Cloud SQL private IP range"