#!/bin/bash
# Migrate from nginx to Kong API Gateway

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NGINX_NAMESPACE="warp-api"
KONG_NAMESPACE="kong"
NGINX_INGRESS="warp-api-ingress-tls"
CANARY_PERCENTAGES=(10 25 50 75 100)
WAIT_BETWEEN_STAGES=300  # 5 minutes between stages

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

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Function to check metrics
check_metrics() {
    print_status "Checking system metrics..."
    
    # Check Kong error rate
    ERROR_RATE=$(kubectl exec -n $KONG_NAMESPACE deploy/kong-gateway -- \
        curl -s http://localhost:8001/metrics | \
        grep kong_http_requests_total | \
        grep 'code="5' || echo "0")
    
    # Check response times
    RESPONSE_TIME=$(kubectl exec -n $KONG_NAMESPACE deploy/kong-gateway -- \
        curl -s http://localhost:8001/status | \
        jq -r '.server.total_requests // 0')
    
    print_status "Current metrics:"
    echo "  - Error rate: Check Grafana dashboard"
    echo "  - Total requests: $RESPONSE_TIME"
}

# Function to update canary weight
update_canary_weight() {
    local weight=$1
    print_status "Updating canary weight to ${weight}%..."
    
    # Create canary ingress for Kong
    cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: kong-canary-ingress
  namespace: $KONG_NAMESPACE
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "${weight}"
    nginx.ingress.kubernetes.io/rewrite-target: /\$1
spec:
  rules:
  - host: api.ringer.tel
    http:
      paths:
      - path: /v1/(.*)
        pathType: Prefix
        backend:
          service:
            name: kong-proxy
            port:
              number: 80
  - host: api-v2.ringer.tel
    http:
      paths:
      - path: /v1/(.*)
        pathType: Prefix
        backend:
          service:
            name: kong-proxy
            port:
              number: 80
EOF
}

# Function to test endpoints
test_endpoints() {
    print_status "Testing API endpoints through Kong..."
    
    local kong_ip=$(kubectl get svc -n $KONG_NAMESPACE kong-proxy -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    
    if [ -z "$kong_ip" ]; then
        print_warning "Kong LoadBalancer IP not yet assigned"
        return 1
    fi
    
    # Test health endpoint
    curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 \
        -H "Host: api.ringer.tel" \
        http://${kong_ip}/v1/health
    
    if [ $? -eq 0 ]; then
        print_status "Health endpoint test passed"
        return 0
    else
        print_error "Health endpoint test failed"
        return 1
    fi
}

# Function to rollback
rollback() {
    print_error "Rolling back migration..."
    
    # Remove canary ingress
    kubectl delete ingress kong-canary-ingress -n $KONG_NAMESPACE --ignore-not-found
    
    # Ensure all traffic goes to nginx
    kubectl annotate ingress $NGINX_INGRESS -n $NGINX_NAMESPACE \
        nginx.ingress.kubernetes.io/canary- \
        nginx.ingress.kubernetes.io/canary-weight-
    
    print_status "Rollback completed"
}

# Function to perform gradual migration
gradual_migration() {
    print_step "Starting gradual traffic migration..."
    
    for percentage in "${CANARY_PERCENTAGES[@]}"; do
        print_step "Migrating ${percentage}% of traffic to Kong..."
        
        update_canary_weight $percentage
        
        if [ $percentage -lt 100 ]; then
            print_status "Waiting ${WAIT_BETWEEN_STAGES} seconds before next stage..."
            
            # Monitor for the wait period
            for i in $(seq 1 $WAIT_BETWEEN_STAGES); do
                if [ $((i % 60)) -eq 0 ]; then
                    print_status "Elapsed: $i seconds..."
                    check_metrics
                fi
                sleep 1
            done
        fi
        
        # Test after each stage
        if ! test_endpoints; then
            print_error "Endpoint test failed at ${percentage}% migration"
            read -p "Continue anyway? (y/n) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                rollback
                exit 1
            fi
        fi
        
        print_status "Successfully migrated ${percentage}% of traffic"
    done
}

# Function to complete migration
complete_migration() {
    print_step "Completing migration..."
    
    # Update main ingress to use Kong
    kubectl patch ingress $NGINX_INGRESS -n $NGINX_NAMESPACE --type='json' -p='[
        {
            "op": "replace",
            "path": "/spec/rules/0/http/paths/0/backend/service/name",
            "value": "kong-proxy"
        },
        {
            "op": "replace",
            "path": "/spec/rules/0/http/paths/0/backend/service/port/number",
            "value": 80
        }
    ]'
    
    # Remove canary ingress
    kubectl delete ingress kong-canary-ingress -n $KONG_NAMESPACE --ignore-not-found
    
    print_status "Migration completed successfully!"
}

# Main function
main() {
    echo "================================================"
    echo "nginx to Kong Migration Script"
    echo "================================================"
    echo ""
    
    print_warning "This script will gradually migrate traffic from nginx to Kong"
    print_warning "Ensure Kong is fully deployed and tested before proceeding"
    echo ""
    
    # Check if Kong is deployed
    if ! kubectl get deploy kong-gateway -n $KONG_NAMESPACE &> /dev/null; then
        print_error "Kong is not deployed. Run deploy-kong.sh first"
        exit 1
    fi
    
    # Check if nginx ingress exists
    if ! kubectl get ingress $NGINX_INGRESS -n $NGINX_NAMESPACE &> /dev/null; then
        print_error "nginx ingress not found: $NGINX_INGRESS"
        exit 1
    fi
    
    # Confirm migration
    echo "Migration stages:"
    for percentage in "${CANARY_PERCENTAGES[@]}"; do
        echo "  - ${percentage}% traffic to Kong"
    done
    echo ""
    
    read -p "Start migration? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Migration cancelled"
        exit 0
    fi
    
    # Create backup of current ingress
    print_status "Creating backup of current ingress configuration..."
    kubectl get ingress $NGINX_INGRESS -n $NGINX_NAMESPACE -o yaml > nginx-ingress-backup-$(date +%Y%m%d-%H%M%S).yaml
    
    # Start migration
    gradual_migration
    
    # Final confirmation
    print_step "Final step: Complete migration"
    print_warning "This will route 100% of traffic through Kong permanently"
    read -p "Complete migration? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        complete_migration
    else
        print_warning "Migration stopped at canary stage. Traffic is split between nginx and Kong"
    fi
    
    # Print summary
    echo ""
    print_status "Migration Summary:"
    echo "- Traffic is now routed through Kong API Gateway"
    echo "- Monitor dashboards: https://grafana.ringer.tel/d/kong-gateway"
    echo "- Kong Admin API: https://api-admin.ringer.tel"
    echo "- Original nginx configuration backed up"
    echo ""
    print_status "Next steps:"
    echo "1. Monitor error rates and performance for 24-48 hours"
    echo "2. Update DNS records to point directly to Kong LoadBalancer"
    echo "3. Decommission nginx ingress rules"
}

# Trap errors
trap rollback ERR

# Run main function
main