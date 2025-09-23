#!/bin/bash
# Script to recreate Consul and RTPEngine VMs without "dev" in names

set -e

PROJECT_ID="ringer-472421"
REGION="us-central1"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}WARP Compute VM Migration Script${NC}"
echo "================================="
echo "This script will create new VMs without 'dev' in their names"
echo ""

# Function to create Consul server
create_consul_server() {
    local zone=$1
    local server_num=$2
    local old_name="warp-dev-consul-server-${server_num}"
    local new_name="warp-consul-server-${server_num}"
    
    echo -e "${YELLOW}Creating ${new_name} in ${zone}...${NC}"
    
    # Get the old instance details for reference
    local machine_type=$(gcloud compute instances describe ${old_name} --zone=${zone} --format="value(machineType.scope())")
    local subnet=$(gcloud compute instances describe ${old_name} --zone=${zone} --format="value(networkInterfaces[0].subnetwork.scope())")
    local disk_size=$(gcloud compute instances describe ${old_name} --zone=${zone} --format="value(disks[0].diskSizeGb)")
    
    # Create new instance
    gcloud compute instances create ${new_name} \
        --zone=${zone} \
        --machine-type=${machine_type:-n2-standard-2} \
        --network-interface=subnet=${subnet:-default},no-address \
        --boot-disk-size=${disk_size:-20GB} \
        --boot-disk-type=pd-standard \
        --boot-disk-device-name=${new_name} \
        --tags=consul-server,warp \
        --image-family=ubuntu-2204-lts \
        --image-project=ubuntu-os-cloud \
        --metadata=startup-script='#!/bin/bash
# Install Consul
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
sudo apt-get update && sudo apt-get install consul
' \
        --project=${PROJECT_ID}
    
    echo -e "${GREEN}✓ Created ${new_name}${NC}"
}

# Function to create RTPEngine instance
create_rtpengine() {
    local zone=$1
    local instance_num=$2
    local old_name="warp-dev-rtpengine-${instance_num}"
    local new_name="warp-rtpengine-${instance_num}"
    
    echo -e "${YELLOW}Creating ${new_name} in ${zone}...${NC}"
    
    # Get the old instance details
    local machine_type=$(gcloud compute instances describe ${old_name} --zone=${zone} --format="value(machineType.scope())")
    local external_ip=$(gcloud compute instances describe ${old_name} --zone=${zone} --format="value(networkInterfaces[0].accessConfigs[0].natIP)")
    
    # Create new instance with external IP
    gcloud compute instances create ${new_name} \
        --zone=${zone} \
        --machine-type=${machine_type:-n2-standard-2} \
        --network-interface=subnet=default,address=${external_ip} \
        --boot-disk-size=20GB \
        --boot-disk-type=pd-standard \
        --boot-disk-device-name=${new_name} \
        --tags=rtpengine,warp,sip \
        --image-family=ubuntu-2204-lts \
        --image-project=ubuntu-os-cloud \
        --metadata=startup-script='#!/bin/bash
# Install RTPEngine dependencies
apt-get update
apt-get install -y build-essential git debhelper iptables-dev libavcodec-dev libavfilter-dev \
    libavformat-dev libavutil-dev libcurl4-openssl-dev libevent-dev libglib2.0-dev \
    libhiredis-dev libjson-glib-dev libpcap-dev libssl-dev libxmlrpc-core-c3-dev \
    markdown zlib1g-dev
' \
        --project=${PROJECT_ID}
    
    echo -e "${GREEN}✓ Created ${new_name}${NC}"
}

# Option to create without deleting old ones first
echo -e "${YELLOW}Creating new instances...${NC}"
echo "Note: Old instances will remain running until manually deleted"
echo ""

# Create Consul servers
create_consul_server "us-central1-a" "1"
create_consul_server "us-central1-b" "2" 
create_consul_server "us-central1-c" "3"

# Create RTPEngine instances
echo -e "\n${YELLOW}Note: RTPEngine instances need static IPs. Checking if we can reserve the existing IPs...${NC}"

# Check if we can use the same IPs
IP1="34.45.176.142"
IP2="130.211.233.219"

# Try to reserve the IPs first
echo "Attempting to reserve existing RTPEngine IPs..."
gcloud compute addresses create warp-rtpengine-ip-1 --addresses=${IP1} --region=${REGION} --project=${PROJECT_ID} 2>/dev/null || echo "IP ${IP1} already in use or reserved"
gcloud compute addresses create warp-rtpengine-ip-2 --addresses=${IP2} --region=${REGION} --project=${PROJECT_ID} 2>/dev/null || echo "IP ${IP2} already in use or reserved"

# Create RTPEngine instances
create_rtpengine "us-central1-a" "1"
create_rtpengine "us-central1-b" "2"

echo -e "\n${GREEN}✅ New instances created successfully!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Configure Consul cluster on new servers"
echo "2. Test RTPEngine on new instances"
echo "3. Update any configurations pointing to old instance names"
echo "4. Delete old instances with:"
echo ""
echo "   gcloud compute instances delete warp-dev-consul-server-1 --zone=us-central1-a --quiet"
echo "   gcloud compute instances delete warp-dev-consul-server-2 --zone=us-central1-b --quiet"
echo "   gcloud compute instances delete warp-dev-consul-server-3 --zone=us-central1-c --quiet"
echo "   gcloud compute instances delete warp-dev-rtpengine-1 --zone=us-central1-a --quiet"
echo "   gcloud compute instances delete warp-dev-rtpengine-2 --zone=us-central1-b --quiet"