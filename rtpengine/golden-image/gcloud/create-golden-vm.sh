#!/bin/bash

# Script to create a new golden VM for RTPEngine
# Project: ringer-warp-v01
# VM Name: warp-rtpengine-golden
# Machine Type: e2-standard-4 (4 vCPUs, 16GB RAM)

set -e

# Configuration
PROJECT_ID="ringer-warp-v01"
REGION="us-central1"
ZONE="${REGION}-a"
VM_NAME="warp-rtpengine-golden"
MACHINE_TYPE="e2-standard-4"
IMAGE_FAMILY="ubuntu-2004-lts"
IMAGE_PROJECT="ubuntu-os-cloud"
BOOT_DISK_SIZE="50GB"
BOOT_DISK_TYPE="pd-standard"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Golden VM Creation Script${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Check if VM already exists
if gcloud compute instances describe "$VM_NAME" \
    --zone="$ZONE" \
    --project="$PROJECT_ID" \
    --format="value(name)" 2>/dev/null; then
    echo -e "${RED}Error: VM $VM_NAME already exists!${NC}"
    echo "Please delete it first or use a different name."
    exit 1
fi

# Create the startup script
STARTUP_SCRIPT='#!/bin/bash
# Update and upgrade system
apt-get update
apt-get upgrade -y

# Install essential packages
apt-get install -y \
    build-essential \
    git \
    curl \
    wget \
    vim \
    htop \
    net-tools \
    tcpdump \
    iptables-persistent \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release

# Install Docker (for potential containerized deployment)
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io

# Add kernel modules for RTPEngine
cat >> /etc/modules << EOF
xt_RTPENGINE
EOF

# Create RTPEngine user
useradd -r -s /bin/false rtpengine || true

# Create necessary directories
mkdir -p /etc/rtpengine
mkdir -p /var/log/rtpengine
mkdir -p /var/run/rtpengine
chown rtpengine:rtpengine /var/log/rtpengine /var/run/rtpengine

# Set up basic iptables rules
iptables -A INPUT -p udp --dport 10000:20000 -j ACCEPT
iptables -A INPUT -p tcp --dport 22222 -j ACCEPT
iptables -A INPUT -p tcp --dport 2223 -j ACCEPT
iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
netfilter-persistent save

# Enable IP forwarding
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p

# Create marker file
touch /var/log/golden-vm-setup-complete

echo "Golden VM initial setup complete!"'

echo -e "${YELLOW}Creating firewall rules...${NC}"

# Create firewall rules if they don't exist
echo "Checking/creating firewall rule: allow-rtpengine-rtp"
if ! gcloud compute firewall-rules describe allow-rtpengine-rtp \
    --project="$PROJECT_ID" 2>/dev/null; then
    gcloud compute firewall-rules create allow-rtpengine-rtp \
        --project="$PROJECT_ID" \
        --direction=INGRESS \
        --priority=1000 \
        --network=default \
        --action=ALLOW \
        --rules=udp:10000-20000 \
        --source-ranges=0.0.0.0/0 \
        --target-tags=rtpengine \
        --description="Allow RTP traffic for RTPEngine"
    echo -e "${GREEN}✓ Created firewall rule: allow-rtpengine-rtp${NC}"
else
    echo -e "${GREEN}✓ Firewall rule already exists: allow-rtpengine-rtp${NC}"
fi

echo "Checking/creating firewall rule: allow-rtpengine-control"
if ! gcloud compute firewall-rules describe allow-rtpengine-control \
    --project="$PROJECT_ID" 2>/dev/null; then
    gcloud compute firewall-rules create allow-rtpengine-control \
        --project="$PROJECT_ID" \
        --direction=INGRESS \
        --priority=1000 \
        --network=default \
        --action=ALLOW \
        --rules=tcp:22222,tcp:2223 \
        --source-ranges=10.128.0.0/20 \
        --target-tags=rtpengine \
        --description="Allow control ports for RTPEngine"
    echo -e "${GREEN}✓ Created firewall rule: allow-rtpengine-control${NC}"
else
    echo -e "${GREEN}✓ Firewall rule already exists: allow-rtpengine-control${NC}"
fi

echo "Checking/creating firewall rule: allow-rtpengine-websocket"
if ! gcloud compute firewall-rules describe allow-rtpengine-websocket \
    --project="$PROJECT_ID" 2>/dev/null; then
    gcloud compute firewall-rules create allow-rtpengine-websocket \
        --project="$PROJECT_ID" \
        --direction=INGRESS \
        --priority=1000 \
        --network=default \
        --action=ALLOW \
        --rules=tcp:8080 \
        --source-ranges=0.0.0.0/0 \
        --target-tags=rtpengine \
        --description="Allow WebSocket for WebRTC"
    echo -e "${GREEN}✓ Created firewall rule: allow-rtpengine-websocket${NC}"
else
    echo -e "${GREEN}✓ Firewall rule already exists: allow-rtpengine-websocket${NC}"
fi

echo ""
echo -e "${YELLOW}Creating golden VM: $VM_NAME${NC}"
echo "Configuration:"
echo "  - Machine Type: $MACHINE_TYPE (4 vCPUs, 16GB RAM)"
echo "  - Zone: $ZONE"
echo "  - Boot Disk: $BOOT_DISK_SIZE $BOOT_DISK_TYPE"
echo "  - Image: $IMAGE_FAMILY from $IMAGE_PROJECT"
echo ""

# Create the VM
gcloud compute instances create "$VM_NAME" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type="$MACHINE_TYPE" \
    --network-interface=network-tier=PREMIUM,subnet=default \
    --maintenance-policy=MIGRATE \
    --provisioning-model=STANDARD \
    --service-account="$(gcloud config get-value project 2>/dev/null)-compute@developer.gserviceaccount.com" \
    --scopes=https://www.googleapis.com/auth/cloud-platform \
    --tags=rtpengine,allow-ssh,allow-rtpengine-ports \
    --create-disk=auto-delete=yes,boot=yes,device-name="$VM_NAME",image=projects/"$IMAGE_PROJECT"/global/images/family/"$IMAGE_FAMILY",mode=rw,size="$BOOT_DISK_SIZE",type=projects/"$PROJECT_ID"/zones/"$ZONE"/diskTypes/"$BOOT_DISK_TYPE" \
    --shielded-secure-boot \
    --shielded-vtpm \
    --shielded-integrity-monitoring \
    --reservation-affinity=any \
    --metadata=startup-script="$STARTUP_SCRIPT",enable-oslogin=TRUE \
    --labels=environment=golden,service=rtpengine,purpose=template \
    --description="Golden image VM for RTPEngine deployment"

echo ""
echo -e "${GREEN}✓ VM created successfully!${NC}"
echo ""

# Wait for VM to be ready
echo -e "${YELLOW}Waiting for VM to be ready...${NC}"
sleep 30

# Get VM details
EXTERNAL_IP=$(gcloud compute instances describe "$VM_NAME" \
    --zone="$ZONE" \
    --project="$PROJECT_ID" \
    --format="value(networkInterfaces[0].accessConfigs[0].natIP)")

INTERNAL_IP=$(gcloud compute instances describe "$VM_NAME" \
    --zone="$ZONE" \
    --project="$PROJECT_ID" \
    --format="value(networkInterfaces[0].networkIP)")

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Golden VM Creation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "VM Details:"
echo "  - Name: $VM_NAME"
echo "  - External IP: $EXTERNAL_IP"
echo "  - Internal IP: $INTERNAL_IP"
echo "  - Zone: $ZONE"
echo ""
echo "Next steps:"
echo "1. SSH into the VM: gcloud compute ssh $VM_NAME --zone=$ZONE --project=$PROJECT_ID"
echo "2. Install and configure RTPEngine"
echo "3. Run create-golden-image.sh when ready"
echo ""
echo "To check startup script progress:"
echo "  gcloud compute instances get-serial-port-output $VM_NAME --zone=$ZONE --project=$PROJECT_ID"
echo ""