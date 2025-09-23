#!/bin/bash

# Script to safely delete corrupted RTPEngine VMs
# Project: ringer-warp-v01
# VMs: warp-rtpengine-1, warp-rtpengine-2, warp-rtpengine-3

set -e

PROJECT_ID="ringer-warp-v01"
REGION="us-central1"
ZONE="${REGION}-a"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}RTPEngine VM Deletion Script${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Function to check if VM exists
check_vm_exists() {
    local vm_name=$1
    gcloud compute instances describe "$vm_name" \
        --zone="$ZONE" \
        --project="$PROJECT_ID" \
        --format="value(name)" 2>/dev/null || echo ""
}

# Function to delete a VM
delete_vm() {
    local vm_name=$1
    
    echo -e "${YELLOW}Checking VM: $vm_name${NC}"
    
    if [[ -n $(check_vm_exists "$vm_name") ]]; then
        echo -e "${RED}VM $vm_name exists. Preparing to delete...${NC}"
        
        # Stop the VM first if it's running
        echo "Stopping VM $vm_name..."
        gcloud compute instances stop "$vm_name" \
            --zone="$ZONE" \
            --project="$PROJECT_ID" \
            --quiet 2>/dev/null || true
        
        # Wait for VM to stop
        sleep 5
        
        # Delete the VM
        echo "Deleting VM $vm_name..."
        gcloud compute instances delete "$vm_name" \
            --zone="$ZONE" \
            --project="$PROJECT_ID" \
            --quiet
        
        echo -e "${GREEN}✓ VM $vm_name deleted successfully${NC}"
    else
        echo -e "${GREEN}VM $vm_name does not exist (already deleted)${NC}"
    fi
    echo ""
}

# Confirm deletion
echo -e "${RED}WARNING: This script will delete the following VMs:${NC}"
echo "  - warp-rtpengine-1"
echo "  - warp-rtpengine-2"
echo "  - warp-rtpengine-3"
echo ""
read -p "Are you sure you want to proceed? (yes/no): " confirmation

if [[ "$confirmation" != "yes" ]]; then
    echo -e "${YELLOW}Deletion cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}Starting VM deletion process...${NC}"
echo ""

# Delete each VM
delete_vm "warp-rtpengine-1"
delete_vm "warp-rtpengine-2"
delete_vm "warp-rtpengine-3"

# Clean up any associated disks
echo -e "${YELLOW}Checking for orphaned disks...${NC}"
for i in 1 2 3; do
    disk_name="warp-rtpengine-${i}"
    if gcloud compute disks describe "$disk_name" \
        --zone="$ZONE" \
        --project="$PROJECT_ID" \
        --format="value(name)" 2>/dev/null; then
        
        echo "Deleting orphaned disk: $disk_name"
        gcloud compute disks delete "$disk_name" \
            --zone="$ZONE" \
            --project="$PROJECT_ID" \
            --quiet
        echo -e "${GREEN}✓ Disk $disk_name deleted${NC}"
    fi
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}VM deletion process completed!${NC}"
echo -e "${GREEN}========================================${NC}"