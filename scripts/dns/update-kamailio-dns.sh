#!/bin/bash

# Update Kamailio DNS Records for Split UDP/TCP LoadBalancers
# Date: 2025-11-10
# Purpose: Update DNS after fixing Kamailio LoadBalancer (split UDP/TCP)

set -e

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Gandi API configuration (inline to avoid sourcing dns-config.sh with bash 3.x issues)
GANDI_API_URL="https://api.gandi.net/v5"

# Get API key from Google Secret Manager
get_gandi_api_key() {
    local api_key
    api_key=$(gcloud secrets versions access latest --secret=gandi-api-key 2>/dev/null)

    if [ -z "$api_key" ]; then
        echo "[ERROR] Failed to retrieve Gandi API key from Secret Manager"
        return 1
    fi

    echo "$api_key"
}

# Make authenticated API request to Gandi
gandi_api_request() {
    local method=$1
    local endpoint=$2
    local data=${3:-}
    local api_key

    api_key=$(get_gandi_api_key)
    if [ $? -ne 0 ]; then
        return 1
    fi

    local args=(
        -X "$method"
        -H "Authorization: Apikey $api_key"
        -H "Content-Type: application/json"
    )

    if [ -n "$data" ]; then
        args+=(-d "$data")
    fi

    curl -s "${args[@]}" "${GANDI_API_URL}${endpoint}"
}

# Create or update A record
upsert_a_record() {
    local domain=$1
    local subdomain=$2
    local ip=$3
    local ttl=$4

    # Check if record exists
    local existing_record
    existing_record=$(gandi_api_request GET "/livedns/domains/$domain/records/$subdomain/A" 2>/dev/null)

    local data=$(cat <<EOF
{
    "rrset_values": ["$ip"],
    "rrset_ttl": $ttl
}
EOF
)

    if echo "$existing_record" | grep -q "rrset_values"; then
        # Update existing record
        gandi_api_request PUT "/livedns/domains/$domain/records/$subdomain/A" "$data"
    else
        # Create new record
        gandi_api_request POST "/livedns/domains/$domain/records" "$(cat <<EOF
{
    "rrset_name": "$subdomain",
    "rrset_type": "A",
    "rrset_values": ["$ip"],
    "rrset_ttl": $ttl
}
EOF
)"
    fi
}

# Create or update SRV record
upsert_srv_record() {
    local domain=$1
    local service=$2
    local protocol=$3
    local priority=$4
    local weight=$5
    local port=$6
    local target=$7
    local ttl=$8

    local srv_name="_${service}._${protocol}"
    local srv_value="${priority} ${weight} ${port} ${target}."

    # Check if record exists
    local existing_record
    existing_record=$(gandi_api_request GET "/livedns/domains/$domain/records/$srv_name/SRV" 2>/dev/null)

    local data=$(cat <<EOF
{
    "rrset_values": ["$srv_value"],
    "rrset_ttl": $ttl
}
EOF
)

    if echo "$existing_record" | grep -q "rrset_values"; then
        # Update existing record
        gandi_api_request PUT "/livedns/domains/$domain/records/$srv_name/SRV" "$data"
    else
        # Create new record
        gandi_api_request POST "/livedns/domains/$domain/records" "$(cat <<EOF
{
    "rrset_name": "$srv_name",
    "rrset_type": "SRV",
    "rrset_values": ["$srv_value"],
    "rrset_ttl": $ttl
}
EOF
)"
    fi
}

# Helper functions for output
print_info() { echo -e "\033[0;32m[INFO]\033[0m $1"; }
print_error() { echo -e "\033[0;31m[ERROR]\033[0m $1"; }
print_warn() { echo -e "\033[1;33m[WARN]\033[0m $1"; }
print_success() { echo -e "\033[0;32m[SUCCESS]\033[0m $1"; }

# Test DNS propagation
test_dns_propagation() {
    local fqdn=$1
    local expected_ip=$2
    local max_attempts=6
    local attempt=1

    print_info "Testing DNS propagation for $fqdn -> $expected_ip"

    while [ $attempt -le $max_attempts ]; do
        local resolved_ip
        resolved_ip=$(dig +short "$fqdn" @8.8.8.8 | tail -1)

        if [ "$resolved_ip" = "$expected_ip" ]; then
            print_success "DNS propagated successfully! (attempt $attempt)"
            return 0
        fi

        print_warn "Attempt $attempt: Got '$resolved_ip', expected '$expected_ip'"
        sleep 10
        ((attempt++))
    done

    print_warn "DNS may still be propagating after $max_attempts attempts (TTL delay)"
    return 0
}

# New Kamailio LoadBalancer IPs
KAMAILIO_UDP_IP="34.44.183.87"
KAMAILIO_TCP_IP="34.55.182.145"
DOMAIN="ringer.tel"
TTL=300  # Gandi minimum TTL (5 minutes)

print_info "============================================"
print_info "Updating Kamailio DNS Records"
print_info "============================================"
print_info "Domain: $DOMAIN"
print_info "UDP IP: $KAMAILIO_UDP_IP"
print_info "TCP IP: $KAMAILIO_TCP_IP"
print_info "TTL: ${TTL}s"
print_info "============================================"

# 1. Create/Update A records for UDP and TCP specific subdomains
print_info "Creating A record: sip-udp.$DOMAIN -> $KAMAILIO_UDP_IP"
upsert_a_record "$DOMAIN" "sip-udp" "$KAMAILIO_UDP_IP" "$TTL"
if [ $? -eq 0 ]; then
    print_success "sip-udp A record created/updated"
else
    print_error "Failed to create sip-udp A record"
    exit 1
fi

print_info "Creating A record: sip-tcp.$DOMAIN -> $KAMAILIO_TCP_IP"
upsert_a_record "$DOMAIN" "sip-tcp" "$KAMAILIO_TCP_IP" "$TTL"
if [ $? -eq 0 ]; then
    print_success "sip-tcp A record created/updated"
else
    print_error "Failed to create sip-tcp A record"
    exit 1
fi

# 2. Update main sip A record to point to UDP (primary protocol for SIP)
print_info "Creating A record: sip.$DOMAIN -> $KAMAILIO_UDP_IP (primary)"
upsert_a_record "$DOMAIN" "sip" "$KAMAILIO_UDP_IP" "$TTL"
if [ $? -eq 0 ]; then
    print_success "sip A record created/updated"
else
    print_error "Failed to create sip A record"
    exit 1
fi

# 3. Create/Update SRV record for SIP UDP
print_info "Creating SRV record: _sip._udp.$DOMAIN -> sip-udp.$DOMAIN"
upsert_srv_record "$DOMAIN" "sip" "udp" 10 50 5060 "sip-udp.$DOMAIN" "$TTL"
if [ $? -eq 0 ]; then
    print_success "_sip._udp SRV record created/updated"
else
    print_error "Failed to create _sip._udp SRV record"
    exit 1
fi

# 4. Create/Update SRV record for SIP TCP
print_info "Creating SRV record: _sip._tcp.$DOMAIN -> sip-tcp.$DOMAIN"
upsert_srv_record "$DOMAIN" "sip" "tcp" 10 50 5060 "sip-tcp.$DOMAIN" "$TTL"
if [ $? -eq 0 ]; then
    print_success "_sip._tcp SRV record created/updated"
else
    print_error "Failed to create _sip._tcp SRV record"
    exit 1
fi

# 5. Create/Update SRV record for SIP TLS
print_info "Creating SRV record: _sips._tcp.$DOMAIN -> sip-tcp.$DOMAIN"
upsert_srv_record "$DOMAIN" "sips" "tcp" 10 50 5061 "sip-tcp.$DOMAIN" "$TTL"
if [ $? -eq 0 ]; then
    print_success "_sips._tcp SRV record created/updated"
else
    print_error "Failed to create _sips._tcp SRV record"
    exit 1
fi

print_success "============================================"
print_success "DNS Records Updated Successfully!"
print_success "============================================"
print_info ""
print_info "DNS Configuration:"
print_info "  Primary SIP:        sip.$DOMAIN -> $KAMAILIO_UDP_IP"
print_info "  SIP UDP Specific:   sip-udp.$DOMAIN -> $KAMAILIO_UDP_IP"
print_info "  SIP TCP Specific:   sip-tcp.$DOMAIN -> $KAMAILIO_TCP_IP"
print_info ""
print_info "SRV Records:"
print_info "  _sip._udp.$DOMAIN.  $TTL  IN  SRV  10 50 5060 sip-udp.$DOMAIN."
print_info "  _sip._tcp.$DOMAIN.  $TTL  IN  SRV  10 50 5060 sip-tcp.$DOMAIN."
print_info "  _sips._tcp.$DOMAIN. $TTL  IN  SRV  10 50 5061 sip-tcp.$DOMAIN."
print_info ""
print_warn "Note: DNS propagation may take 1-5 minutes (TTL=$TTL seconds)"
print_info ""
print_info "Testing DNS propagation..."

# Test DNS propagation
sleep 5
test_dns_propagation "sip.$DOMAIN" "$KAMAILIO_UDP_IP"
test_dns_propagation "sip-udp.$DOMAIN" "$KAMAILIO_UDP_IP"
test_dns_propagation "sip-tcp.$DOMAIN" "$KAMAILIO_TCP_IP"

print_success "============================================"
print_success "DNS Update Complete!"
print_success "Customers can now configure SIP trunks:"
print_success "  UDP: sip-udp.$DOMAIN:5060"
print_success "  TCP: sip-tcp.$DOMAIN:5060"
print_success "  TLS: sip-tcp.$DOMAIN:5061"
print_success "============================================"
