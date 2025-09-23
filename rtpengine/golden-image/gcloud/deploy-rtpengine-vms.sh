#!/bin/bash

# Script to deploy RTPEngine VMs from golden image
# Project: ringer-warp-v01
# Deploys: warp-rtpengine-1, warp-rtpengine-2, warp-rtpengine-3

set -e

# Configuration
PROJECT_ID="ringer-warp-v01"
REGION="us-central1"
IMAGE_FAMILY="rtpengine-golden"
MACHINE_TYPE="e2-standard-4"
BOOT_DISK_SIZE="50GB"
BOOT_DISK_TYPE="pd-standard"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}RTPEngine VM Deployment Script${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Function to check if image family exists
check_image_family() {
    local latest_image=$(gcloud compute images describe-from-family "$IMAGE_FAMILY" \
        --project="$PROJECT_ID" \
        --format="value(name)" 2>/dev/null || echo "")
    
    if [[ -z "$latest_image" ]]; then
        echo -e "${RED}Error: No images found in family $IMAGE_FAMILY${NC}"
        echo "Please create a golden image first using create-golden-image.sh"
        exit 1
    fi
    
    echo "$latest_image"
}

# Function to check if VM exists
vm_exists() {
    local vm_name=$1
    local zone=$2
    gcloud compute instances describe "$vm_name" \
        --zone="$zone" \
        --project="$PROJECT_ID" \
        --format="value(name)" 2>/dev/null || echo ""
}

# Function to create VM
create_vm() {
    local vm_name=$1
    local zone=$2
    local internal_ip=$3
    local instance_num=$4
    
    echo ""
    echo -e "${YELLOW}Creating VM: $vm_name${NC}"
    echo "  Zone: $zone"
    echo "  Internal IP: $internal_ip"
    
    # Check if VM already exists
    if [[ -n $(vm_exists "$vm_name" "$zone") ]]; then
        echo -e "${RED}VM $vm_name already exists in zone $zone${NC}"
        read -p "Do you want to delete and recreate it? (yes/no): " recreate
        if [[ "$recreate" == "yes" ]]; then
            echo "Deleting existing VM..."
            gcloud compute instances delete "$vm_name" \
                --zone="$zone" \
                --project="$PROJECT_ID" \
                --quiet
            echo -e "${GREEN}✓ Existing VM deleted${NC}"
            sleep 5
        else
            echo "Skipping $vm_name"
            return
        fi
    fi
    
    # Create startup script for this specific instance
    local STARTUP_SCRIPT="#!/bin/bash
# Instance-specific startup script
echo 'Starting RTPEngine instance $instance_num configuration...'

# Set hostname
hostnamectl set-hostname $vm_name

# Update RTPEngine configuration with instance-specific settings
if [ -f /etc/rtpengine/rtpengine.conf ]; then
    # Update interface IP if needed
    sed -i \"s/interface = .*/interface = $internal_ip/g\" /etc/rtpengine/rtpengine.conf
    
    # Set instance-specific ports
    PORT_MIN=\$((10000 + (($instance_num - 1) * 3333)))
    PORT_MAX=\$((PORT_MIN + 3332))
    sed -i \"s/port-min = .*/port-min = \$PORT_MIN/g\" /etc/rtpengine/rtpengine.conf
    sed -i \"s/port-max = .*/port-max = \$PORT_MAX/g\" /etc/rtpengine/rtpengine.conf
fi

# Restart RTPEngine if installed
systemctl restart rtpengine || true

# Log completion
echo \"RTPEngine instance $instance_num configured at \$(date)\" >> /var/log/rtpengine-deploy.log
"
    
    # Create the VM
    gcloud compute instances create "$vm_name" \
        --project="$PROJECT_ID" \
        --zone="$zone" \
        --machine-type="$MACHINE_TYPE" \
        --network-interface=network-tier=PREMIUM,subnet=default,private-network-ip="$internal_ip" \
        --maintenance-policy=MIGRATE \
        --provisioning-model=STANDARD \
        --service-account="$(gcloud config get-value project 2>/dev/null)-compute@developer.gserviceaccount.com" \
        --scopes=https://www.googleapis.com/auth/cloud-platform \
        --tags=rtpengine,allow-ssh,allow-rtpengine-ports \
        --create-disk=auto-delete=yes,boot=yes,device-name="$vm_name",image-family="$IMAGE_FAMILY",image-project="$PROJECT_ID",mode=rw,size="$BOOT_DISK_SIZE",type=projects/"$PROJECT_ID"/zones/"$zone"/diskTypes/"$BOOT_DISK_TYPE" \
        --shielded-secure-boot \
        --shielded-vtpm \
        --shielded-integrity-monitoring \
        --reservation-affinity=any \
        --metadata=startup-script="$STARTUP_SCRIPT",enable-oslogin=TRUE,serial-port-enable=TRUE \
        --labels=environment=production,service=rtpengine,instance="$instance_num" \
        --description="RTPEngine production instance $instance_num"
    
    echo -e "${GREEN}✓ VM $vm_name created successfully${NC}"
}

# Check for golden image
echo -e "${YELLOW}Checking for golden image...${NC}"
LATEST_IMAGE=$(check_image_family)
echo -e "${GREEN}✓ Found golden image: $LATEST_IMAGE${NC}"

# Show deployment plan
echo ""
echo -e "${BLUE}Deployment Plan:${NC}"
echo "┌─────────────────────────────────────────────┐"
echo "│ VM Name           │ Zone          │ Internal IP │"
echo "├─────────────────────────────────────────────┤"
echo "│ warp-rtpengine-1  │ us-central1-a │ 10.128.0.20 │"
echo "│ warp-rtpengine-2  │ us-central1-b │ 10.128.0.21 │"
echo "│ warp-rtpengine-3  │ us-central1-c │ 10.128.0.22 │"
echo "└─────────────────────────────────────────────┘"
echo ""
echo "Machine Type: $MACHINE_TYPE (4 vCPUs, 16GB RAM)"
echo "Image: $LATEST_IMAGE"
echo ""

# Confirm deployment
read -p "Do you want to proceed with the deployment? (yes/no): " confirm
if [[ "$confirm" != "yes" ]]; then
    echo -e "${YELLOW}Deployment cancelled.${NC}"
    exit 0
fi

# Deploy VMs
echo ""
echo -e "${YELLOW}Starting deployment...${NC}"

create_vm "warp-rtpengine-1" "us-central1-a" "10.128.0.20" "1"
create_vm "warp-rtpengine-2" "us-central1-b" "10.128.0.21" "2"
create_vm "warp-rtpengine-3" "us-central1-c" "10.128.0.22" "3"

# Create or update instance group (optional)
echo ""
echo -e "${YELLOW}Creating/updating instance groups...${NC}"

for i in 1 2 3; do
    zone_suffix=""
    case $i in
        1) zone_suffix="a" ;;
        2) zone_suffix="b" ;;
        3) zone_suffix="c" ;;
    esac
    
    zone="${REGION}-${zone_suffix}"
    instance_group="rtpengine-ig-${zone}"
    
    # Check if instance group exists
    if ! gcloud compute instance-groups unmanaged describe "$instance_group" \
        --zone="$zone" \
        --project="$PROJECT_ID" 2>/dev/null; then
        
        # Create instance group
        gcloud compute instance-groups unmanaged create "$instance_group" \
            --zone="$zone" \
            --project="$PROJECT_ID" \
            --description="RTPEngine instance group for zone $zone"
    fi
    
    # Add instance to group
    gcloud compute instance-groups unmanaged add-instances "$instance_group" \
        --instances="warp-rtpengine-${i}" \
        --zone="$zone" \
        --project="$PROJECT_ID" || true
done

echo -e "${GREEN}✓ Instance groups configured${NC}"

# Wait for VMs to be ready
echo ""
echo -e "${YELLOW}Waiting for VMs to be ready...${NC}"
sleep 30

# Display VM information
echo ""
echo -e "${BLUE}Deployed VMs:${NC}"
echo ""

for i in 1 2 3; do
    zone_suffix=""
    case $i in
        1) zone_suffix="a" ;;
        2) zone_suffix="b" ;;
        3) zone_suffix="c" ;;
    esac
    
    zone="${REGION}-${zone_suffix}"
    vm_name="warp-rtpengine-${i}"
    
    EXTERNAL_IP=$(gcloud compute instances describe "$vm_name" \
        --zone="$zone" \
        --project="$PROJECT_ID" \
        --format="value(networkInterfaces[0].accessConfigs[0].natIP)" 2>/dev/null || echo "N/A")
    
    INTERNAL_IP=$(gcloud compute instances describe "$vm_name" \
        --zone="$zone" \
        --project="$PROJECT_ID" \
        --format="value(networkInterfaces[0].networkIP)" 2>/dev/null || echo "N/A")
    
    STATUS=$(gcloud compute instances describe "$vm_name" \
        --zone="$zone" \
        --project="$PROJECT_ID" \
        --format="value(status)" 2>/dev/null || echo "UNKNOWN")
    
    echo "VM: $vm_name"
    echo "  Status: $STATUS"
    echo "  Zone: $zone"
    echo "  Internal IP: $INTERNAL_IP"
    echo "  External IP: $EXTERNAL_IP"
    echo ""
done

# Create health check script
echo -e "${YELLOW}Creating health check script...${NC}"

cat > /home/daldworth/repos/ringer-warp/rtpengine/golden-image/gcloud/check-rtpengine-health.sh << 'EOF'
#!/bin/bash

# Health check script for RTPEngine instances

PROJECT_ID="ringer-warp-v01"
REGION="us-central1"

echo "RTPEngine Instance Health Check"
echo "==============================="
echo ""

for i in 1 2 3; do
    zone_suffix=""
    case $i in
        1) zone_suffix="a" ;;
        2) zone_suffix="b" ;;
        3) zone_suffix="c" ;;
    esac
    
    zone="${REGION}-${zone_suffix}"
    vm_name="warp-rtpengine-${i}"
    
    echo "Checking $vm_name..."
    
    # Check VM status
    STATUS=$(gcloud compute instances describe "$vm_name" \
        --zone="$zone" \
        --project="$PROJECT_ID" \
        --format="value(status)" 2>/dev/null || echo "NOT_FOUND")
    
    if [[ "$STATUS" == "RUNNING" ]]; then
        echo "  ✓ VM Status: RUNNING"
        
        # Try to check RTPEngine service (requires SSH access)
        if gcloud compute ssh "$vm_name" \
            --zone="$zone" \
            --project="$PROJECT_ID" \
            --command="systemctl is-active rtpengine" 2>/dev/null | grep -q "active"; then
            echo "  ✓ RTPEngine: ACTIVE"
        else
            echo "  ✗ RTPEngine: NOT ACTIVE or NOT INSTALLED"
        fi
    else
        echo "  ✗ VM Status: $STATUS"
    fi
    echo ""
done
EOF

chmod +x /home/daldworth/repos/ringer-warp/rtpengine/golden-image/gcloud/check-rtpengine-health.sh

echo -e "${GREEN}✓ Health check script created${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "All RTPEngine VMs have been deployed successfully!"
echo ""
echo "Next steps:"
echo "1. SSH into each VM to verify RTPEngine is running"
echo "2. Configure load balancing if needed"
echo "3. Update DNS records to point to the instances"
echo "4. Run ./check-rtpengine-health.sh to verify health"
echo ""
echo "SSH commands:"
echo "  gcloud compute ssh warp-rtpengine-1 --zone=us-central1-a --project=$PROJECT_ID"
echo "  gcloud compute ssh warp-rtpengine-2 --zone=us-central1-b --project=$PROJECT_ID"
echo "  gcloud compute ssh warp-rtpengine-3 --zone=us-central1-c --project=$PROJECT_ID"
echo ""