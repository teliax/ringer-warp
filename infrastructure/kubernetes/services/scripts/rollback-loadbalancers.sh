#!/bin/bash

# LoadBalancer Rollback Script
# Purpose: Emergency rollback for LoadBalancer deletion
# Date: 2025-09-23

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKUP_DIR="./loadbalancer-backups"

echo "================================================"
echo "LoadBalancer Rollback Script"
echo "================================================"

# Function to list available backups
list_backups() {
    echo -e "${BLUE}Available backups:${NC}"
    if [ -d "$BACKUP_DIR" ]; then
        ls -la "$BACKUP_DIR"/*.yaml 2>/dev/null || echo "No backup files found"
    else
        echo "No backup directory found"
        exit 1
    fi
}

# Function to restore from backup
restore_backup() {
    local backup_file=$1
    
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}Backup file not found: $backup_file${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Restoring from: $backup_file${NC}"
    
    # Apply the backup
    if kubectl apply -f "$backup_file"; then
        echo -e "${GREEN}Backup restored successfully${NC}"
    else
        echo -e "${RED}Failed to restore backup${NC}"
        exit 1
    fi
}

# Function to manually recreate services
manual_restore() {
    echo -e "${YELLOW}Manual restoration of LoadBalancer services${NC}"
    
    # Create temporary YAML files for recreation
    cat > /tmp/kamailio-tcp-warp-core.yaml <<EOF
apiVersion: v1
kind: Service
metadata:
  name: kamailio-sip-tcp
  namespace: warp-core
  labels:
    app: kamailio
    component: sip
spec:
  type: LoadBalancer
  ports:
  - name: sip-tcp
    port: 5060
    targetPort: 5060
    protocol: TCP
  - name: sip-tls
    port: 5061
    targetPort: 5061
    protocol: TCP
  selector:
    app: kamailio
    deployment: kamailio
EOF

    cat > /tmp/kamailio-udp-warp-core.yaml <<EOF
apiVersion: v1
kind: Service
metadata:
  name: kamailio-sip-udp
  namespace: warp-core
  labels:
    app: kamailio
    component: sip
spec:
  type: LoadBalancer
  ports:
  - name: sip-udp
    port: 5060
    targetPort: 5060
    protocol: UDP
  selector:
    app: kamailio
    deployment: kamailio
EOF

    echo "Which services do you want to restore?"
    echo "1) kamailio-sip-tcp in warp-core"
    echo "2) kamailio-sip-udp in warp-core"
    echo "3) Both Kamailio services"
    echo "4) Cancel"
    
    read -p "Select option (1-4): " choice
    
    case $choice in
        1)
            kubectl apply -f /tmp/kamailio-tcp-warp-core.yaml
            ;;
        2)
            kubectl apply -f /tmp/kamailio-udp-warp-core.yaml
            ;;
        3)
            kubectl apply -f /tmp/kamailio-tcp-warp-core.yaml
            kubectl apply -f /tmp/kamailio-udp-warp-core.yaml
            ;;
        4)
            echo "Cancelled"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            exit 1
            ;;
    esac
    
    # Cleanup temp files
    rm -f /tmp/kamailio-tcp-warp-core.yaml /tmp/kamailio-udp-warp-core.yaml
}

# Main menu
echo "Rollback Options:"
echo "1) Restore from backup file"
echo "2) Manual recreation of specific services"
echo "3) List available backups"
echo "4) Exit"

read -p "Select option (1-4): " option

case $option in
    1)
        list_backups
        echo ""
        read -p "Enter full path to backup file: " backup_file
        restore_backup "$backup_file"
        ;;
    2)
        manual_restore
        ;;
    3)
        list_backups
        ;;
    4)
        echo "Exiting"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

# Verify current state
echo -e "\n${BLUE}Current LoadBalancer services:${NC}"
kubectl get svc --all-namespaces | grep LoadBalancer

echo -e "\n${GREEN}Rollback complete!${NC}"