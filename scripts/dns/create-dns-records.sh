#!/bin/bash

# Create DNS records for all services
# Usage: ./create-dns-records.sh [production|staging]

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/gandi-dns-lib.sh"

# Set environment
ENVIRONMENT="${1:-production}"
export ENVIRONMENT

# Get domain for this environment
DOMAIN=$(get_domain)

print_info "Creating DNS records for environment: $ENVIRONMENT"
print_info "Using domain: $DOMAIN"

# Verify domain exists
if ! check_domain_exists "$DOMAIN"; then
    print_error "Domain $DOMAIN not found in Gandi account!"
    print_error "Please ensure the domain is registered and accessible."
    exit 1
fi

print_success "Domain $DOMAIN verified in Gandi account"

# Create A records for each service
print_info "Creating A records for services..."

for service in "${!SERVICE_IPS[@]}"; do
    ip="${SERVICE_IPS[$service]}"
    subdomain="${SUBDOMAINS[$service]}"
    
    # Determine TTL based on service type
    if [[ "$service" == "kamailio" ]] || [[ "$service" == "api" ]]; then
        ttl=$TTL_DYNAMIC
    else
        ttl=$TTL_STABLE
    fi
    
    print_info "Creating A record: ${subdomain}.${DOMAIN} -> $ip (TTL: $ttl)"
    
    response=$(upsert_a_record "$DOMAIN" "$subdomain" "$ip" "$ttl")
    
    if echo "$response" | grep -q "error"; then
        print_error "Failed to create A record for $subdomain: $response"
    else
        print_success "Created A record for ${subdomain}.${DOMAIN}"
    fi
done

# Create SRV records for SIP service
print_info "Creating SRV records for SIP services..."

# SIP target (using subdomain)
sip_target="${SUBDOMAINS[kamailio]}.${DOMAIN}"

# Create SRV records for different protocols
for protocol in "udp" "tcp" "tls"; do
    case $protocol in
        udp)
            port=$SRV_PORT_UDP
            ;;
        tcp)
            port=$SRV_PORT_TCP
            ;;
        tls)
            port=$SRV_PORT_TLS
            ;;
    esac
    
    print_info "Creating SRV record: _sip._${protocol}.${DOMAIN} -> $sip_target:$port"
    
    response=$(upsert_srv_record "$DOMAIN" "sip" "$protocol" "$SRV_PRIORITY" "$SRV_WEIGHT" "$port" "$sip_target" "$TTL_DYNAMIC")
    
    if echo "$response" | grep -q "error"; then
        print_error "Failed to create SRV record for $protocol: $response"
    else
        print_success "Created SRV record for _sip._${protocol}.${DOMAIN}"
    fi
done

# Create wildcard record for customer trunks (optional)
if [[ "${CREATE_WILDCARD:-false}" == "true" ]]; then
    print_info "Creating wildcard A record for customer trunks..."
    response=$(upsert_a_record "$DOMAIN" "*" "${SERVICE_IPS[kamailio]}" "$TTL_DYNAMIC")
    
    if echo "$response" | grep -q "error"; then
        print_error "Failed to create wildcard record: $response"
    else
        print_success "Created wildcard A record *.${DOMAIN}"
    fi
fi

# Display summary
echo ""
print_info "=== DNS Records Created ==="
echo ""
echo "A Records:"
for service in "${!SERVICE_IPS[@]}"; do
    subdomain="${SUBDOMAINS[$service]}"
    ip="${SERVICE_IPS[$service]}"
    echo "  ${subdomain}.${DOMAIN} -> $ip"
done
echo ""
echo "SRV Records:"
echo "  _sip._udp.${DOMAIN} -> ${sip_target}:${SRV_PORT_UDP}"
echo "  _sip._tcp.${DOMAIN} -> ${sip_target}:${SRV_PORT_TCP}"
echo "  _sip._tls.${DOMAIN} -> ${sip_target}:${SRV_PORT_TLS}"
echo ""

# Optional: Test DNS propagation
if [[ "${TEST_PROPAGATION:-true}" == "true" ]]; then
    print_info "Testing DNS propagation (this may take a few minutes)..."
    
    # Test one critical service
    test_dns_propagation "${SUBDOMAINS[api]}.${DOMAIN}" "${SERVICE_IPS[api]}"
fi

print_success "DNS configuration complete!"