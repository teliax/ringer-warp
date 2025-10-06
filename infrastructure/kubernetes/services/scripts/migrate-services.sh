#!/bin/bash

# Service Migration Script - LoadBalancer to ClusterIP
# This script migrates monitoring services from LoadBalancer to ClusterIP type
# while keeping Kamailio services as LoadBalancer

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="../backups"
PATCH_DIR="../patches"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="migration_${TIMESTAMP}.log"

# Function to log messages
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Function to check prerequisites
check_prerequisites() {
    log "${YELLOW}Checking prerequisites...${NC}"
    
    if ! command -v kubectl &> /dev/null; then
        log "${RED}kubectl is not installed or not in PATH${NC}"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log "${RED}Cannot connect to Kubernetes cluster${NC}"
        exit 1
    fi
    
    log "${GREEN}Prerequisites check passed${NC}"
}

# Function to backup service
backup_service() {
    local namespace=$1
    local service=$2
    local backup_file="${BACKUP_DIR}/${namespace}_${service}_${TIMESTAMP}.yaml"
    
    log "Backing up service: ${namespace}/${service}"
    kubectl get service "$service" -n "$namespace" -o yaml > "$backup_file"
    log "${GREEN}Backed up to: $backup_file${NC}"
}

# Function to create patch file
create_patch() {
    local namespace=$1
    local service=$2
    local patch_file="${PATCH_DIR}/${namespace}_${service}_patch.yaml"
    
    cat > "$patch_file" << EOF
spec:
  type: ClusterIP
EOF
    
    log "${GREEN}Created patch file: $patch_file${NC}"
}

# Function to apply patch
apply_patch() {
    local namespace=$1
    local service=$2
    local patch_file="${PATCH_DIR}/${namespace}_${service}_patch.yaml"
    
    log "Applying patch to: ${namespace}/${service}"
    kubectl patch service "$service" -n "$namespace" --patch-file="$patch_file"
    
    # Remove LoadBalancer-specific fields
    kubectl patch service "$service" -n "$namespace" --type json -p='[
        {"op": "remove", "path": "/spec/loadBalancerIP", "value": ""},
        {"op": "remove", "path": "/spec/externalTrafficPolicy", "value": ""},
        {"op": "remove", "path": "/spec/sessionAffinity", "value": ""}
    ]' 2>/dev/null || true
    
    log "${GREEN}Patch applied successfully${NC}"
}

# Function to verify service
verify_service() {
    local namespace=$1
    local service=$2
    
    local service_type=$(kubectl get service "$service" -n "$namespace" -o jsonpath='{.spec.type}')
    
    if [ "$service_type" = "ClusterIP" ]; then
        log "${GREEN}✓ Service ${namespace}/${service} successfully migrated to ClusterIP${NC}"
        return 0
    else
        log "${RED}✗ Service ${namespace}/${service} migration failed. Type is still: $service_type${NC}"
        return 1
    fi
}

# Function to rollback service
rollback_service() {
    local namespace=$1
    local service=$2
    local backup_file="${BACKUP_DIR}/${namespace}_${service}_${TIMESTAMP}.yaml"
    
    log "${YELLOW}Rolling back service: ${namespace}/${service}${NC}"
    kubectl apply -f "$backup_file"
    log "${GREEN}Rollback completed${NC}"
}

# Function to check certificate status
check_certificates() {
    log "\n${YELLOW}Checking certificate status...${NC}"
    
    kubectl get certificates -n monitoring -o custom-columns=NAME:.metadata.name,READY:.status.conditions[0].status,SECRET:.spec.secretName,AGE:.metadata.creationTimestamp
    
    # Check for any pending challenges
    local challenges=$(kubectl get challenges --all-namespaces 2>/dev/null | grep -c "pending" || true)
    if [ "$challenges" -gt 0 ]; then
        log "${YELLOW}Warning: There are $challenges pending certificate challenges${NC}"
        kubectl get challenges --all-namespaces | grep "pending"
    fi
}

# Function to test service connectivity
test_service_connectivity() {
    local namespace=$1
    local service=$2
    local port=$3
    
    log "Testing connectivity to ${namespace}/${service}:${port}"
    
    # Get cluster IP
    local cluster_ip=$(kubectl get service "$service" -n "$namespace" -o jsonpath='{.spec.clusterIP}')
    
    # Create a test pod to check connectivity
    kubectl run test-connectivity-${RANDOM} --rm -i --restart=Never --image=busybox -- \
        wget -q -O- --timeout=5 "http://${cluster_ip}:${port}" &>/dev/null && \
        log "${GREEN}✓ Connectivity test passed${NC}" || \
        log "${YELLOW}⚠ Connectivity test failed (this might be expected if service requires auth)${NC}"
}

# Main migration function
migrate_monitoring_services() {
    log "\n${YELLOW}Starting monitoring services migration...${NC}"
    
    # Services to migrate (already ClusterIP but let's verify)
    declare -A monitoring_services=(
        ["monitoring"]="warp-monitoring-grafana:80 warp-monitoring-prometheus:9090"
    )
    
    for namespace in "${!monitoring_services[@]}"; do
        for service_port in ${monitoring_services[$namespace]}; do
            IFS=':' read -r service port <<< "$service_port"
            
            log "\n${YELLOW}Processing: ${namespace}/${service}${NC}"
            
            # Check current service type
            local current_type=$(kubectl get service "$service" -n "$namespace" -o jsonpath='{.spec.type}' 2>/dev/null || echo "NOT_FOUND")
            
            if [ "$current_type" = "NOT_FOUND" ]; then
                log "${RED}Service not found: ${namespace}/${service}${NC}"
                continue
            elif [ "$current_type" = "ClusterIP" ]; then
                log "${GREEN}Service already ClusterIP: ${namespace}/${service}${NC}"
                test_service_connectivity "$namespace" "$service" "$port"
                continue
            elif [ "$current_type" = "LoadBalancer" ]; then
                backup_service "$namespace" "$service"
                create_patch "$namespace" "$service"
                apply_patch "$namespace" "$service"
                verify_service "$namespace" "$service"
                test_service_connectivity "$namespace" "$service" "$port"
            fi
        done
    done
}

# Function to check ingress status
check_ingress_status() {
    log "\n${YELLOW}Checking Ingress status...${NC}"
    
    kubectl get ingress -n monitoring -o custom-columns=NAME:.metadata.name,HOSTS:.spec.rules[*].host,ADDRESS:.status.loadBalancer.ingress[0].ip,PORTS:.spec.tls[*].secretName
    
    # Test domain resolution and connectivity
    log "\n${YELLOW}Testing domain connectivity...${NC}"
    
    local domains=("grafana.ringer.tel" "prometheus.ringer.tel")
    for domain in "${domains[@]}"; do
        log "Testing $domain..."
        if curl -sSf -m 5 "https://$domain" -o /dev/null 2>&1; then
            log "${GREEN}✓ $domain is accessible via HTTPS${NC}"
        elif curl -sSf -m 5 "http://$domain" -o /dev/null 2>&1; then
            log "${YELLOW}⚠ $domain is accessible via HTTP only${NC}"
        else
            log "${RED}✗ $domain is not accessible${NC}"
        fi
    done
}

# Function to list Kamailio services (should remain LoadBalancer)
check_kamailio_services() {
    log "\n${YELLOW}Checking Kamailio services (should remain LoadBalancer)...${NC}"
    
    kubectl get services --all-namespaces -o custom-columns=NAMESPACE:.metadata.namespace,NAME:.metadata.name,TYPE:.spec.type,EXTERNAL-IP:.status.loadBalancer.ingress[0].ip | grep -i kamailio | grep LoadBalancer
}

# Main execution
main() {
    log "${YELLOW}=== Service Migration Script ===${NC}"
    log "Timestamp: $(date)"
    log "Log file: $LOG_FILE"
    
    # Create directories
    mkdir -p "$BACKUP_DIR" "$PATCH_DIR"
    
    # Run checks
    check_prerequisites
    check_certificates
    
    # Perform migration
    migrate_monitoring_services
    
    # Post-migration checks
    check_ingress_status
    check_kamailio_services
    
    log "\n${GREEN}=== Migration completed ===${NC}"
    log "Backups are stored in: $BACKUP_DIR"
    log "Patches are stored in: $PATCH_DIR"
    log "Full log available in: $LOG_FILE"
}

# Run main function
main "$@"