#!/bin/bash

# Certificate Monitoring Script
# Monitors SSL certificate issuance and status

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MONITORING_INTERVAL=30  # seconds
LOG_FILE="cert_monitor_$(date +%Y%m%d_%H%M%S).log"

# Function to log messages
log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "[$timestamp] $1" | tee -a "$LOG_FILE"
}

# Function to check certificate status
check_certificates() {
    log "${YELLOW}=== Certificate Status ===${NC}"
    
    # Get all certificates using kubectl custom columns
    kubectl get certificates --all-namespaces -o custom-columns=\
NAMESPACE:.metadata.namespace,\
NAME:.metadata.name,\
READY:.status.conditions[0].status,\
SECRET:.spec.secretName,\
ISSUER:.spec.issuerRef.name,\
AGE:.metadata.creationTimestamp \
        --no-headers | while read -r namespace name ready secret issuer age; do
            if [ "$ready" = "True" ]; then
                log "${GREEN}✓ $namespace/$name - Ready: $ready - Secret: $secret${NC}"
            else
                log "${RED}✗ $namespace/$name - Ready: $ready - Secret: $secret${NC}"
            fi
        done
}

# Function to check certificate requests
check_certificate_requests() {
    log "\n${YELLOW}=== Certificate Requests ===${NC}"
    
    kubectl get certificaterequest --all-namespaces -o custom-columns=\
NAMESPACE:.metadata.namespace,\
NAME:.metadata.name,\
APPROVED:.status.conditions[*].status,\
READY:.status.conditions[*].status,\
ISSUER:.spec.issuerRef.name,\
AGE:.metadata.creationTimestamp \
        --no-headers | while read -r line; do
            log "${BLUE}$line${NC}"
        done
}

# Function to check challenges
check_challenges() {
    log "\n${YELLOW}=== ACME Challenges ===${NC}"
    
    local challenges=$(kubectl get challenges --all-namespaces 2>/dev/null)
    
    if [ -z "$challenges" ] || [ $(echo "$challenges" | wc -l) -eq 1 ]; then
        log "${GREEN}No active challenges${NC}"
    else
        echo "$challenges" | tail -n +2 | while IFS= read -r line; do
            if [[ "$line" =~ "pending" ]]; then
                log "${YELLOW}⚠ $line${NC}"
            elif [[ "$line" =~ "valid" ]]; then
                log "${GREEN}✓ $line${NC}"
            else
                log "${RED}✗ $line${NC}"
            fi
        done
    fi
}

# Function to check ingress TLS configuration
check_ingress_tls() {
    log "\n${YELLOW}=== Ingress TLS Configuration ===${NC}"
    
    # Get ingress with TLS configuration
    kubectl get ingress --all-namespaces -o custom-columns=\
NAMESPACE:.metadata.namespace,\
NAME:.metadata.name,\
HOSTS:.spec.rules[*].host,\
TLS-HOSTS:.spec.tls[*].hosts[*],\
TLS-SECRET:.spec.tls[*].secretName \
        --no-headers | while read -r namespace name hosts tls_hosts tls_secret; do
            if [ "$tls_secret" != "<none>" ] && [ ! -z "$tls_secret" ]; then
                log "${BLUE}$namespace/$name: $tls_hosts -> $tls_secret${NC}"
                
                # Check if the secret exists
                if kubectl get secret "$tls_secret" -n "$namespace" &>/dev/null; then
                    log "${GREEN}  ✓ Secret $tls_secret exists${NC}"
                    
                    # Check certificate expiry
                    local cert_data=$(kubectl get secret "$tls_secret" -n "$namespace" -o jsonpath='{.data.tls\.crt}' 2>/dev/null | base64 -d)
                    if [ ! -z "$cert_data" ]; then
                        local expiry=$(echo "$cert_data" | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
                        if [ ! -z "$expiry" ]; then
                            log "${BLUE}  Certificate expires: $expiry${NC}"
                        fi
                    fi
                else
                    log "${RED}  ✗ Secret $tls_secret not found${NC}"
                fi
            fi
        done
}

# Function to check cert-manager status
check_cert_manager() {
    log "\n${YELLOW}=== Cert-Manager Status ===${NC}"
    
    # Check cert-manager pods
    local pods=$(kubectl get pods -n cert-manager -o wide)
    if [ ! -z "$pods" ]; then
        echo "$pods" | tail -n +2 | while IFS= read -r line; do
            if [[ "$line" =~ "Running" ]]; then
                log "${GREEN}✓ $line${NC}"
            else
                log "${RED}✗ $line${NC}"
            fi
        done
    else
        log "${RED}No cert-manager pods found${NC}"
    fi
    
    # Check ClusterIssuers
    log "\n${YELLOW}=== Cluster Issuers ===${NC}"
    kubectl get clusterissuer -o custom-columns=NAME:.metadata.name,READY:.status.conditions[0].status,AGE:.metadata.creationTimestamp --no-headers | \
    while read -r line; do
        if [[ "$line" =~ "True" ]]; then
            log "${GREEN}✓ $line${NC}"
        else
            log "${RED}✗ $line${NC}"
        fi
    done
}

# Function to test domain connectivity
test_domain_connectivity() {
    log "\n${YELLOW}=== Domain Connectivity Test ===${NC}"
    
    local domains=(
        "grafana.ringer.tel"
        "prometheus.ringer.tel"
    )
    
    for domain in "${domains[@]}"; do
        log "Testing $domain..."
        
        # DNS resolution
        if host "$domain" &>/dev/null; then
            local ip=$(host "$domain" | grep "has address" | head -1 | awk '{print $NF}')
            log "${GREEN}  ✓ DNS resolves to: $ip${NC}"
        else
            log "${RED}  ✗ DNS resolution failed${NC}"
            continue
        fi
        
        # HTTPS connectivity
        local https_code=$(curl -o /dev/null -s -w "%{http_code}\n" -m 5 "https://$domain" 2>/dev/null || echo "000")
        case $https_code in
            200|301|302|401|403)
                log "${GREEN}  ✓ HTTPS accessible (HTTP $https_code)${NC}"
                ;;
            000)
                log "${RED}  ✗ HTTPS connection failed${NC}"
                ;;
            *)
                log "${YELLOW}  ⚠ HTTPS returned: HTTP $https_code${NC}"
                ;;
        esac
        
        # Certificate validation
        if openssl s_client -connect "$domain:443" -servername "$domain" </dev/null 2>/dev/null | openssl x509 -noout -text &>/dev/null; then
            local cert_info=$(echo | openssl s_client -connect "$domain:443" -servername "$domain" 2>/dev/null | openssl x509 -noout -subject -issuer -dates 2>/dev/null)
            if [ ! -z "$cert_info" ]; then
                log "${GREEN}  ✓ Valid SSL certificate${NC}"
                echo "$cert_info" | sed 's/^/    /' | while IFS= read -r line; do
                    log "${BLUE}$line${NC}"
                done
            fi
        else
            log "${YELLOW}  ⚠ Cannot validate SSL certificate${NC}"
        fi
    done
}

# Function for continuous monitoring
continuous_monitor() {
    local count=1
    
    while true; do
        clear
        log "${YELLOW}=== Certificate Monitor - Run #$count ===${NC}"
        log "Press Ctrl+C to stop monitoring"
        
        check_certificates
        check_certificate_requests
        check_challenges
        check_ingress_tls
        check_cert_manager
        test_domain_connectivity
        
        log "\n${YELLOW}Next check in $MONITORING_INTERVAL seconds...${NC}"
        sleep "$MONITORING_INTERVAL"
        ((count++))
    done
}

# Function for single check
single_check() {
    log "${YELLOW}=== Certificate Status Check ===${NC}"
    
    check_certificates
    check_certificate_requests
    check_challenges
    check_ingress_tls
    check_cert_manager
    test_domain_connectivity
    
    log "\n${GREEN}Check completed. Log saved to: $LOG_FILE${NC}"
}

# Main execution
main() {
    case ${1:-} in
        --continuous|-c)
            log "${YELLOW}Starting continuous monitoring (interval: ${MONITORING_INTERVAL}s)${NC}"
            continuous_monitor
            ;;
        --once|-o)
            single_check
            ;;
        --help|-h)
            echo "Certificate Monitoring Script"
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --continuous, -c    Continuous monitoring mode"
            echo "  --once, -o         Single check (default)"
            echo "  --help, -h         Show this help"
            echo ""
            echo "Environment variables:"
            echo "  MONITORING_INTERVAL    Seconds between checks (default: 30)"
            ;;
        *)
            single_check
            ;;
    esac
}

# Trap to handle Ctrl+C gracefully
trap 'log "\n${YELLOW}Monitoring stopped${NC}"; exit 0' INT

# Run main function
main "$@"