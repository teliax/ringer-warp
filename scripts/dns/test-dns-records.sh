#!/bin/bash

# Test DNS records and service connectivity
# Usage: ./test-dns-records.sh [domain]

set -euo pipefail

# Source configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/dns-config.sh"

# Domain to test (default to production)
DOMAIN="${1:-$DOMAIN_PROD}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() { echo -e "${BLUE}=== $1 ===${NC}"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_fail() { echo -e "${RED}✗${NC} $1"; }
print_warn() { echo -e "${YELLOW}!${NC} $1"; }

# DNS servers to test against
DNS_SERVERS=(
    "8.8.8.8"        # Google
    "1.1.1.1"        # Cloudflare
    "208.67.222.222" # OpenDNS
)

# Test A record resolution
test_a_record() {
    local fqdn=$1
    local expected_ip=$2
    local dns_server=$3
    
    local resolved_ip
    resolved_ip=$(dig +short "$fqdn" @"$dns_server" 2>/dev/null | tail -1)
    
    if [ "$resolved_ip" = "$expected_ip" ]; then
        print_success "$fqdn -> $resolved_ip (via $dns_server)"
        return 0
    elif [ -n "$resolved_ip" ]; then
        print_fail "$fqdn -> $resolved_ip (expected $expected_ip via $dns_server)"
        return 1
    else
        print_fail "$fqdn -> No response (via $dns_server)"
        return 1
    fi
}

# Test SRV record resolution
test_srv_record() {
    local srv_record=$1
    local dns_server=$2
    
    local response
    response=$(dig +short "$srv_record" SRV @"$dns_server" 2>/dev/null)
    
    if [ -n "$response" ]; then
        print_success "$srv_record -> $response (via $dns_server)"
        return 0
    else
        print_fail "$srv_record -> No response (via $dns_server)"
        return 1
    fi
}

# Test HTTP/HTTPS connectivity
test_http_connectivity() {
    local url=$1
    local service=$2
    
    local response_code
    response_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$url" 2>/dev/null || echo "000")
    
    if [[ "$response_code" =~ ^[23][0-9]{2}$ ]]; then
        print_success "$service is accessible at $url (HTTP $response_code)"
        return 0
    elif [ "$response_code" = "000" ]; then
        print_fail "$service is not accessible at $url (Connection failed)"
        return 1
    else
        print_warn "$service responded at $url (HTTP $response_code)"
        return 0
    fi
}

# Test SIP connectivity
test_sip_connectivity() {
    local host=$1
    local port=$2
    local protocol=$3
    
    # Use netcat to test basic connectivity
    if timeout 2 nc -z -v "$host" "$port" >/dev/null 2>&1; then
        print_success "SIP $protocol port $port is open on $host"
        return 0
    else
        print_fail "SIP $protocol port $port is not accessible on $host"
        return 1
    fi
}

# Main testing sequence
echo ""
print_header "DNS Resolution Tests for $DOMAIN"
echo ""

# Test A records
echo "Testing A Records:"
echo "-----------------"
for service in "${!SERVICE_IPS[@]}"; do
    subdomain="${SUBDOMAINS[$service]}"
    expected_ip="${SERVICE_IPS[$service]}"
    fqdn="${subdomain}.${DOMAIN}"
    
    echo ""
    echo "Testing: $fqdn"
    
    all_passed=true
    for dns_server in "${DNS_SERVERS[@]}"; do
        if ! test_a_record "$fqdn" "$expected_ip" "$dns_server"; then
            all_passed=false
        fi
    done
    
    if [ "$all_passed" = true ]; then
        echo -e "${GREEN}All DNS servers resolved correctly${NC}"
    fi
done

# Test SRV records
echo ""
echo ""
echo "Testing SRV Records:"
echo "-------------------"
for protocol in udp tcp tls; do
    srv_record="_sip._${protocol}.${DOMAIN}"
    
    echo ""
    echo "Testing: $srv_record"
    
    for dns_server in "${DNS_SERVERS[@]}"; do
        test_srv_record "$srv_record" "$dns_server"
    done
done

# Test service connectivity
echo ""
echo ""
print_header "Service Connectivity Tests"
echo ""

# Test HTTP/HTTPS services
echo "Testing HTTP/HTTPS Services:"
echo "---------------------------"

# API Gateway
test_http_connectivity "http://${SUBDOMAINS[api]}.${DOMAIN}" "API Gateway"
test_http_connectivity "https://${SUBDOMAINS[api]}.${DOMAIN}" "API Gateway (HTTPS)"

# Grafana
test_http_connectivity "http://${SUBDOMAINS[grafana]}.${DOMAIN}:3000" "Grafana"

# Prometheus
test_http_connectivity "http://${SUBDOMAINS[prometheus]}.${DOMAIN}:9090" "Prometheus"

# HOMER
test_http_connectivity "http://${SUBDOMAINS[homer]}.${DOMAIN}" "HOMER"

# Test SIP connectivity
echo ""
echo ""
echo "Testing SIP Services:"
echo "--------------------"

sip_host="${SUBDOMAINS[kamailio]}.${DOMAIN}"

test_sip_connectivity "$sip_host" 5060 "UDP"
test_sip_connectivity "$sip_host" 5060 "TCP"
test_sip_connectivity "$sip_host" 5061 "TLS"

# Summary
echo ""
echo ""
print_header "Test Summary"
echo ""

# DNS propagation tips
echo "Note: DNS propagation can take up to 5 minutes for dynamic records (TTL 300s)"
echo "      and up to 1 hour for stable records (TTL 3600s)"
echo ""
echo "If records are not resolving:"
echo "1. Wait for TTL to expire"
echo "2. Clear local DNS cache:"
echo "   - Linux: sudo systemctl restart systemd-resolved"
echo "   - Mac: sudo dscacheutil -flushcache"
echo "3. Test with different DNS servers"
echo ""

# Quick connectivity test URLs
print_header "Quick Access URLs"
echo ""
echo "API Gateway:  https://${SUBDOMAINS[api]}.${DOMAIN}"
echo "Grafana:      http://${SUBDOMAINS[grafana]}.${DOMAIN}:3000"
echo "Prometheus:   http://${SUBDOMAINS[prometheus]}.${DOMAIN}:9090"
echo "HOMER:        http://${SUBDOMAINS[homer]}.${DOMAIN}"
echo "SIP URI:      sip:${SUBDOMAINS[kamailio]}.${DOMAIN}"
echo ""