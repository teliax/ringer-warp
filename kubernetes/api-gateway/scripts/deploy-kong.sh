#!/bin/bash
# Deploy Kong API Gateway

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="kong"
TIMEOUT="300s"
KONG_DIR="$(dirname "$(dirname "$(readlink -f "$0")")")/kong"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check if resource exists
resource_exists() {
    kubectl get $1 $2 -n $3 &> /dev/null
}

# Function to wait for pod to be ready
wait_for_pod() {
    local label=$1
    local namespace=$2
    print_status "Waiting for pod with label $label to be ready..."
    kubectl wait --for=condition=ready pod -l $label -n $namespace --timeout=$TIMEOUT
}

# Main deployment function
deploy_kong() {
    print_status "Starting Kong deployment..."

    # Step 1: Create namespace and RBAC
    print_status "Creating namespace and RBAC..."
    kubectl apply -f ${KONG_DIR}/00-namespace.yaml
    
    # Step 2: Deploy PostgreSQL
    print_status "Deploying PostgreSQL..."
    kubectl apply -f ${KONG_DIR}/01-postgres.yaml
    
    # Wait for PostgreSQL to be ready
    wait_for_pod "app=postgres" $NAMESPACE
    
    # Step 3: Run database migrations
    print_status "Running Kong database migrations..."
    kubectl apply -f ${KONG_DIR}/02-kong-migrations.yaml
    
    # Wait for migration job to complete
    print_status "Waiting for migrations to complete..."
    kubectl wait --for=condition=complete job/kong-migrations -n $NAMESPACE --timeout=$TIMEOUT
    
    # Step 4: Deploy Kong
    print_status "Deploying Kong Gateway..."
    kubectl apply -f ${KONG_DIR}/03-kong-deployment.yaml
    kubectl apply -f ${KONG_DIR}/04-kong-services.yaml
    kubectl apply -f ${KONG_DIR}/05-kong-ingress.yaml
    
    # Wait for Kong to be ready
    wait_for_pod "app=kong-gateway" $NAMESPACE
    
    # Step 5: Apply plugins and configurations
    print_status "Applying Kong plugins and configurations..."
    kubectl apply -f ${KONG_DIR}/06-kong-plugins.yaml
    kubectl apply -f ${KONG_DIR}/07-warp-api-configuration.yaml
    
    # Step 6: Set up monitoring
    print_status "Setting up monitoring..."
    kubectl apply -f ${KONG_DIR}/08-monitoring.yaml
    
    # Verify deployment
    print_status "Verifying Kong deployment..."
    
    # Check if Kong Admin API is accessible
    KONG_ADMIN_POD=$(kubectl get pod -l app=kong-gateway -n $NAMESPACE -o jsonpath='{.items[0].metadata.name}')
    kubectl exec -n $NAMESPACE $KONG_ADMIN_POD -- curl -s http://localhost:8001/status > /dev/null
    
    if [ $? -eq 0 ]; then
        print_status "Kong Admin API is accessible"
    else
        print_error "Kong Admin API is not accessible"
        exit 1
    fi
    
    # Get LoadBalancer IP
    print_status "Getting Kong proxy service details..."
    kubectl get svc kong-proxy -n $NAMESPACE
    
    print_status "Kong deployment completed successfully!"
    
    # Print next steps
    echo ""
    print_status "Next steps:"
    echo "1. Configure DNS to point to Kong LoadBalancer IP"
    echo "2. Import OpenAPI specification"
    echo "3. Create API consumers and credentials"
    echo "4. Test API endpoints through Kong"
    echo ""
    
    # Print useful commands
    print_status "Useful commands:"
    echo "- Check Kong status: kubectl exec -it deploy/kong-gateway -n kong -- curl http://localhost:8001/status"
    echo "- View routes: kubectl exec -it deploy/kong-gateway -n kong -- curl http://localhost:8001/routes"
    echo "- View services: kubectl exec -it deploy/kong-gateway -n kong -- curl http://localhost:8001/services"
    echo "- View plugins: kubectl exec -it deploy/kong-gateway -n kong -- curl http://localhost:8001/plugins"
    echo "- Kong logs: kubectl logs -f deploy/kong-gateway -n kong"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed"
        exit 1
    fi
    
    # Check if connected to cluster
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Not connected to Kubernetes cluster"
        exit 1
    fi
    
    # Check if cert-manager is installed
    if ! kubectl get deployment -n cert-manager cert-manager &> /dev/null; then
        print_warning "cert-manager not found. TLS certificates may not work properly"
    fi
    
    print_status "Prerequisites check passed"
}

# Main execution
main() {
    echo "================================================"
    echo "Kong API Gateway Deployment Script"
    echo "================================================"
    echo ""
    
    check_prerequisites
    
    # Check if Kong is already deployed
    if resource_exists "namespace" $NAMESPACE ""; then
        print_warning "Kong namespace already exists"
        read -p "Do you want to continue with the deployment? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Deployment cancelled"
            exit 0
        fi
    fi
    
    # Deploy Kong
    deploy_kong
}

# Run main function
main