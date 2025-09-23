#!/bin/bash

# Comprehensive DNS and SSL Deployment Script
set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_header() { echo -e "\n${BLUE}=== $1 ===${NC}\n"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    local missing=false
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl not found"
        missing=true
    else
        print_info "kubectl: $(kubectl version --client -o json | jq -r .clientVersion.gitVersion)"
    fi
    
    # Check gcloud
    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud not found"
        missing=true
    else
        print_info "gcloud: configured for project $(gcloud config get-value project)"
    fi
    
    # Check helm
    if ! command -v helm &> /dev/null; then
        print_error "helm not found"
        missing=true
    else
        print_info "helm: $(helm version --short)"
    fi
    
    # Check Gandi API key
    if ! gcloud secrets describe gandi-api-key >/dev/null 2>&1; then
        print_error "Gandi API key not found in Secret Manager!"
        print_warn "Please run: ./scripts/dns/setup-gandi-secret.sh YOUR_GANDI_API_KEY"
        missing=true
    else
        print_info "Gandi API key: Found in Secret Manager"
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info >/dev/null 2>&1; then
        print_error "Cannot connect to Kubernetes cluster"
        missing=true
    else
        print_info "Kubernetes cluster: Connected"
    fi
    
    if [ "$missing" = true ]; then
        print_error "Prerequisites check failed. Please fix the issues above."
        exit 1
    fi
    
    print_info "All prerequisites satisfied!"
}

# Deploy DNS records
deploy_dns() {
    print_header "Deploying DNS Records"
    
    cd "${SCRIPT_DIR}/scripts/dns"
    
    # First, update the DNS configuration with current LoadBalancer IPs
    print_info "Discovering current LoadBalancer IPs..."
    
    # Create a temporary script to discover and update DNS
    cat > update-dns-temp.sh << 'EOF'
#!/bin/bash
source ./gandi-dns-lib.sh
source ./dns-config.sh

# Get current LoadBalancer IPs
KAMAILIO_TCP_V01=$(kubectl get svc -n ringer-warp-v01 kamailio-sip-tcp -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
KAMAILIO_UDP_V01=$(kubectl get svc -n ringer-warp-v01 kamailio-sip-udp -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
KAMAILIO_TCP_CORE=$(kubectl get svc -n warp-core kamailio-sip-tcp -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
KAMAILIO_UDP_CORE=$(kubectl get svc -n warp-core kamailio-sip-udp -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")

echo "Found LoadBalancer IPs:"
echo "  Kamailio TCP (v01): $KAMAILIO_TCP_V01"
echo "  Kamailio UDP (v01): $KAMAILIO_UDP_V01"
echo "  Kamailio TCP (core): $KAMAILIO_TCP_CORE"
echo "  Kamailio UDP (core): $KAMAILIO_UDP_CORE"

# Update main SIP endpoints (using warp-core as primary)
if [ -n "$KAMAILIO_TCP_CORE" ]; then
    SERVICE_IPS["kamailio"]="$KAMAILIO_TCP_CORE"
fi

# Create DNS records
DOMAIN="ringer.tel"

# Main SIP A record (pointing to TCP core)
if [ -n "$KAMAILIO_TCP_CORE" ]; then
    upsert_a_record "$DOMAIN" "sip" "$KAMAILIO_TCP_CORE" "$TTL_DYNAMIC"
fi

# Environment-specific records
if [ -n "$KAMAILIO_TCP_V01" ]; then
    upsert_a_record "$DOMAIN" "sip-v01" "$KAMAILIO_TCP_V01" "$TTL_DYNAMIC"
fi

# SRV records for SIP
if [ -n "$KAMAILIO_TCP_CORE" ]; then
    # UDP
    upsert_srv_record "$DOMAIN" "sip" "udp" "$SRV_PRIORITY" "$SRV_WEIGHT" "5060" "sip.$DOMAIN" "$TTL_DYNAMIC"
    # TCP
    upsert_srv_record "$DOMAIN" "sip" "tcp" "$SRV_PRIORITY" "$SRV_WEIGHT" "5060" "sip.$DOMAIN" "$TTL_DYNAMIC"
    # TLS
    upsert_srv_record "$DOMAIN" "sip" "tls" "$SRV_PRIORITY" "$SRV_WEIGHT" "5061" "sip.$DOMAIN" "$TTL_DYNAMIC"
fi

# Test records
echo
echo "Testing DNS propagation..."
for subdomain in sip sip-v01; do
    if host "$subdomain.$DOMAIN" >/dev/null 2>&1; then
        echo "✓ $subdomain.$DOMAIN resolves"
    else
        echo "⚠ $subdomain.$DOMAIN not yet propagated"
    fi
done
EOF
    
    chmod +x update-dns-temp.sh
    ./update-dns-temp.sh
    rm -f update-dns-temp.sh
    
    print_info "DNS records deployed. Propagation may take up to 5 minutes."
}

# Deploy SSL infrastructure
deploy_ssl() {
    print_header "Deploying SSL Infrastructure"
    
    cd "${SCRIPT_DIR}/kubernetes/ssl/scripts"
    
    # Install cert-manager
    print_info "Installing cert-manager..."
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.2/cert-manager.yaml
    
    print_info "Waiting for cert-manager pods to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager
    kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-webhook -n cert-manager
    kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-cainjector -n cert-manager
    
    # Install NGINX Ingress Controller
    print_info "Installing NGINX Ingress Controller..."
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo update
    
    helm upgrade --install nginx-ingress ingress-nginx/ingress-nginx \
      --namespace ingress-nginx \
      --create-namespace \
      --set controller.service.type=LoadBalancer \
      --set controller.service.annotations."cloud\.google\.com/load-balancer-type"="External" \
      --set controller.metrics.enabled=true \
      --set tcp.5061="warp-core/kamailio-sip-tcp:5061" \
      --set udp.5060="warp-core/kamailio-sip-udp:5060"
    
    # Wait for LoadBalancer IP
    print_info "Waiting for Ingress LoadBalancer IP..."
    INGRESS_IP=""
    while [ -z "$INGRESS_IP" ]; do
        INGRESS_IP=$(kubectl get svc -n ingress-nginx nginx-ingress-ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
        [ -z "$INGRESS_IP" ] && sleep 5
    done
    
    print_info "Ingress Controller External IP: $INGRESS_IP"
    
    # Install Gandi webhook
    print_info "Installing Gandi webhook for DNS-01 challenges..."
    helm repo add bwolf https://bwolf.github.io/cert-manager-webhook-gandi
    helm repo update
    
    helm upgrade --install cert-manager-webhook-gandi \
      --namespace cert-manager \
      --set features.apiPriorityAndFairness=true \
      --set logLevel=2 \
      bwolf/cert-manager-webhook-gandi
    
    # Sync Gandi secret
    print_info "Syncing Gandi API secret to cert-manager..."
    ./sync-gandi-secret.sh
    
    print_info "SSL infrastructure deployed successfully!"
    echo
    print_warn "IMPORTANT: Update DNS records to point to Ingress IP: $INGRESS_IP"
    print_warn "This is needed for: api-v2.ringer.tel, grafana.ringer.tel, prometheus.ringer.tel, homer.ringer.tel"
}

# Verify deployments
verify_deployments() {
    print_header "Verifying Deployments"
    
    # Check DNS
    print_info "Checking DNS records..."
    for subdomain in sip sip-v01; do
        if host "$subdomain.ringer.tel" >/dev/null 2>&1; then
            IP=$(host "$subdomain.ringer.tel" | grep "has address" | awk '{print $4}')
            print_info "✓ $subdomain.ringer.tel -> $IP"
        else
            print_warn "⚠ $subdomain.ringer.tel not resolved yet"
        fi
    done
    
    # Check cert-manager
    print_info "Checking cert-manager status..."
    kubectl get pods -n cert-manager
    
    # Check NGINX Ingress
    print_info "Checking NGINX Ingress status..."
    kubectl get pods -n ingress-nginx
    kubectl get svc -n ingress-nginx
    
    # Check certificates (if any)
    print_info "Checking certificates..."
    kubectl get certificate --all-namespaces
}

# Main execution
main() {
    print_header "Ringer Platform DNS & SSL Deployment"
    
    check_prerequisites
    
    read -p "Deploy DNS records? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        deploy_dns
    fi
    
    echo
    read -p "Deploy SSL infrastructure? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        deploy_ssl
    fi
    
    echo
    verify_deployments
    
    print_header "Deployment Complete"
    print_info "Next steps:"
    print_info "1. Apply certificate configurations: kubectl apply -f kubernetes/ssl/certificates/"
    print_info "2. Apply ingress configurations: kubectl apply -f kubernetes/ssl/ingress/"
    print_info "3. Monitor certificate issuance: kubectl get certificate --all-namespaces -w"
    print_info "4. Test SSL: ./kubernetes/ssl/scripts/test-ssl-setup.sh"
}

main "$@"