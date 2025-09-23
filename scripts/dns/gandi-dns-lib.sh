#!/bin/bash

# Gandi DNS API Library Functions
# Provides reusable functions for DNS management

# Source configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/dns-config.sh"

# Gandi API endpoint
GANDI_API_URL="https://api.gandi.net/v5"

# Get API key from Google Secret Manager
get_gandi_api_key() {
    local api_key
    api_key=$(gcloud secrets versions access latest --secret=gandi-api-key 2>/dev/null)
    
    if [ -z "$api_key" ]; then
        print_error "Failed to retrieve Gandi API key from Secret Manager"
        print_error "Please run: ./setup-gandi-secret.sh <your-api-key>"
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
        -H "Authorization: Bearer $api_key"
        -H "Content-Type: application/json"
    )
    
    if [ -n "$data" ]; then
        args+=(-d "$data")
    fi
    
    curl -s "${args[@]}" "${GANDI_API_URL}${endpoint}"
}

# Check if domain exists in Gandi account
check_domain_exists() {
    local domain=$1
    local response
    
    response=$(gandi_api_request GET "/domain/domains/$domain")
    
    if echo "$response" | grep -q "\"fqdn\":\"$domain\""; then
        return 0
    else
        return 1
    fi
}

# Get all DNS records for a domain
get_dns_records() {
    local domain=$1
    gandi_api_request GET "/livedns/domains/$domain/records"
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

# Delete a DNS record
delete_record() {
    local domain=$1
    local name=$2
    local type=$3
    
    gandi_api_request DELETE "/livedns/domains/$domain/records/$name/$type"
}

# Test DNS propagation
test_dns_propagation() {
    local fqdn=$1
    local expected_ip=$2
    local max_attempts=30
    local attempt=1
    
    print_info "Testing DNS propagation for $fqdn -> $expected_ip"
    
    while [ $attempt -le $max_attempts ]; do
        local resolved_ip
        resolved_ip=$(dig +short "$fqdn" @8.8.8.8 | tail -1)
        
        if [ "$resolved_ip" = "$expected_ip" ]; then
            print_success "DNS propagated successfully! (attempt $attempt)"
            return 0
        fi
        
        print_warn "Attempt $attempt: Got $resolved_ip, expected $expected_ip"
        sleep 10
        ((attempt++))
    done
    
    print_error "DNS propagation failed after $max_attempts attempts"
    return 1
}

# Helper functions for output
print_info() { echo -e "\033[0;32m[INFO]\033[0m $1"; }
print_error() { echo -e "\033[0;31m[ERROR]\033[0m $1"; }
print_warn() { echo -e "\033[1;33m[WARN]\033[0m $1"; }
print_success() { echo -e "\033[0;32m[SUCCESS]\033[0m $1"; }