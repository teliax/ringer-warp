#!/bin/bash

# Service Rollback Script
# This script rolls back services to their previous configuration using backup files

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="../backups"
LOG_FILE="rollback_$(date +%Y%m%d_%H%M%S).log"

# Function to log messages
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Function to list available backups
list_backups() {
    log "${YELLOW}Available backups:${NC}"
    ls -la "$BACKUP_DIR"/*.yaml 2>/dev/null || {
        log "${RED}No backup files found in $BACKUP_DIR${NC}"
        exit 1
    }
}

# Function to rollback service
rollback_service() {
    local backup_file=$1
    
    if [ ! -f "$backup_file" ]; then
        log "${RED}Backup file not found: $backup_file${NC}"
        return 1
    fi
    
    log "${YELLOW}Rolling back from: $backup_file${NC}"
    
    # Extract namespace and service name from the backup
    local namespace=$(grep "namespace:" "$backup_file" | head -1 | awk '{print $2}')
    local service=$(grep "name:" "$backup_file" | head -1 | awk '{print $2}')
    
    log "Restoring service: ${namespace}/${service}"
    
    # Apply the backup
    kubectl apply -f "$backup_file"
    
    # Verify rollback
    local service_type=$(kubectl get service "$service" -n "$namespace" -o jsonpath='{.spec.type}')
    log "${GREEN}Service ${namespace}/${service} restored. Type: $service_type${NC}"
}

# Function to rollback all services from a timestamp
rollback_by_timestamp() {
    local timestamp=$1
    local count=0
    
    log "${YELLOW}Rolling back all services from timestamp: $timestamp${NC}"
    
    for backup_file in "$BACKUP_DIR"/*_${timestamp}.yaml; do
        if [ -f "$backup_file" ]; then
            rollback_service "$backup_file"
            ((count++))
        fi
    done
    
    if [ $count -eq 0 ]; then
        log "${RED}No backups found for timestamp: $timestamp${NC}"
        return 1
    else
        log "${GREEN}Rolled back $count services${NC}"
    fi
}

# Function to rollback specific service
rollback_specific_service() {
    local namespace=$1
    local service=$2
    
    log "${YELLOW}Looking for backups of ${namespace}/${service}${NC}"
    
    # Find the most recent backup
    local latest_backup=$(ls -t "$BACKUP_DIR"/${namespace}_${service}_*.yaml 2>/dev/null | head -1)
    
    if [ -z "$latest_backup" ]; then
        log "${RED}No backup found for ${namespace}/${service}${NC}"
        return 1
    fi
    
    rollback_service "$latest_backup"
}

# Main menu
show_menu() {
    echo -e "${YELLOW}=== Service Rollback Tool ===${NC}"
    echo "1. List available backups"
    echo "2. Rollback all services by timestamp"
    echo "3. Rollback specific service"
    echo "4. Rollback from specific backup file"
    echo "5. Exit"
    echo -n "Select option: "
}

# Main execution
main() {
    while true; do
        show_menu
        read -r option
        
        case $option in
            1)
                list_backups
                ;;
            2)
                log "Enter timestamp (format: YYYYMMDD_HHMMSS): "
                read -r timestamp
                rollback_by_timestamp "$timestamp"
                ;;
            3)
                log "Enter namespace: "
                read -r namespace
                log "Enter service name: "
                read -r service
                rollback_specific_service "$namespace" "$service"
                ;;
            4)
                log "Enter backup file path: "
                read -r backup_file
                rollback_service "$backup_file"
                ;;
            5)
                log "${GREEN}Exiting...${NC}"
                exit 0
                ;;
            *)
                log "${RED}Invalid option${NC}"
                ;;
        esac
        
        echo -e "\nPress Enter to continue..."
        read -r
    done
}

# Check if script is run with arguments
if [ $# -eq 0 ]; then
    main
else
    case $1 in
        --list)
            list_backups
            ;;
        --timestamp)
            if [ $# -ne 2 ]; then
                log "${RED}Usage: $0 --timestamp YYYYMMDD_HHMMSS${NC}"
                exit 1
            fi
            rollback_by_timestamp "$2"
            ;;
        --service)
            if [ $# -ne 3 ]; then
                log "${RED}Usage: $0 --service NAMESPACE SERVICE${NC}"
                exit 1
            fi
            rollback_specific_service "$2" "$3"
            ;;
        --file)
            if [ $# -ne 2 ]; then
                log "${RED}Usage: $0 --file BACKUP_FILE${NC}"
                exit 1
            fi
            rollback_service "$2"
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --list                    List available backups"
            echo "  --timestamp TIMESTAMP     Rollback by timestamp"
            echo "  --service NS SERVICE      Rollback specific service"
            echo "  --file FILE              Rollback from file"
            echo "  --help                   Show this help"
            ;;
        *)
            log "${RED}Unknown option: $1${NC}"
            log "Use --help for usage information"
            exit 1
            ;;
    esac
fi