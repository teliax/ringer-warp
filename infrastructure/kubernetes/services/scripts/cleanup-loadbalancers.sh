#!/bin/bash

# LoadBalancer Cleanup Script
# Purpose: Safely remove deprecated LoadBalancers to reduce costs
# Date: 2025-09-23
# Expected savings: ~$60/month

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
BACKUP_DIR="./loadbalancer-backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/loadbalancer-backup-${TIMESTAMP}.yaml"
DRY_RUN=false

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -d, --dry-run    Show what would be deleted without actually deleting"
    echo "  -h, --help       Show this help message"
    echo "  -y, --yes        Skip confirmation prompts (use with caution)"
    exit 1
}

# Parse command line arguments
SKIP_CONFIRM=false
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -y|--yes)
            SKIP_CONFIRM=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check kubectl connectivity
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig"
        exit 1
    fi
    
    # Check gcloud (optional but recommended)
    if ! command -v gcloud &> /dev/null; then
        print_warning "gcloud CLI not found. Cannot verify GCP forwarding rules"
    fi
    
    print_success "Prerequisites check passed"
}

# Function to create backup directory
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        print_info "Created backup directory: $BACKUP_DIR"
    fi
}

# Function to backup current LoadBalancer services
backup_loadbalancers() {
    print_info "Creating backup of all LoadBalancer services..."
    
    kubectl get svc --all-namespaces -o yaml | grep -A 1000 "type: LoadBalancer" > "$BACKUP_FILE" || true
    
    if [ -f "$BACKUP_FILE" ]; then
        print_success "Backup created: $BACKUP_FILE"
    else
        print_warning "No LoadBalancer services found to backup"
    fi
}

# Function to list current LoadBalancers
list_current_loadbalancers() {
    print_info "Current LoadBalancer services in the cluster:"
    echo ""
    kubectl get svc --all-namespaces | grep LoadBalancer | awk '{printf "%-30s %-30s %-15s\n", $1"/"$2, $5, $6}' || echo "No LoadBalancer services found"
    echo ""
}

# Function to check for duplicate Kamailio services
check_duplicate_kamailio() {
    print_info "Checking for duplicate Kamailio services in warp-core namespace..."
    
    local duplicates=0
    
    if kubectl get svc kamailio-sip-tcp -n warp-core &> /dev/null; then
        print_warning "Found duplicate: kamailio-sip-tcp in warp-core namespace"
        ((duplicates++))
    fi
    
    if kubectl get svc kamailio-sip-udp -n warp-core &> /dev/null; then
        print_warning "Found duplicate: kamailio-sip-udp in warp-core namespace"
        ((duplicates++))
    fi
    
    return $duplicates
}

# Function to check for monitoring LoadBalancers
check_monitoring_loadbalancers() {
    print_info "Checking for monitoring service LoadBalancers..."
    
    local monitoring_svcs=$(kubectl get svc --all-namespaces | grep LoadBalancer | grep -E "(prometheus|grafana|alertmanager|loki)" || true)
    
    if [ -n "$monitoring_svcs" ]; then
        print_warning "Found monitoring LoadBalancers that should use Ingress:"
        echo "$monitoring_svcs"
        return 1
    else
        print_success "No monitoring LoadBalancers found (good - they should use Ingress)"
        return 0
    fi
}

# Function to check for old API gateway LoadBalancers
check_api_gateway_loadbalancers() {
    print_info "Checking for deprecated API gateway LoadBalancers..."
    
    local api_svcs=$(kubectl get svc --all-namespaces | grep -i "api-gateway" | grep LoadBalancer || true)
    
    if [ -n "$api_svcs" ]; then
        print_warning "Found API gateway LoadBalancers:"
        echo "$api_svcs"
        return 1
    else
        print_success "No deprecated API gateway LoadBalancers found"
        return 0
    fi
}

# Function to verify service dependencies
verify_dependencies() {
    local namespace=$1
    local service=$2
    
    print_info "Checking dependencies for $namespace/$service..."
    
    # Check if any pods reference the service
    local refs=$(kubectl get pods --all-namespaces -o yaml | grep -c "$service" | grep -c "$namespace" || true)
    
    if [ "$refs" -gt 0 ]; then
        print_warning "Found potential references to $namespace/$service"
        return 1
    fi
    
    # Check endpoints
    local endpoints=$(kubectl get endpoints $service -n $namespace 2>/dev/null | grep -v NAME | wc -l || true)
    
    if [ "$endpoints" -gt 0 ]; then
        print_warning "Service $namespace/$service has active endpoints"
        return 1
    fi
    
    print_success "No active dependencies found for $namespace/$service"
    return 0
}

# Function to delete a LoadBalancer service
delete_loadbalancer() {
    local namespace=$1
    local service=$2
    
    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would delete: kubectl delete service $service -n $namespace"
    else
        print_info "Deleting $namespace/$service..."
        if kubectl delete service $service -n $namespace; then
            print_success "Successfully deleted $namespace/$service"
        else
            print_error "Failed to delete $namespace/$service"
            return 1
        fi
    fi
}

# Function to confirm action
confirm_action() {
    if [ "$SKIP_CONFIRM" = true ]; then
        return 0
    fi
    
    local message=$1
    read -p "$message (yes/no): " -n 3 -r
    echo
    if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        return 0
    else
        return 1
    fi
}

# Function to perform cleanup
perform_cleanup() {
    local services_to_delete=()
    
    # Check for duplicate Kamailio services
    if kubectl get svc kamailio-sip-tcp -n warp-core &> /dev/null; then
        services_to_delete+=("warp-core/kamailio-sip-tcp")
    fi
    
    if kubectl get svc kamailio-sip-udp -n warp-core &> /dev/null; then
        services_to_delete+=("warp-core/kamailio-sip-udp")
    fi
    
    # Check for monitoring LoadBalancers
    local monitoring_svcs=$(kubectl get svc --all-namespaces -o wide | grep LoadBalancer | grep -E "(prometheus|grafana|alertmanager|loki)" | awk '{print $1"/"$2}' || true)
    if [ -n "$monitoring_svcs" ]; then
        while IFS= read -r svc; do
            services_to_delete+=("$svc")
        done <<< "$monitoring_svcs"
    fi
    
    # Check for API gateway LoadBalancers
    local api_svcs=$(kubectl get svc --all-namespaces -o wide | grep -i "api-gateway" | grep LoadBalancer | awk '{print $1"/"$2}' || true)
    if [ -n "$api_svcs" ]; then
        while IFS= read -r svc; do
            services_to_delete+=("$svc")
        done <<< "$api_svcs"
    fi
    
    if [ ${#services_to_delete[@]} -eq 0 ]; then
        print_success "No deprecated LoadBalancers found to delete"
        return 0
    fi
    
    print_warning "The following LoadBalancer services will be deleted:"
    for svc in "${services_to_delete[@]}"; do
        echo "  - $svc"
    done
    echo ""
    
    if ! confirm_action "Do you want to proceed with deletion?"; then
        print_info "Cleanup cancelled by user"
        return 1
    fi
    
    # Delete services
    for svc in "${services_to_delete[@]}"; do
        IFS='/' read -r namespace service <<< "$svc"
        
        # Skip dependency check if dry run
        if [ "$DRY_RUN" = false ]; then
            if ! verify_dependencies "$namespace" "$service"; then
                if ! confirm_action "Service $svc may have dependencies. Continue anyway?"; then
                    print_warning "Skipping $svc due to potential dependencies"
                    continue
                fi
            fi
        fi
        
        delete_loadbalancer "$namespace" "$service"
    done
}

# Function to verify cleanup
verify_cleanup() {
    print_info "Verifying cleanup results..."
    
    echo ""
    print_info "Remaining LoadBalancer services:"
    kubectl get svc --all-namespaces | grep LoadBalancer | awk '{printf "%-30s %-30s %-15s\n", $1"/"$2, $5, $6}'
    
    echo ""
    print_info "Expected remaining LoadBalancers:"
    echo "  - ingress-nginx/ingress-nginx-controller (NGINX Ingress)"
    echo "  - ringer-warp-v01/kamailio-sip-tcp (Primary Kamailio TCP)"
    echo "  - ringer-warp-v01/kamailio-sip-udp (Primary Kamailio UDP)"
    
    # Check GCP forwarding rules if gcloud is available
    if command -v gcloud &> /dev/null; then
        echo ""
        print_info "GCP Forwarding Rules:"
        gcloud compute forwarding-rules list --format="table(name,IPAddress,target)" || true
    fi
}

# Function to show cost impact
show_cost_impact() {
    local current_count=$(kubectl get svc --all-namespaces | grep -c LoadBalancer || echo 0)
    local expected_count=3  # nginx-ingress + 2 kamailio services
    local removed_count=$((current_count - expected_count))
    
    if [ $removed_count -lt 0 ]; then
        removed_count=0
    fi
    
    echo ""
    print_info "Cost Impact Summary:"
    echo "  Current LoadBalancers: $current_count"
    echo "  Expected after cleanup: $expected_count"
    echo "  LoadBalancers to remove: $removed_count"
    echo "  Estimated monthly savings: ~\$$(($removed_count * 30))"
    echo "  Estimated yearly savings: ~\$$(($removed_count * 30 * 12))"
}

# Main execution
main() {
    echo "================================================"
    echo "LoadBalancer Cleanup Script"
    echo "================================================"
    
    if [ "$DRY_RUN" = true ]; then
        print_warning "Running in DRY RUN mode - no actual changes will be made"
    fi
    
    # Check prerequisites
    check_prerequisites
    
    # Create backup directory
    create_backup_dir
    
    # Show current state
    echo ""
    list_current_loadbalancers
    
    # Create backup
    if [ "$DRY_RUN" = false ]; then
        backup_loadbalancers
    fi
    
    # Check for services to delete
    echo ""
    check_duplicate_kamailio
    check_monitoring_loadbalancers
    check_api_gateway_loadbalancers
    
    # Show cost impact
    show_cost_impact
    
    # Perform cleanup
    echo ""
    perform_cleanup
    
    # Verify results
    if [ "$DRY_RUN" = false ]; then
        echo ""
        verify_cleanup
    fi
    
    echo ""
    echo "================================================"
    if [ "$DRY_RUN" = true ]; then
        print_info "Dry run completed. Use without -d flag to perform actual cleanup"
    else
        print_success "LoadBalancer cleanup completed!"
        print_info "Backup saved to: $BACKUP_FILE"
        print_info "To rollback if needed: kubectl apply -f $BACKUP_FILE"
    fi
    echo "================================================"
}

# Run main function
main