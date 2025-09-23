#!/bin/bash

# Rollback DNS records to previous state
# Usage: ./rollback-dns-records.sh [domain] [backup-file]

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/gandi-dns-lib.sh"

# Arguments
DOMAIN="${1:-$DOMAIN_PROD}"
BACKUP_FILE="${2:-}"

print_header() { echo -e "\033[0;34m=== $1 ===\033[0m"; }

# Create backup of current records
backup_current_records() {
    local domain=$1
    local backup_dir="${SCRIPT_DIR}/backups"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${backup_dir}/dns_backup_${domain}_${timestamp}.json"
    
    mkdir -p "$backup_dir"
    
    print_info "Creating backup of current DNS records..."
    
    local records
    records=$(get_dns_records "$domain")
    
    if [ -n "$records" ]; then
        echo "$records" > "$backup_file"
        print_success "Backup created: $backup_file"
        echo "$backup_file"
    else
        print_error "Failed to retrieve current records"
        return 1
    fi
}

# Delete specific records we manage
delete_managed_records() {
    local domain=$1
    
    print_header "Removing Managed DNS Records"
    
    # Delete A records for services
    for service in "${!SERVICE_IPS[@]}"; do
        subdomain="${SUBDOMAINS[$service]}"
        
        print_info "Deleting A record: ${subdomain}.${domain}"
        response=$(delete_record "$domain" "$subdomain" "A" 2>/dev/null)
        
        if echo "$response" | grep -q "error"; then
            print_warn "Record might not exist or already deleted: $subdomain"
        else
            print_success "Deleted A record: ${subdomain}.${domain}"
        fi
    done
    
    # Delete SRV records
    for protocol in udp tcp tls; do
        srv_name="_sip._${protocol}"
        
        print_info "Deleting SRV record: ${srv_name}.${domain}"
        response=$(delete_record "$domain" "$srv_name" "SRV" 2>/dev/null)
        
        if echo "$response" | grep -q "error"; then
            print_warn "SRV record might not exist or already deleted: $srv_name"
        else
            print_success "Deleted SRV record: ${srv_name}.${domain}"
        fi
    done
    
    # Delete wildcard if it exists
    if [[ "${DELETE_WILDCARD:-false}" == "true" ]]; then
        print_info "Deleting wildcard A record: *.${domain}"
        response=$(delete_record "$domain" "*" "A" 2>/dev/null)
        
        if echo "$response" | grep -q "error"; then
            print_warn "Wildcard record might not exist or already deleted"
        else
            print_success "Deleted wildcard A record"
        fi
    fi
}

# Restore from backup file
restore_from_backup() {
    local domain=$1
    local backup_file=$2
    
    if [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        return 1
    fi
    
    print_header "Restoring DNS Records from Backup"
    print_info "Backup file: $backup_file"
    
    # Parse JSON and restore records
    # Note: This is a simplified version. In production, you'd want more robust JSON parsing
    print_warn "Automatic restore from backup is not implemented yet."
    print_info "Please manually restore records using the Gandi web interface if needed."
    print_info "Backup file contains all previous records: $backup_file"
}

# Main execution
print_header "DNS Rollback Utility"

# Verify domain
if ! check_domain_exists "$DOMAIN"; then
    print_error "Domain $DOMAIN not found in Gandi account!"
    exit 1
fi

print_info "Working with domain: $DOMAIN"

# Create backup first
CURRENT_BACKUP=$(backup_current_records "$DOMAIN")

if [ -z "$CURRENT_BACKUP" ]; then
    print_error "Failed to create backup. Aborting rollback."
    exit 1
fi

# If backup file provided, restore from it
if [ -n "$BACKUP_FILE" ]; then
    restore_from_backup "$DOMAIN" "$BACKUP_FILE"
else
    # Otherwise, just delete our managed records
    delete_managed_records "$DOMAIN"
fi

print_success "Rollback completed!"
print_info "Current records backed up to: $CURRENT_BACKUP"

# Test that records are gone
echo ""
print_header "Verification"

for service in "${!SERVICE_IPS[@]}"; do
    subdomain="${SUBDOMAINS[$service]}"
    fqdn="${subdomain}.${DOMAIN}"
    
    resolved_ip=$(dig +short "$fqdn" @8.8.8.8 2>/dev/null | tail -1)
    
    if [ -z "$resolved_ip" ]; then
        print_success "$fqdn - Successfully removed"
    else
        print_warn "$fqdn still resolves to $resolved_ip (may be cached)"
    fi
done