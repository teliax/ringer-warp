#!/bin/bash
set -e

# Deployment script for WARP database initialization
# This script handles the complete database initialization process

# Configuration
NAMESPACE="warp-core"
SCHEMA_DIR="${SCHEMA_DIR:-../schema}"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check kubectl connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check schema directory
    if [ ! -d "$SCHEMA_DIR" ]; then
        log_error "Schema directory not found: $SCHEMA_DIR"
        exit 1
    fi
    
    # Count SQL files
    sql_count=$(find "$SCHEMA_DIR" -name "*.sql" -type f | wc -l)
    if [ "$sql_count" -eq 0 ]; then
        log_error "No SQL files found in $SCHEMA_DIR"
        exit 1
    fi
    
    log_success "Prerequisites check passed (found $sql_count SQL files)"
}

# Function to create namespace
create_namespace() {
    if ! kubectl get namespace $NAMESPACE &> /dev/null; then
        log_info "Creating namespace $NAMESPACE..."
        kubectl create namespace $NAMESPACE
    else
        log_info "Namespace $NAMESPACE already exists"
    fi
}

# Function to create ConfigMap from schema files
create_schema_configmap() {
    log_info "Creating ConfigMap from schema files..."
    
    # Delete existing ConfigMap if exists
    if kubectl get configmap warp-db-schema -n $NAMESPACE &> /dev/null; then
        log_warning "Deleting existing schema ConfigMap..."
        kubectl delete configmap warp-db-schema -n $NAMESPACE
    fi
    
    # Create ConfigMap
    kubectl create configmap warp-db-schema \
        --from-file="$SCHEMA_DIR" \
        -n $NAMESPACE
    
    log_success "Schema ConfigMap created"
}

# Function to apply Kubernetes resources
apply_resources() {
    log_info "Applying Kubernetes resources..."
    
    # Apply the job configuration (includes secret and init scripts ConfigMap)
    kubectl apply -f "$SCRIPT_DIR/k8s-init-job.yaml"
    
    log_success "Kubernetes resources applied"
}

# Function to clean up previous job
cleanup_previous_job() {
    if kubectl get job warp-db-init -n $NAMESPACE &> /dev/null; then
        log_warning "Found existing initialization job"
        
        # Get job status
        job_status=$(kubectl get job warp-db-init -n $NAMESPACE -o jsonpath='{.status.conditions[?(@.type=="Complete")].status}' 2>/dev/null || echo "")
        
        if [ "$job_status" == "True" ]; then
            log_info "Previous job completed successfully"
            read -p "Delete previous job and run again? (y/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_info "Keeping existing job. Exiting."
                exit 0
            fi
        fi
        
        log_warning "Deleting previous job..."
        kubectl delete job warp-db-init -n $NAMESPACE
        sleep 2
    fi
}

# Function to wait for job completion
wait_for_job() {
    log_info "Waiting for database initialization to complete..."
    
    # Wait for job to start
    local max_wait=30
    local count=0
    while ! kubectl get job warp-db-init -n $NAMESPACE &> /dev/null; do
        sleep 1
        count=$((count + 1))
        if [ $count -gt $max_wait ]; then
            log_error "Job failed to start after ${max_wait} seconds"
            exit 1
        fi
    done
    
    # Watch job progress
    log_info "Job started. Monitoring progress..."
    
    # Stream logs in background
    kubectl logs -f -n $NAMESPACE job/warp-db-init 2>/dev/null &
    local log_pid=$!
    
    # Wait for job completion
    if kubectl wait --for=condition=complete --timeout=600s job/warp-db-init -n $NAMESPACE &> /dev/null; then
        # Kill log streaming
        kill $log_pid 2>/dev/null || true
        
        log_success "Database initialization completed successfully!"
        
        # Show final summary
        echo ""
        echo "=== Summary ==="
        echo "Namespace: $NAMESPACE"
        echo "Database Host: 10.126.0.3"
        echo "Database Name: warp"
        echo "Database User: warp"
        echo ""
        echo "The WARP database has been initialized with all schemas and tables."
        echo ""
        echo "To view the job logs again:"
        echo "  kubectl logs -n $NAMESPACE job/warp-db-init"
        echo ""
        echo "To delete the completed job:"
        echo "  kubectl delete job warp-db-init -n $NAMESPACE"
        
        return 0
    else
        # Kill log streaming
        kill $log_pid 2>/dev/null || true
        
        log_error "Database initialization failed or timed out!"
        
        # Show job status
        kubectl describe job warp-db-init -n $NAMESPACE
        
        echo ""
        echo "To view detailed logs:"
        echo "  kubectl logs -n $NAMESPACE job/warp-db-init"
        
        return 1
    fi
}

# Main execution
main() {
    echo -e "${GREEN}=== WARP Database Initialization Deployment ===${NC}"
    echo "Schema Directory: $SCHEMA_DIR"
    echo "Namespace: $NAMESPACE"
    echo ""
    
    # Run steps
    check_prerequisites
    create_namespace
    cleanup_previous_job
    create_schema_configmap
    apply_resources
    
    # Wait for completion
    if wait_for_job; then
        exit 0
    else
        exit 1
    fi
}

# Handle interrupts
trap 'echo -e "\n${YELLOW}Deployment interrupted${NC}"; exit 1' INT TERM

# Run main function
main "$@"