#!/bin/bash

# Setup External DNS in Kubernetes with Gandi provider
# Usage: ./setup-external-dns.sh

set -euo pipefail

# Source configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/gandi-dns-lib.sh"

# Kubernetes namespace
NAMESPACE="external-dns"

print_header() { echo -e "\033[0;34m=== $1 ===\033[0m"; }

# Check kubectl connectivity
check_kubernetes() {
    if ! kubectl cluster-info >/dev/null 2>&1; then
        print_error "Cannot connect to Kubernetes cluster"
        print_error "Please ensure kubectl is configured correctly"
        exit 1
    fi
    
    local context
    context=$(kubectl config current-context)
    print_info "Using Kubernetes context: $context"
}

# Create secret from Google Secret Manager
create_gandi_secret() {
    print_header "Creating Gandi API Secret in Kubernetes"
    
    # Get API key from Secret Manager
    local api_key
    api_key=$(get_gandi_api_key)
    
    if [ $? -ne 0 ]; then
        print_error "Failed to retrieve Gandi API key"
        print_info "Please run: ./setup-gandi-secret.sh <your-api-key>"
        return 1
    fi
    
    # Create namespace if it doesn't exist
    if ! kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
        print_info "Creating namespace: $NAMESPACE"
        kubectl create namespace "$NAMESPACE"
    fi
    
    # Delete existing secret if it exists
    if kubectl get secret gandi-api-credentials -n "$NAMESPACE" >/dev/null 2>&1; then
        print_warn "Deleting existing secret"
        kubectl delete secret gandi-api-credentials -n "$NAMESPACE"
    fi
    
    # Create new secret
    print_info "Creating Kubernetes secret: gandi-api-credentials"
    kubectl create secret generic gandi-api-credentials \
        --from-literal=api-key="$api_key" \
        --namespace="$NAMESPACE"
    
    print_success "Secret created successfully"
}

# Deploy External DNS
deploy_external_dns() {
    print_header "Deploying External DNS"
    
    local manifest_path="${SCRIPT_DIR}/../../kubernetes/dns/external-dns-gandi.yaml"
    
    if [ ! -f "$manifest_path" ]; then
        print_error "External DNS manifest not found at: $manifest_path"
        return 1
    fi
    
    # Apply the manifest
    print_info "Applying External DNS manifest..."
    kubectl apply -f "$manifest_path"
    
    # Wait for deployment to be ready
    print_info "Waiting for External DNS deployment to be ready..."
    kubectl rollout status deployment/external-dns -n "$NAMESPACE" --timeout=60s
    
    print_success "External DNS deployed successfully"
}

# Update existing services with DNS annotations
update_service_annotations() {
    print_header "Updating Service Annotations"
    
    local updated=0
    
    # Check each service and update if it exists
    for service in "${!SERVICE_IPS[@]}"; do
        local subdomain="${SUBDOMAINS[$service]}"
        local namespace
        
        # Determine namespace based on service
        case $service in
            kamailio)
                namespace="voip"
                ;;
            api)
                namespace="api"
                ;;
            prometheus|grafana|homer)
                namespace="monitoring"
                ;;
            *)
                namespace="default"
                ;;
        esac
        
        # Check if service exists
        if kubectl get service -n "$namespace" 2>/dev/null | grep -q LoadBalancer; then
            print_info "Found LoadBalancer service in namespace: $namespace"
            
            # Get service name
            local svc_name
            svc_name=$(kubectl get service -n "$namespace" -o json | \
                jq -r '.items[] | select(.status.loadBalancer.ingress[0].ip == "'${SERVICE_IPS[$service]}'") | .metadata.name' 2>/dev/null || true)
            
            if [ -n "$svc_name" ]; then
                print_info "Updating service: $svc_name with DNS hostname: ${subdomain}.${DOMAIN_PROD}"
                
                # Determine TTL
                local ttl=$TTL_STABLE
                if [[ "$service" == "kamailio" ]] || [[ "$service" == "api" ]]; then
                    ttl=$TTL_DYNAMIC
                fi
                
                # Add annotations
                kubectl annotate service "$svc_name" -n "$namespace" \
                    "external-dns.alpha.kubernetes.io/hostname=${subdomain}.${DOMAIN_PROD}" \
                    "external-dns.alpha.kubernetes.io/ttl=${ttl}" \
                    --overwrite
                
                ((updated++))
            fi
        fi
    done
    
    if [ $updated -gt 0 ]; then
        print_success "Updated $updated services with DNS annotations"
    else
        print_warn "No matching LoadBalancer services found to update"
        print_info "You may need to manually annotate your services"
    fi
}

# Show External DNS logs
show_logs() {
    print_header "External DNS Logs"
    
    print_info "Showing recent logs from External DNS..."
    kubectl logs -n "$NAMESPACE" deployment/external-dns --tail=20
}

# Main execution
print_header "External DNS Setup for Gandi"

# Check prerequisites
check_kubernetes

# Create Gandi secret
if ! create_gandi_secret; then
    print_error "Failed to create Gandi secret"
    exit 1
fi

# Deploy External DNS
if ! deploy_external_dns; then
    print_error "Failed to deploy External DNS"
    exit 1
fi

# Update service annotations
update_service_annotations

# Show logs
echo ""
show_logs

# Final instructions
echo ""
print_header "Setup Complete!"
echo ""
print_info "External DNS is now running and will:"
echo "  - Monitor services with type=LoadBalancer"
echo "  - Create DNS records for annotated services"
echo "  - Update records when LoadBalancer IPs change"
echo "  - Remove records when services are deleted"
echo ""
print_info "To annotate a service for DNS:"
echo '  kubectl annotate service <service-name> -n <namespace> \'
echo '    "external-dns.alpha.kubernetes.io/hostname=<subdomain>.ringer.tel" \'
echo '    "external-dns.alpha.kubernetes.io/ttl=300"'
echo ""
print_info "To check External DNS logs:"
echo "  kubectl logs -n external-dns deployment/external-dns -f"
echo ""
print_success "DNS automation is now active!"