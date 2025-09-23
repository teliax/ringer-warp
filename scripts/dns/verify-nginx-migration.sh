#!/bin/bash

# Verify NGINX Ingress migration and SSL certificate status
# This script checks DNS propagation and SSL certificate issuance

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/dns-config.sh"

# NGINX Ingress Controller IP
NGINX_INGRESS_IP="34.72.20.183"

# Services migrated to NGINX
MIGRATED_SERVICES=("grafana" "prometheus" "homer")

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() { echo -e "${BLUE}=== $1 ===${NC}"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_fail() { echo -e "${RED}✗${NC} $1"; }
print_warn() { echo -e "${YELLOW}!${NC} $1"; }

# Check DNS propagation
check_dns_propagation() {
    print_header "DNS Propagation Status"
    echo ""
    
    local dns_servers=("8.8.8.8" "1.1.1.1" "208.67.222.222")
    local all_propagated=true
    
    for service in "${MIGRATED_SERVICES[@]}"; do
        local fqdn="${service}.${DOMAIN_PROD}"
        echo "Checking $fqdn:"
        
        local all_correct=true
        for dns_server in "${dns_servers[@]}"; do
            local resolved_ip=$(dig +short "$fqdn" @"$dns_server" 2>/dev/null | tail -1)
            
            if [ "$resolved_ip" = "$NGINX_INGRESS_IP" ]; then
                print_success "$dns_server: $resolved_ip"
            else
                print_fail "$dns_server: $resolved_ip (expected $NGINX_INGRESS_IP)"
                all_correct=false
                all_propagated=false
            fi
        done
        
        if [ "$all_correct" = true ]; then
            echo -e "  ${GREEN}Fully propagated${NC}"
        else
            echo -e "  ${YELLOW}Still propagating...${NC}"
        fi
        echo ""
    done
    
    return $([ "$all_propagated" = true ] && echo 0 || echo 1)
}

# Check SSL certificate status
check_ssl_certificates() {
    print_header "SSL Certificate Status"
    echo ""
    
    for service in "${MIGRATED_SERVICES[@]}"; do
        local fqdn="${service}.${DOMAIN_PROD}"
        echo "Checking $fqdn:"
        
        # Check if we can connect with SSL
        if timeout 5 openssl s_client -connect "$fqdn:443" -servername "$fqdn" </dev/null 2>/dev/null | grep -q "Certificate chain"; then
            # Get certificate details
            local cert_info=$(echo | openssl s_client -connect "$fqdn:443" -servername "$fqdn" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
            
            if [ -n "$cert_info" ]; then
                print_success "SSL certificate present"
                echo "$cert_info" | sed 's/^/  /'
                
                # Check if it's Let's Encrypt
                if echo | openssl s_client -connect "$fqdn:443" -servername "$fqdn" 2>/dev/null | openssl x509 -noout -issuer 2>/dev/null | grep -q "Let's Encrypt"; then
                    print_success "Issued by Let's Encrypt"
                fi
            else
                print_warn "SSL certificate present but couldn't get details"
            fi
        else
            print_fail "No SSL certificate found (this is expected initially)"
            echo "  Certificate will be issued once DNS propagation is complete"
        fi
        echo ""
    done
}

# Check service accessibility
check_service_access() {
    print_header "Service Accessibility"
    echo ""
    
    for service in "${MIGRATED_SERVICES[@]}"; do
        local fqdn="${service}.${DOMAIN_PROD}"
        
        echo "Testing $fqdn:"
        
        # Test HTTP redirect (should redirect to HTTPS)
        local http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 -L "http://$fqdn" 2>/dev/null || echo "000")
        if [ "$http_code" = "000" ]; then
            print_fail "HTTP: Connection failed"
        else
            print_success "HTTP: Response code $http_code"
        fi
        
        # Test HTTPS
        local https_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 -k "https://$fqdn" 2>/dev/null || echo "000")
        if [ "$https_code" = "000" ]; then
            print_fail "HTTPS: Connection failed"
        elif [[ "$https_code" =~ ^[23][0-9]{2}$ ]]; then
            print_success "HTTPS: Response code $https_code"
        else
            print_warn "HTTPS: Response code $https_code"
        fi
        echo ""
    done
}

# Check cert-manager status in Kubernetes
check_certmanager_status() {
    print_header "Cert-Manager Status"
    echo ""
    
    if kubectl cluster-info >/dev/null 2>&1; then
        echo "Checking Certificate resources:"
        
        # Look for certificates in monitoring namespace
        local certs=$(kubectl get certificate -n monitoring 2>/dev/null | grep -E "(grafana|prometheus|homer)" || true)
        
        if [ -n "$certs" ]; then
            echo "$certs"
            echo ""
            
            # Check certificate request status
            echo "Certificate status details:"
            for service in "${MIGRATED_SERVICES[@]}"; do
                local cert_status=$(kubectl describe certificate "$service-tls" -n monitoring 2>/dev/null | grep -A5 "Status:" || true)
                if [ -n "$cert_status" ]; then
                    echo "  $service-tls:"
                    echo "$cert_status" | sed 's/^/    /'
                    echo ""
                fi
            done
        else
            print_warn "No certificates found in monitoring namespace"
            echo "  Certificates will be created once DNS propagation is complete"
        fi
        
        # Check for cert-manager events
        echo ""
        echo "Recent cert-manager events:"
        kubectl get events -n monitoring --field-selector reason=IssuerNotReady,reason=OrderCreated,reason=OrderPending,reason=OrderReady --sort-by='.lastTimestamp' 2>/dev/null | tail -5 || echo "  No recent certificate events"
    else
        print_warn "Cannot connect to Kubernetes cluster"
    fi
}

# Main execution
print_header "NGINX Ingress Migration Verification"
echo "Date: $(date)"
echo "NGINX Ingress IP: $NGINX_INGRESS_IP"
echo ""

# Run checks
check_dns_propagation
dns_propagated=$?

check_ssl_certificates

check_service_access

if kubectl cluster-info >/dev/null 2>&1; then
    check_certmanager_status
fi

# Summary
print_header "Summary"
echo ""

if [ $dns_propagated -eq 0 ]; then
    print_success "DNS has fully propagated to all tested servers"
else
    print_warn "DNS is still propagating. This can take 5-60 minutes."
    echo "  The TTL for these services is set to $TTL_STABLE seconds ($(($TTL_STABLE/60)) minutes)"
fi

echo ""
echo "Service URLs:"
for service in "${MIGRATED_SERVICES[@]}"; do
    echo "  https://${service}.${DOMAIN_PROD}"
done

echo ""
echo "Migration documentation saved in:"
echo "  - nginx-migration-report-*.txt"
echo "  - dns-backup-20241223.sh"
echo ""
echo "To rollback if needed:"
echo "  ./rollback-nginx-migration.sh"
echo ""