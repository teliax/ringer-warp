#!/bin/bash
# Configure firewall rules for RTPEngine

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================="
echo "RTPEngine Firewall Configuration"
echo "========================================="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}" 
   exit 1
fi

# Function to setup iptables rules
setup_iptables() {
    echo -e "\n${YELLOW}Setting up iptables rules...${NC}"
    
    # Allow RTPEngine control ports
    iptables -A INPUT -p udp --dport 22222 -j ACCEPT -m comment --comment "RTPEngine Control"
    iptables -A INPUT -p tcp --dport 22222 -j ACCEPT -m comment --comment "RTPEngine Control"
    iptables -A INPUT -p tcp --dport 22223 -j ACCEPT -m comment --comment "RTPEngine CLI"
    
    # Allow RTP/RTCP port range
    iptables -A INPUT -p udp --dport 30000:40000 -j ACCEPT -m comment --comment "RTP/RTCP Media"
    
    # Allow Prometheus metrics port
    iptables -A INPUT -p tcp --dport 9103 -j ACCEPT -m comment --comment "RTPEngine Prometheus"
    
    # Save iptables rules
    if command -v iptables-save > /dev/null; then
        iptables-save > /etc/iptables/rules.v4
        echo -e "${GREEN}iptables rules saved${NC}"
    fi
}

# Function to setup firewalld rules
setup_firewalld() {
    echo -e "\n${YELLOW}Setting up firewalld rules...${NC}"
    
    # Create RTPEngine service
    firewall-cmd --permanent --new-service=rtpengine || true
    firewall-cmd --permanent --service=rtpengine --set-description="RTPEngine Media Proxy"
    firewall-cmd --permanent --service=rtpengine --add-port=22222/udp
    firewall-cmd --permanent --service=rtpengine --add-port=22222/tcp
    firewall-cmd --permanent --service=rtpengine --add-port=22223/tcp
    firewall-cmd --permanent --service=rtpengine --add-port=30000-40000/udp
    firewall-cmd --permanent --service=rtpengine --add-port=9103/tcp
    
    # Add service to default zone
    firewall-cmd --permanent --add-service=rtpengine
    
    # Reload firewall
    firewall-cmd --reload
    
    echo -e "${GREEN}firewalld rules configured${NC}"
}

# Function to setup ufw rules
setup_ufw() {
    echo -e "\n${YELLOW}Setting up ufw rules...${NC}"
    
    # Allow RTPEngine ports
    ufw allow 22222/udp comment "RTPEngine Control UDP"
    ufw allow 22222/tcp comment "RTPEngine Control TCP"
    ufw allow 22223/tcp comment "RTPEngine CLI"
    ufw allow 30000:40000/udp comment "RTP/RTCP Media"
    ufw allow 9103/tcp comment "RTPEngine Prometheus"
    
    echo -e "${GREEN}ufw rules configured${NC}"
}

# Detect and configure firewall
echo -e "\n${YELLOW}Detecting firewall type...${NC}"

if systemctl is-active --quiet firewalld; then
    echo -e "${GREEN}firewalld detected${NC}"
    setup_firewalld
elif systemctl is-active --quiet ufw; then
    echo -e "${GREEN}ufw detected${NC}"
    setup_ufw
elif command -v iptables > /dev/null; then
    echo -e "${GREEN}iptables detected${NC}"
    setup_iptables
else
    echo -e "${RED}No supported firewall detected${NC}"
    exit 1
fi

# GCP-specific firewall rules (if on GCP)
if command -v gcloud > /dev/null; then
    echo -e "\n${YELLOW}Detected GCP environment. Creating GCP firewall rules...${NC}"
    
    # Get project ID
    PROJECT_ID=$(gcloud config get-value project)
    
    # Create firewall rules
    gcloud compute firewall-rules create rtpengine-control \
        --allow tcp:22222,tcp:22223,udp:22222 \
        --source-ranges 0.0.0.0/0 \
        --target-tags rtpengine \
        --description "RTPEngine control ports" \
        --project $PROJECT_ID || true
    
    gcloud compute firewall-rules create rtpengine-media \
        --allow udp:30000-40000 \
        --source-ranges 0.0.0.0/0 \
        --target-tags rtpengine \
        --description "RTPEngine RTP/RTCP media ports" \
        --project $PROJECT_ID || true
    
    gcloud compute firewall-rules create rtpengine-metrics \
        --allow tcp:9103 \
        --source-ranges 10.0.0.0/8 \
        --target-tags rtpengine \
        --description "RTPEngine Prometheus metrics" \
        --project $PROJECT_ID || true
    
    echo -e "${GREEN}GCP firewall rules created${NC}"
    echo -e "${YELLOW}Note: Make sure your VMs have the 'rtpengine' network tag${NC}"
fi

echo -e "\n${GREEN}Firewall configuration completed!${NC}"
echo -e "\n${YELLOW}Current firewall rules:${NC}"

# Display current rules
if systemctl is-active --quiet firewalld; then
    firewall-cmd --list-all
elif systemctl is-active --quiet ufw; then
    ufw status verbose
else
    iptables -L -n -v | grep -E "(RTPEngine|RTP|22222|22223|9103)"
fi