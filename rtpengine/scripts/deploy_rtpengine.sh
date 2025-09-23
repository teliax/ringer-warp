#!/bin/bash
# Main deployment script for RTPEngine
# This script orchestrates the full deployment process

set -e

# Configuration
RTPENGINE_VMS=(
    "34.123.38.31"
    "35.222.101.214"
    "35.225.65.80"
)

SSH_USER="debian"  # Change this to your SSH user
SSH_KEY="~/.ssh/id_rsa"  # Path to your SSH key

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "========================================="
echo "RTPEngine Deployment Script"
echo "========================================="
echo -e "${BLUE}Target VMs:${NC}"
for vm in "${RTPENGINE_VMS[@]}"; do
    echo "  - $vm"
done
echo "========================================="

# Function to deploy to a single VM
deploy_to_vm() {
    local VM_IP=$1
    local VM_INDEX=$2
    
    echo -e "\n${YELLOW}Deploying to VM${VM_INDEX}: ${VM_IP}${NC}"
    
    # Check SSH connectivity
    echo -n "Checking SSH connectivity... "
    if ssh -o ConnectTimeout=5 -i ${SSH_KEY} ${SSH_USER}@${VM_IP} "echo connected" > /dev/null 2>&1; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
        echo "Cannot connect to ${VM_IP}. Check SSH access and try again."
        return 1
    fi
    
    # Create remote directory
    echo "Creating remote directories..."
    ssh -i ${SSH_KEY} ${SSH_USER}@${VM_IP} "sudo mkdir -p /opt/rtpengine-install"
    
    # Copy installation files
    echo "Copying installation files..."
    scp -i ${SSH_KEY} scripts/install_rtpengine.sh ${SSH_USER}@${VM_IP}:/tmp/
    scp -i ${SSH_KEY} scripts/configure_firewall.sh ${SSH_USER}@${VM_IP}:/tmp/
    scp -i ${SSH_KEY} config/rtpengine-vm${VM_INDEX}.conf ${SSH_USER}@${VM_IP}:/tmp/rtpengine.conf
    scp -i ${SSH_KEY} systemd/rtpengine.service ${SSH_USER}@${VM_IP}:/tmp/
    
    # Make scripts executable
    ssh -i ${SSH_KEY} ${SSH_USER}@${VM_IP} "chmod +x /tmp/*.sh"
    
    # Run installation
    echo "Running installation script..."
    ssh -i ${SSH_KEY} ${SSH_USER}@${VM_IP} "sudo /tmp/install_rtpengine.sh"
    
    # Copy configuration files
    echo "Installing configuration files..."
    ssh -i ${SSH_KEY} ${SSH_USER}@${VM_IP} "sudo cp /tmp/rtpengine.conf /etc/rtpengine/"
    ssh -i ${SSH_KEY} ${SSH_USER}@${VM_IP} "sudo cp /tmp/rtpengine.service /etc/systemd/system/"
    
    # Configure firewall
    echo "Configuring firewall..."
    ssh -i ${SSH_KEY} ${SSH_USER}@${VM_IP} "sudo /tmp/configure_firewall.sh"
    
    # Generate SSL certificates for DTLS
    echo "Generating SSL certificates..."
    ssh -i ${SSH_KEY} ${SSH_USER}@${VM_IP} "sudo openssl req -x509 -newkey rsa:2048 -keyout /etc/rtpengine/key.pem -out /etc/rtpengine/cert.pem -days 365 -nodes -subj '/CN=rtpengine.example.com'"
    ssh -i ${SSH_KEY} ${SSH_USER}@${VM_IP} "sudo chown rtpengine:rtpengine /etc/rtpengine/*.pem"
    
    # Reload systemd and start service
    echo "Starting RTPEngine service..."
    ssh -i ${SSH_KEY} ${SSH_USER}@${VM_IP} "sudo systemctl daemon-reload"
    ssh -i ${SSH_KEY} ${SSH_USER}@${VM_IP} "sudo systemctl enable rtpengine"
    ssh -i ${SSH_KEY} ${SSH_USER}@${VM_IP} "sudo systemctl start rtpengine"
    
    # Check service status
    echo "Checking service status..."
    ssh -i ${SSH_KEY} ${SSH_USER}@${VM_IP} "sudo systemctl status rtpengine --no-pager"
    
    echo -e "${GREEN}Deployment to VM${VM_INDEX} completed!${NC}"
}

# Main deployment loop
echo -e "\n${YELLOW}Starting deployment process...${NC}"

for i in "${!RTPENGINE_VMS[@]}"; do
    VM_INDEX=$((i + 1))
    deploy_to_vm "${RTPENGINE_VMS[$i]}" "$VM_INDEX"
done

echo -e "\n${GREEN}All deployments completed!${NC}"
echo -e "\n${BLUE}Next steps:${NC}"
echo "1. Update Kamailio configuration with RTPEngine endpoints"
echo "2. Configure Redis for session sharing (if using HA setup)"
echo "3. Set up monitoring (Prometheus/Grafana)"
echo "4. Test media relay functionality"
echo -e "\n${YELLOW}Useful commands:${NC}"
echo "- Check status: sudo systemctl status rtpengine"
echo "- View logs: sudo journalctl -u rtpengine -f"
echo "- CLI access: sudo rtpengine-ctl list"
echo "- Test call: rtpengine-ctl call offer"