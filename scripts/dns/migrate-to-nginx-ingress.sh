#!/bin/bash

# Migrate DNS records to NGINX Ingress Controller
# This script updates grafana, prometheus, and homer to point to the NGINX Ingress IP
# Usage: ./migrate-to-nginx-ingress.sh

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/gandi-dns-lib.sh"

# NGINX Ingress Controller IP
NGINX_INGRESS_IP="34.72.20.183"

# Services to migrate to NGINX Ingress
declare -A SERVICES_TO_MIGRATE=(
    ["grafana"]="grafana"
    ["prometheus"]="prometheus"
    ["homer"]="homer"
)

# Backup of old IPs for documentation
declare -A OLD_IPS=(
    ["grafana"]="35.224.100.108"
    ["prometheus"]="35.224.246.74"
    ["homer"]="35.223.187.94"
)

print_header() { echo -e "\033[0;34m=== $1 ===\033[0m"; }

# Create migration report
create_migration_report() {
    local report_file="${SCRIPT_DIR}/nginx-migration-report-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "NGINX Ingress Migration Report"
        echo "=============================="
        echo "Date: $(date)"
        echo "NGINX Ingress IP: $NGINX_INGRESS_IP"
        echo ""
        echo "DNS Records Updated:"
        echo "-------------------"
        for service in "${!SERVICES_TO_MIGRATE[@]}"; do
            local subdomain="${SERVICES_TO_MIGRATE[$service]}"
            local old_ip="${OLD_IPS[$service]}"
            echo "  ${subdomain}.${DOMAIN_PROD}:"
            echo "    Old IP: $old_ip"
            echo "    New IP: $NGINX_INGRESS_IP"
        done
        echo ""
        echo "DNS Records Unchanged:"
        echo "---------------------"
        echo "  sip.${DOMAIN_PROD}: 35.188.144.139 (Kamailio LoadBalancer)"
        echo "  api-v2.${DOMAIN_PROD}: 34.41.135.92 (API LoadBalancer)"
        echo ""
        echo "Rollback Instructions:"
        echo "---------------------"
        echo "To rollback, run: ./rollback-nginx-migration.sh"
        echo ""
    } > "$report_file"
    
    print_info "Migration report saved to: $report_file"
}

# Update DNS records
update_dns_to_nginx() {
    local domain="$DOMAIN_PROD"
    
    print_header "Migrating DNS Records to NGINX Ingress"
    print_info "Domain: $domain"
    print_info "NGINX Ingress IP: $NGINX_INGRESS_IP"
    echo ""
    
    # Verify domain exists
    if ! check_domain_exists "$domain"; then
        print_error "Domain $domain not found in Gandi account!"
        return 1
    fi
    
    # Update A records for each service
    for service in "${!SERVICES_TO_MIGRATE[@]}"; do
        local subdomain="${SERVICES_TO_MIGRATE[$service]}"
        local old_ip="${OLD_IPS[$service]}"
        local ttl=$TTL_STABLE  # Use stable TTL for monitoring services
        
        print_info "Updating ${subdomain}.${domain}:"
        print_info "  Old IP: $old_ip"
        print_info "  New IP: $NGINX_INGRESS_IP"
        
        response=$(upsert_a_record "$domain" "$subdomain" "$NGINX_INGRESS_IP" "$ttl")
        
        if echo "$response" | grep -q "error"; then
            print_error "Failed to update $subdomain: $response"
            return 1
        else
            print_success "Updated ${subdomain}.${domain} to $NGINX_INGRESS_IP"
        fi
        
        echo ""
    done
    
    return 0
}

# Test DNS propagation for migrated services
test_migration() {
    print_header "Testing DNS Propagation"
    
    local all_success=true
    
    for service in "${!SERVICES_TO_MIGRATE[@]}"; do
        local subdomain="${SERVICES_TO_MIGRATE[$service]}"
        local fqdn="${subdomain}.${DOMAIN_PROD}"
        
        if ! test_dns_propagation "$fqdn" "$NGINX_INGRESS_IP"; then
            all_success=false
        fi
        echo ""
    done
    
    if [ "$all_success" = true ]; then
        print_success "All DNS records have propagated successfully!"
    else
        print_warn "Some DNS records are still propagating. This is normal."
        print_info "DNS changes can take up to 5-60 minutes to fully propagate."
    fi
}

# Main execution
print_header "DNS Migration to NGINX Ingress Controller"
echo ""
print_warn "This will update the following DNS records:"
for service in "${!SERVICES_TO_MIGRATE[@]}"; do
    subdomain="${SERVICES_TO_MIGRATE[$service]}"
    old_ip="${OLD_IPS[$service]}"
    echo "  ${subdomain}.${DOMAIN_PROD}: $old_ip -> $NGINX_INGRESS_IP"
done
echo ""

# Confirm before proceeding
read -p "Do you want to proceed with the migration? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
    print_info "Migration cancelled."
    exit 0
fi

# Create backup script first
cat > "${SCRIPT_DIR}/rollback-nginx-migration.sh" << 'EOF'
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
EOF

chmod +x "${SCRIPT_DIR}/rollback-nginx-migration.sh"
print_info "Created rollback script: rollback-nginx-migration.sh"
echo ""

# Perform the migration
if update_dns_to_nginx; then
    # Create migration report
    create_migration_report
    
    echo ""
    print_success "DNS migration completed successfully!"
    echo ""
    
    # Test propagation
    test_migration
    
    echo ""
    print_header "Next Steps"
    echo "1. Monitor the services to ensure they're accessible via NGINX Ingress"
    echo "2. Check that SSL certificates are being issued by cert-manager"
    echo "3. Verify the services at:"
    echo "   - https://grafana.ringer.tel"
    echo "   - https://prometheus.ringer.tel"
    echo "   - https://homer.ringer.tel"
    echo ""
    echo "If you need to rollback, run: ./rollback-nginx-migration.sh"
else
    print_error "Migration failed! DNS records may be in an inconsistent state."
    print_info "Review the errors above and consider running the rollback script."
    exit 1
fi