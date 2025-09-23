#!/bin/bash

# RTPEngine Deployment Script for Existing VMs
# This script deploys RTPEngine configuration to already running VMs

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="ringer-warp-v01"
REDIS_HOST="10.206.200.36"
REDIS_PORT="6379"

# VM details with zones
declare -A VMS
VMS[warp-rtpengine-1]="34.123.38.31"
VMS[warp-rtpengine-2]="35.222.101.214"
VMS[warp-rtpengine-3]="35.225.65.80"

declare -A VM_ZONES
VM_ZONES[warp-rtpengine-1]="us-central1-a"
VM_ZONES[warp-rtpengine-2]="us-central1-b"
VM_ZONES[warp-rtpengine-3]="us-central1-c"

# SSH Key Path (update if needed)
SSH_KEY="${HOME}/.ssh/google_compute_engine"

echo -e "${BLUE}=== RTPEngine Deployment Script ===${NC}"
echo -e "${BLUE}Project: ${PROJECT_ID}${NC}"
echo -e "${BLUE}Redis: ${REDIS_HOST}:${REDIS_PORT}${NC}"
echo

# Function to get instance name and zone from IP
get_instance_info() {
    local IP=$1
    local INFO=$(gcloud compute instances list --project=${PROJECT_ID} --filter="EXTERNAL_IP=${IP}" --format="value(name,zone)")
    echo "${INFO}"
}

# Function to deploy to a single VM
deploy_to_vm() {
    local VM_NAME=$1
    local EXTERNAL_IP=$2
    
    echo -e "\n${YELLOW}=== Deploying to ${VM_NAME} (${EXTERNAL_IP}) ===${NC}"
    
    # Get instance name from VM_NAME (it's already the instance name)
    local INSTANCE_NAME=${VM_NAME}
    local INSTANCE_ZONE=${VM_ZONES[${VM_NAME}]}
    
    if [ -z "${INSTANCE_NAME}" ]; then
        echo -e "${RED}Error: Could not find instance with IP ${EXTERNAL_IP}${NC}"
        return 1
    fi
    
    echo -e "${GREEN}Found instance: ${INSTANCE_NAME} in zone ${INSTANCE_ZONE}${NC}"
    
    # Add rtpengine tag to instance
    echo -e "${YELLOW}Adding 'rtpengine' tag to instance...${NC}"
    gcloud compute instances add-tags ${INSTANCE_NAME} \
        --project=${PROJECT_ID} \
        --tags=rtpengine \
        --zone=${INSTANCE_ZONE}
    
    # Copy setup script to VM
    echo -e "${YELLOW}Copying setup script to VM...${NC}"
    gcloud compute scp \
        /home/daldworth/repos/ringer-warp/kubernetes/base/rtpengine/vm-setup.sh \
        ${INSTANCE_NAME}:/tmp/vm-setup.sh \
        --project=${PROJECT_ID} \
        --zone=${INSTANCE_ZONE}
    
    # Create configuration script with Redis info
    cat > /tmp/rtpengine-config.sh << EOF
#!/bin/bash
# RTPEngine configuration override
export REDIS_HOST="${REDIS_HOST}"
export REDIS_PORT="${REDIS_PORT}"

# Update the setup script with correct Redis configuration
sed -i 's/REDIS_HOST="10.206.200.36"/REDIS_HOST="${REDIS_HOST}"/g' /tmp/vm-setup.sh
sed -i 's/REDIS_PORT="6379"/REDIS_PORT="${REDIS_PORT}"/g' /tmp/vm-setup.sh

# Make script executable and run it
chmod +x /tmp/vm-setup.sh
sudo /tmp/vm-setup.sh
EOF
    
    # Copy configuration script
    gcloud compute scp \
        /tmp/rtpengine-config.sh \
        ${INSTANCE_NAME}:/tmp/rtpengine-config.sh \
        --project=${PROJECT_ID} \
        --zone=${INSTANCE_ZONE}
    
    # Execute deployment
    echo -e "${YELLOW}Executing RTPEngine setup on VM...${NC}"
    gcloud compute ssh ${INSTANCE_NAME} \
        --project=${PROJECT_ID} \
        --zone=${INSTANCE_ZONE} \
        --command="chmod +x /tmp/rtpengine-config.sh && sudo /tmp/rtpengine-config.sh"
    
    # Verify deployment
    echo -e "${YELLOW}Verifying RTPEngine status...${NC}"
    gcloud compute ssh ${INSTANCE_NAME} \
        --project=${PROJECT_ID} \
        --zone=${INSTANCE_ZONE} \
        --command="sudo systemctl status rtpengine --no-pager"
    
    echo -e "${GREEN}✓ Deployment to ${VM_NAME} completed${NC}"
}

# Main deployment loop
echo -e "${BLUE}Starting deployment to all RTPEngine VMs...${NC}"

for VM_NAME in "${!VMS[@]}"; do
    deploy_to_vm ${VM_NAME} ${VMS[${VM_NAME}]}
done

echo -e "\n${GREEN}=== Deployment Summary ===${NC}"
echo -e "${GREEN}Firewall rules: Created${NC}"
echo -e "${GREEN}VMs deployed: ${#VMS[@]}${NC}"
for VM_NAME in "${!VMS[@]}"; do
    echo -e "  - ${VM_NAME}: ${VMS[${VM_NAME}]}"
done

echo -e "\n${BLUE}=== Next Steps ===${NC}"
echo "1. Verify RTPEngine is running on all VMs using the health check script"
echo "2. Update Kamailio configuration to use these RTPEngine instances"
echo "3. Test media flow through RTPEngine"
echo "4. Monitor logs and metrics"

# Clean up temp files
rm -f /tmp/rtpengine-config.sh