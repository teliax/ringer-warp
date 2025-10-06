#!/bin/bash
# Deploy Jasmin SMSC to Kubernetes

set -e

NAMESPACE="messaging"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Jasmin SMSC Deployment Script ==="
echo "Base directory: $BASE_DIR"
echo

# Function to check if resource exists
resource_exists() {
    kubectl get "$1" "$2" -n "$NAMESPACE" &> /dev/null
}

# Function to wait for deployment
wait_for_deployment() {
    local deployment=$1
    local timeout=${2:-300}
    echo "Waiting for deployment $deployment to be ready..."
    kubectl wait --for=condition=available --timeout="${timeout}s" deployment/"$deployment" -n "$NAMESPACE"
}

# Function to wait for statefulset
wait_for_statefulset() {
    local statefulset=$1
    local timeout=${2:-300}
    echo "Waiting for statefulset $statefulset to be ready..."
    kubectl rollout status statefulset/"$statefulset" -n "$NAMESPACE" --timeout="${timeout}s"
}

# Step 1: Check prerequisites
echo "Step 1: Checking prerequisites..."

if ! kubectl cluster-info &> /dev/null; then
    echo "ERROR: kubectl is not configured or cluster is not accessible"
    exit 1
fi

# Check if secrets exist
echo "Checking for required secrets..."
for secret in jasmin-credentials sinch-credentials rabbitmq-credentials; do
    if ! resource_exists secret "$secret"; then
        echo "WARNING: Secret $secret does not exist!"
        echo "Please create it from the template: $BASE_DIR/secrets/${secret}.yaml.template"
    fi
done

# Step 2: Create namespace
echo -e "\nStep 2: Creating namespace..."
if ! resource_exists namespace "$NAMESPACE"; then
    kubectl apply -f "$BASE_DIR/namespace.yaml"
    echo "Namespace $NAMESPACE created"
else
    echo "Namespace $NAMESPACE already exists"
fi

# Step 3: Apply ConfigMaps
echo -e "\nStep 3: Applying ConfigMaps..."
kubectl apply -f "$BASE_DIR/configmaps/"

# Step 4: Apply Secrets (if they exist)
echo -e "\nStep 4: Applying Secrets..."
if [ -f "$BASE_DIR/secrets/jasmin-secrets.yaml" ]; then
    kubectl apply -f "$BASE_DIR/secrets/"
else
    echo "WARNING: No secrets found. Please configure them before proceeding!"
    echo "Copy templates from $BASE_DIR/secrets/*.template and edit them"
    read -p "Continue without secrets? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 5: Deploy Redis
echo -e "\nStep 5: Deploying Redis..."
kubectl apply -f "$BASE_DIR/deployments/redis.yaml"
kubectl apply -f "$BASE_DIR/services/redis-service.yaml"
wait_for_deployment "redis" 300

# Step 6: Deploy RabbitMQ
echo -e "\nStep 6: Deploying RabbitMQ..."
kubectl apply -f "$BASE_DIR/deployments/rabbitmq.yaml"
kubectl apply -f "$BASE_DIR/services/rabbitmq-service.yaml"
wait_for_statefulset "rabbitmq" 600

# Step 7: Deploy Jasmin SMSC
echo -e "\nStep 7: Deploying Jasmin SMSC..."
kubectl apply -f "$BASE_DIR/deployments/jasmin.yaml"
kubectl apply -f "$BASE_DIR/services/jasmin-service.yaml"
wait_for_deployment "jasmin-smsc" 300

# Step 8: Apply Ingress
echo -e "\nStep 8: Applying Ingress rules..."
kubectl apply -f "$BASE_DIR/ingress/"

# Step 9: Apply monitoring
echo -e "\nStep 9: Applying monitoring configuration..."
kubectl apply -f "$BASE_DIR/monitoring/"

# Step 10: Show status
echo -e "\n=== Deployment Status ==="
kubectl get pods -n "$NAMESPACE"
echo
kubectl get services -n "$NAMESPACE"
echo
kubectl get ingress -n "$NAMESPACE"

# Show next steps
echo -e "\n=== Next Steps ==="
echo "1. Configure Sinch SMPP connection:"
echo "   kubectl exec -it deployment/jasmin-smsc -n $NAMESPACE -- telnet localhost 8990"
echo
echo "2. Check SMPP connector status:"
echo "   kubectl exec -it deployment/jasmin-smsc -n $NAMESPACE -- jasmin-cli smppccm -l"
echo
echo "3. Access HTTP API (after ingress is ready):"
echo "   https://sms-api.warp-platform.com/"
echo
echo "4. Access RabbitMQ Management (create auth first):"
echo "   https://rabbitmq.warp-platform.com/"
echo
echo "5. Monitor logs:"
echo "   kubectl logs -f deployment/jasmin-smsc -n $NAMESPACE"
echo
echo "Deployment complete!"