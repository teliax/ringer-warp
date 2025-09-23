#!/bin/bash

# Update DNS records based on current LoadBalancer IPs
# This script fetches actual LoadBalancer IPs from Kubernetes and updates DNS
# Usage: ./update-dns-loadbalancers.sh

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/gandi-dns-lib.sh"

# Service to namespace mapping
declare -A SERVICE_NAMESPACES=(
    ["kamailio"]="voip"
    ["api"]="api"
    ["prometheus"]="monitoring"
    ["grafana"]="monitoring"
    ["homer"]="monitoring"
)

# Service name patterns to match
declare -A SERVICE_PATTERNS=(
    ["kamailio"]="kamailio|sip"
    ["api"]="api-gateway|api"
    ["prometheus"]="prometheus"
    ["grafana"]="grafana"
    ["homer"]="homer"
)

print_header() { echo -e "\033[0;34m=== $1 ===\033[0m"; }

# Get LoadBalancer IP for a service
get_loadbalancer_ip() {
    local namespace=$1
    local pattern=$2
    
    local ip
    ip=$(kubectl get svc -n "$namespace" -o json 2>/dev/null | \
        jq -r '.items[] | 
        select(.spec.type == "LoadBalancer") | 
        select(.metadata.name | test("'"$pattern"'"; "i")) | 
        .status.loadBalancer.ingress[0].ip // empty' | \
        head -1)
    
    echo "$ip"
}

# Discover LoadBalancer IPs from Kubernetes
discover_loadbalancers() {
    print_header "Discovering LoadBalancer IPs from Kubernetes"
    
    local found_ips=()
    local updated_config=false
    
    for service in "${!SERVICE_NAMESPACES[@]}"; do
        local namespace="${SERVICE_NAMESPACES[$service]}"
        local pattern="${SERVICE_PATTERNS[$service]}"
        local configured_ip="${SERVICE_IPS[$service]}"
        
        print_info "Checking for $service service in namespace: $namespace"
        
        local actual_ip
        actual_ip=$(get_loadbalancer_ip "$namespace" "$pattern")
        
        if [ -n "$actual_ip" ]; then
            print_success "Found $service LoadBalancer: $actual_ip"
            
            if [ "$actual_ip" != "$configured_ip" ]; then
                print_warn "IP differs from configuration (configured: $configured_ip)"
                SERVICE_IPS[$service]="$actual_ip"
                updated_config=true
            fi
            
            found_ips+=("$service:$actual_ip")
        else
            print_warn "No LoadBalancer found for $service in namespace $namespace"
            print_info "Using configured IP: $configured_ip"
        fi
    done
    
    if [ $updated_config = true ]; then
        print_warn "LoadBalancer IPs have changed. Updating DNS records..."
    fi
    
    # Display summary
    echo ""
    print_header "LoadBalancer IP Summary"
    for entry in "${found_ips[@]}"; do
        echo "  $entry"
    done
    echo ""
}

# Update DNS with current IPs
update_dns_records() {
    local domain="${1:-$DOMAIN_PROD}"
    
    print_header "Updating DNS Records"
    print_info "Domain: $domain"
    
    # Verify domain exists
    if ! check_domain_exists "$domain"; then
        print_error "Domain $domain not found in Gandi account!"
        return 1
    fi
    
    # Update A records
    for service in "${!SERVICE_IPS[@]}"; do
        local ip="${SERVICE_IPS[$service]}"
        local subdomain="${SUBDOMAINS[$service]}"
        
        # Skip if no IP
        if [ -z "$ip" ] || [ "$ip" = "null" ]; then
            print_warn "Skipping $service - no IP address available"
            continue
        fi
        
        # Determine TTL
        local ttl=$TTL_STABLE
        if [[ "$service" == "kamailio" ]] || [[ "$service" == "api" ]]; then
            ttl=$TTL_DYNAMIC
        fi
        
        print_info "Updating ${subdomain}.${domain} -> $ip (TTL: $ttl)"
        
        response=$(upsert_a_record "$domain" "$subdomain" "$ip" "$ttl")
        
        if echo "$response" | grep -q "error"; then
            print_error "Failed to update $subdomain: $response"
        else
            print_success "Updated ${subdomain}.${domain}"
        fi
    done
    
    # Update SRV records if Kamailio is available
    if [ -n "${SERVICE_IPS[kamailio]}" ] && [ "${SERVICE_IPS[kamailio]}" != "null" ]; then
        update_srv_records "$domain"
    else
        print_warn "Skipping SRV records - Kamailio service not available"
    fi
}

# Update SRV records for SIP
update_srv_records() {
    local domain=$1
    local sip_target="${SUBDOMAINS[kamailio]}.${domain}"
    
    print_header "Updating SRV Records"
    
    for protocol in "udp" "tcp" "tls"; do
        local port
        case $protocol in
            udp) port=$SRV_PORT_UDP ;;
            tcp) port=$SRV_PORT_TCP ;;
            tls) port=$SRV_PORT_TLS ;;
        esac
        
        print_info "Updating _sip._${protocol}.${domain} -> $sip_target:$port"
        
        response=$(upsert_srv_record "$domain" "sip" "$protocol" "$SRV_PRIORITY" "$SRV_WEIGHT" "$port" "$sip_target" "$TTL_DYNAMIC")
        
        if echo "$response" | grep -q "error"; then
            print_error "Failed to update SRV record for $protocol: $response"
        else
            print_success "Updated SRV record for _sip._${protocol}.${domain}"
        fi
    done
}

# Create DNS update report
generate_report() {
    local domain=$1
    local report_file="${SCRIPT_DIR}/dns-update-report-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "DNS Update Report"
        echo "================"
        echo "Date: $(date)"
        echo "Domain: $domain"
        echo ""
        echo "A Records:"
        for service in "${!SERVICE_IPS[@]}"; do
            local ip="${SERVICE_IPS[$service]}"
            local subdomain="${SUBDOMAINS[$service]}"
            echo "  ${subdomain}.${domain} -> $ip"
        done
        echo ""
        echo "SRV Records:"
        echo "  _sip._udp.${domain} -> ${SUBDOMAINS[kamailio]}.${domain}:5060"
        echo "  _sip._tcp.${domain} -> ${SUBDOMAINS[kamailio]}.${domain}:5060"
        echo "  _sip._tls.${domain} -> ${SUBDOMAINS[kamailio]}.${domain}:5061"
    } > "$report_file"
    
    print_info "Report saved to: $report_file"
}

# Main execution
print_header "DNS LoadBalancer Update Tool"

# Check kubectl connectivity
if ! kubectl cluster-info >/dev/null 2>&1; then
    print_error "Cannot connect to Kubernetes cluster"
    print_info "Using configured static IPs instead"
else
    # Discover current LoadBalancer IPs
    discover_loadbalancers
fi

# Get domain
DOMAIN=$(get_domain)

# Update DNS records
if update_dns_records "$DOMAIN"; then
    print_success "DNS records updated successfully!"
    
    # Generate report
    generate_report "$DOMAIN"
    
    # Test propagation for one service
    if [ -n "${SERVICE_IPS[api]}" ] && [ "${SERVICE_IPS[api]}" != "null" ]; then
        echo ""
        test_dns_propagation "${SUBDOMAINS[api]}.${DOMAIN}" "${SERVICE_IPS[api]}"
    fi
else
    print_error "Failed to update DNS records"
    exit 1
fi

echo ""
print_success "DNS update complete!"
print_info "Run ./test-dns-records.sh to verify all records"