#!/bin/bash

# Script to create a golden image from the configured RTPEngine VM
# Project: ringer-warp-v01
# Source VM: warp-rtpengine-golden

set -e

# Configuration
PROJECT_ID="ringer-warp-v01"
REGION="us-central1"
ZONE="${REGION}-a"
SOURCE_VM="warp-rtpengine-golden"
IMAGE_NAME="rtpengine-golden-image-$(date +%Y%m%d-%H%M%S)"
IMAGE_FAMILY="rtpengine-golden"
DESCRIPTION="Golden image for RTPEngine deployment created on $(date)"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Golden Image Creation Script${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Check if source VM exists
if ! gcloud compute instances describe "$SOURCE_VM" \
    --zone="$ZONE" \
    --project="$PROJECT_ID" \
    --format="value(name)" 2>/dev/null; then
    echo -e "${RED}Error: Source VM $SOURCE_VM does not exist!${NC}"
    echo "Please create the golden VM first using create-golden-vm.sh"
    exit 1
fi

# Get VM status
VM_STATUS=$(gcloud compute instances describe "$SOURCE_VM" \
    --zone="$ZONE" \
    --project="$PROJECT_ID" \
    --format="value(status)")

echo "Source VM: $SOURCE_VM"
echo "Status: $VM_STATUS"
echo ""

# Pre-image creation checklist
echo -e "${BLUE}Pre-image creation checklist:${NC}"
echo "Please confirm the following steps have been completed on the golden VM:"
echo ""
echo "  [ ] RTPEngine is installed and configured"
echo "  [ ] All required dependencies are installed"
echo "  [ ] System is updated (apt update && apt upgrade)"
echo "  [ ] Unnecessary packages are removed"
echo "  [ ] Logs are cleaned (/var/log/)"
echo "  [ ] Temporary files are removed (/tmp/)"
echo "  [ ] SSH host keys are regenerated (optional)"
echo "  [ ] Cloud-init is configured for new instances"
echo ""
read -p "Have all the above steps been completed? (yes/no): " confirmation

if [[ "$confirmation" != "yes" ]]; then
    echo -e "${YELLOW}Image creation cancelled.${NC}"
    exit 0
fi

# Stop the VM if it's running
if [[ "$VM_STATUS" == "RUNNING" ]]; then
    echo ""
    echo -e "${YELLOW}Stopping VM $SOURCE_VM for image creation...${NC}"
    gcloud compute instances stop "$SOURCE_VM" \
        --zone="$ZONE" \
        --project="$PROJECT_ID"
    
    # Wait for VM to stop
    echo "Waiting for VM to stop..."
    while true; do
        STATUS=$(gcloud compute instances describe "$SOURCE_VM" \
            --zone="$ZONE" \
            --project="$PROJECT_ID" \
            --format="value(status)")
        if [[ "$STATUS" == "TERMINATED" ]]; then
            break
        fi
        echo -n "."
        sleep 5
    done
    echo ""
    echo -e "${GREEN}✓ VM stopped successfully${NC}"
fi

# Create preparation script
echo ""
echo -e "${YELLOW}Creating preparation script on the VM...${NC}"

PREP_SCRIPT='#!/bin/bash
# Preparation script for golden image

# Clean package cache
apt-get clean
apt-get autoremove -y

# Clear logs
find /var/log -type f -name "*.log" -exec truncate -s 0 {} \;
find /var/log -type f -name "*.gz" -delete
journalctl --vacuum-time=1s

# Clear bash history
history -c
cat /dev/null > ~/.bash_history

# Remove SSH host keys (will be regenerated on first boot)
rm -f /etc/ssh/ssh_host_*

# Clear machine-id (will be regenerated)
truncate -s 0 /etc/machine-id

# Remove cloud-init artifacts
cloud-init clean --logs

# Create first-boot script
cat > /etc/cloud/cloud.cfg.d/99_rtpengine.cfg << EOF
#cloud-config
runcmd:
  - dpkg-reconfigure openssh-server
  - systemctl restart ssh
  - systemctl restart rtpengine || true
  - echo "RTPEngine instance initialized at $(date)" >> /var/log/rtpengine-init.log
EOF

# Clear network configs that might conflict
rm -f /etc/netplan/50-cloud-init.yaml
rm -f /etc/udev/rules.d/70-persistent-net.rules

echo "Image preparation complete!"
'

# Get the source disk name
SOURCE_DISK=$(gcloud compute instances describe "$SOURCE_VM" \
    --zone="$ZONE" \
    --project="$PROJECT_ID" \
    --format="value(disks[0].source.scope(name))")

echo ""
echo -e "${YELLOW}Creating golden image...${NC}"
echo "Image name: $IMAGE_NAME"
echo "Image family: $IMAGE_FAMILY"
echo "Source disk: $SOURCE_DISK"
echo ""

# Create the image
gcloud compute images create "$IMAGE_NAME" \
    --project="$PROJECT_ID" \
    --family="$IMAGE_FAMILY" \
    --source-disk="$SOURCE_DISK" \
    --source-disk-zone="$ZONE" \
    --description="$DESCRIPTION" \
    --labels=type=golden,service=rtpengine,created="$(date +%Y%m%d)" \
    --storage-location="$REGION"

echo ""
echo -e "${GREEN}✓ Golden image created successfully!${NC}"

# Get image details
IMAGE_SIZE=$(gcloud compute images describe "$IMAGE_NAME" \
    --project="$PROJECT_ID" \
    --format="value(diskSizeGb)")

# List all images in the family
echo ""
echo -e "${YELLOW}Images in family $IMAGE_FAMILY:${NC}"
gcloud compute images list \
    --project="$PROJECT_ID" \
    --filter="family:$IMAGE_FAMILY" \
    --format="table(name,diskSizeGb,creationTimestamp)"

# Create deployment configuration
echo ""
echo -e "${YELLOW}Creating deployment configuration...${NC}"

cat > /home/daldworth/repos/ringer-warp/rtpengine/golden-image/gcloud/golden-image-config.txt << EOF
# Golden Image Configuration
# Generated on: $(date)

PROJECT_ID=$PROJECT_ID
REGION=$REGION
IMAGE_NAME=$IMAGE_NAME
IMAGE_FAMILY=$IMAGE_FAMILY
IMAGE_SIZE=${IMAGE_SIZE}GB
SOURCE_VM=$SOURCE_VM

# To deploy from this image, use:
# gcloud compute instances create [INSTANCE_NAME] \\
#     --project=$PROJECT_ID \\
#     --zone=[ZONE] \\
#     --machine-type=e2-standard-4 \\
#     --image=$IMAGE_NAME \\
#     --image-project=$PROJECT_ID

# Or use the latest image from family:
# --image-family=$IMAGE_FAMILY
EOF

echo -e "${GREEN}✓ Configuration saved to golden-image-config.txt${NC}"

# Restart the golden VM
echo ""
read -p "Do you want to restart the golden VM? (yes/no): " restart_confirm
if [[ "$restart_confirm" == "yes" ]]; then
    echo -e "${YELLOW}Starting golden VM...${NC}"
    gcloud compute instances start "$SOURCE_VM" \
        --zone="$ZONE" \
        --project="$PROJECT_ID"
    echo -e "${GREEN}✓ Golden VM started${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Golden Image Creation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Image Details:"
echo "  - Name: $IMAGE_NAME"
echo "  - Family: $IMAGE_FAMILY"
echo "  - Size: ${IMAGE_SIZE}GB"
echo "  - Location: $REGION"
echo ""
echo "Next steps:"
echo "1. Test the image by creating a test instance"
echo "2. Run deploy-rtpengine-vms.sh to deploy production VMs"
echo ""
echo "To create a test instance:"
echo "  gcloud compute instances create test-rtpengine \\"
echo "      --image=$IMAGE_NAME \\"
echo "      --image-project=$PROJECT_ID \\"
echo "      --machine-type=e2-standard-4 \\"
echo "      --zone=$ZONE"
echo ""