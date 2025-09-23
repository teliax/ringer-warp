#!/bin/bash

# Rollback script for NGINX Ingress migration
# This script restores the original LoadBalancer IPs

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/gandi-dns-lib.sh"

# Original LoadBalancer IPs
declare -A ORIGINAL_IPS=(
    ["grafana"]="35.224.100.108"
    ["prometheus"]="35.224.246.74"
    ["homer"]="35.223.187.94"
)

print_header "Rolling Back DNS Records to Original LoadBalancer IPs"

for service in "${!ORIGINAL_IPS[@]}"; do
    subdomain="$service"
    original_ip="${ORIGINAL_IPS[$service]}"
    
    print_info "Restoring ${subdomain}.${DOMAIN_PROD} to $original_ip"
    
    response=$(upsert_a_record "$DOMAIN_PROD" "$subdomain" "$original_ip" "$TTL_STABLE")
    
    if echo "$response" | grep -q "error"; then
        print_error "Failed to restore $subdomain: $response"
    else
        print_success "Restored ${subdomain}.${DOMAIN_PROD} to $original_ip"
    fi
done

print_success "Rollback complete!"
