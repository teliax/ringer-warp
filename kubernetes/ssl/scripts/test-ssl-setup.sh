#!/bin/bash
# SSL/TLS Testing Script for Ringer WARP

set -e

echo "=== SSL/TLS Setup Testing Script ==="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check certificate
check_cert() {
    local domain=$1
    local port=${2:-443}
    
    echo -n "Testing $domain:$port ... "
    
    if timeout 5 bash -c "</dev/tcp/$domain/$port" 2>/dev/null; then
        # Get certificate details
        cert_info=$(echo | openssl s_client -connect $domain:$port 2>/dev/null | openssl x509 -noout -text 2>/dev/null)
        
        if [ $? -eq 0 ]; then
            issuer=$(echo "$cert_info" | grep -m1 "Issuer:" | sed 's/.*O=\([^,]*\).*/\1/')
            subject=$(echo "$cert_info" | grep -m1 "Subject:" | grep -o "CN=.*" | cut -d'=' -f2)
            expiry=$(echo | openssl s_client -connect $domain:$port 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d'=' -f2)
            
            if [[ "$issuer" == *"Let's Encrypt"* ]]; then
                if [[ "$issuer" == *"Staging"* ]]; then
                    echo -e "${YELLOW}STAGING${NC}"
                else
                    echo -e "${GREEN}PRODUCTION${NC}"
                fi
                echo "  Issuer: $issuer"
                echo "  Subject: $subject"
                echo "  Expires: $expiry"
            else
                echo -e "${RED}NOT LET'S ENCRYPT${NC}"
                echo "  Issuer: $issuer"
            fi
        else
            echo -e "${RED}FAILED${NC} - Could not get certificate"
        fi
    else
        echo -e "${RED}UNREACHABLE${NC}"
    fi
    echo
}

# Function to check kubernetes resources
check_k8s_resource() {
    local resource=$1
    local namespace=$2
    
    echo "Checking $resource in namespace $namespace:"
    kubectl get $resource -n $namespace -o wide || echo "Not found"
    echo
}

echo "=== Checking Kubernetes Resources ==="
echo

# Check cert-manager
echo -e "${YELLOW}Cert-Manager Status:${NC}"
kubectl get pods -n cert-manager 2>/dev/null || echo "cert-manager not installed"
echo

# Check Ingress Controller
echo -e "${YELLOW}Ingress Controller Status:${NC}"
kubectl get pods -n ingress-nginx 2>/dev/null || echo "NGINX Ingress not installed"
echo

# Get Ingress External IP
INGRESS_IP=$(kubectl get svc -n ingress-nginx nginx-ingress-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
if [ -n "$INGRESS_IP" ]; then
    echo -e "${GREEN}Ingress External IP: $INGRESS_IP${NC}"
else
    echo -e "${RED}No Ingress External IP found${NC}"
fi
echo

# Check ClusterIssuers
echo -e "${YELLOW}ClusterIssuers:${NC}"
kubectl get clusterissuer
echo

# Check Certificates
echo -e "${YELLOW}Certificates Status:${NC}"
kubectl get certificate --all-namespaces
echo

# Check for any pending challenges
echo -e "${YELLOW}Pending Challenges:${NC}"
kubectl get challenges --all-namespaces 2>/dev/null || echo "No pending challenges"
echo

echo "=== Testing SSL Endpoints ==="
echo

# Domains to test
DOMAINS=(
    "api-v2.ringer.tel"
    "api.ringer.net"
    "grafana.ringer.tel"
    "prometheus.ringer.tel"
    "homer.ringer.tel"
    "sip.ringer.tel:5061"
)

for domain in "${DOMAINS[@]}"; do
    if [[ "$domain" == *":"* ]]; then
        host="${domain%:*}"
        port="${domain#*:}"
        check_cert "$host" "$port"
    else
        check_cert "$domain"
    fi
done

echo "=== DNS Resolution Check ==="
echo

# Check DNS resolution
for domain in "api-v2.ringer.tel" "grafana.ringer.tel" "prometheus.ringer.tel"; do
    echo -n "Resolving $domain: "
    ip=$(dig +short $domain | tail -n1)
    if [ -n "$ip" ]; then
        echo -e "${GREEN}$ip${NC}"
        if [ "$ip" == "$INGRESS_IP" ]; then
            echo "  ✓ Points to Ingress Controller"
        else
            echo -e "  ${YELLOW}⚠ Does not point to Ingress Controller ($INGRESS_IP)${NC}"
        fi
    else
        echo -e "${RED}FAILED${NC}"
    fi
done
echo

echo "=== Certificate Details ==="
echo

# Show detailed certificate info for each namespace
for ns in warp-api monitoring homer warp-core ringer-warp-v01; do
    certs=$(kubectl get certificate -n $ns -o name 2>/dev/null)
    if [ -n "$certs" ]; then
        echo -e "${YELLOW}Namespace: $ns${NC}"
        for cert in $certs; do
            cert_name=${cert#certificate.cert-manager.io/}
            echo "  Certificate: $cert_name"
            kubectl describe $cert -n $ns | grep -E "(Status:|Message:|Reason:)" | sed 's/^/    /'
        done
        echo
    fi
done

echo "=== Recommendations ==="
echo

# Check if still using staging
if kubectl get certificate --all-namespaces -o yaml | grep -q "letsencrypt-staging"; then
    echo -e "${YELLOW}⚠ Some certificates are using Let's Encrypt Staging${NC}"
    echo "  Run the following to switch to production:"
    echo "  1. Update issuerRef in certificate yamls to 'letsencrypt-production'"
    echo "  2. kubectl apply -f /home/daldworth/repos/ringer-warp/kubernetes/ssl/certificates/"
    echo "  3. kubectl delete certificate --all --all-namespaces"
    echo
fi

# Check for missing DNS records
if [ -n "$INGRESS_IP" ]; then
    echo -e "${YELLOW}Ensure these DNS records point to $INGRESS_IP:${NC}"
    echo "  - api-v2.ringer.tel"
    echo "  - api.ringer.net"
    echo "  - grafana.ringer.tel"
    echo "  - prometheus.ringer.tel"
    echo "  - homer.ringer.tel"
fi

echo
echo "=== Test Complete ==="