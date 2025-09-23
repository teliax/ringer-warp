#!/bin/bash

# RTPEngine Firewall Rules Setup for GCP
# This script creates necessary firewall rules for RTPEngine media processing

PROJECT_ID="ringer-warp-v01"
NETWORK_NAME="warp-vpc"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up RTPEngine firewall rules...${NC}"

# Function to create or update a firewall rule
create_firewall_rule() {
    local RULE_NAME=$1
    local DESCRIPTION=$2
    local DIRECTION=$3
    local PORTS=$4
    local SOURCE_RANGES=$5
    local TARGET_TAGS=$6
    
    echo -e "${YELLOW}Creating firewall rule: ${RULE_NAME}${NC}"
    
    gcloud compute firewall-rules create ${RULE_NAME} \
        --project=${PROJECT_ID} \
        --network=${NETWORK_NAME} \
        --description="${DESCRIPTION}" \
        --direction=${DIRECTION} \
        --priority=1000 \
        --source-ranges=${SOURCE_RANGES} \
        --target-tags=${TARGET_TAGS} \
        --allow=${PORTS} \
        2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Created ${RULE_NAME}${NC}"
    else
        # Rule might already exist, try updating it
        gcloud compute firewall-rules update ${RULE_NAME} \
            --project=${PROJECT_ID} \
            --description="${DESCRIPTION}" \
            --source-ranges=${SOURCE_RANGES} \
            --allow=${PORTS} \
            2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Updated ${RULE_NAME}${NC}"
        else
            echo -e "${RED}✗ Failed to create/update ${RULE_NAME}${NC}"
        fi
    fi
}

# RTPEngine control port (ng protocol)
create_firewall_rule \
    "rtpengine-ng-control" \
    "RTPEngine control port for Kamailio communication" \
    "INGRESS" \
    "tcp:2223" \
    "10.0.0.0/8" \
    "rtpengine"

# RTPEngine CLI port
create_firewall_rule \
    "rtpengine-cli" \
    "RTPEngine CLI interface" \
    "INGRESS" \
    "tcp:9900" \
    "10.0.0.0/8" \
    "rtpengine"

# RTPEngine Prometheus metrics port
create_firewall_rule \
    "rtpengine-metrics" \
    "RTPEngine Prometheus metrics endpoint" \
    "INGRESS" \
    "tcp:9101" \
    "10.0.0.0/8" \
    "rtpengine"

# RTP/RTCP media ports (UDP)
create_firewall_rule \
    "rtpengine-media-udp" \
    "RTPEngine media ports for RTP/RTCP traffic" \
    "INGRESS" \
    "udp:30000-40000" \
    "0.0.0.0/0" \
    "rtpengine"

# TURN/STUN ports for WebRTC
create_firewall_rule \
    "rtpengine-webrtc-stun" \
    "STUN port for WebRTC" \
    "INGRESS" \
    "udp:3478" \
    "0.0.0.0/0" \
    "rtpengine"

# TURN TLS port for WebRTC
create_firewall_rule \
    "rtpengine-webrtc-turns" \
    "TURN TLS port for WebRTC" \
    "INGRESS" \
    "tcp:5349" \
    "0.0.0.0/0" \
    "rtpengine"

# Homer HEP port (for SIP capture)
create_firewall_rule \
    "rtpengine-homer-hep" \
    "Homer HEP integration for media capture" \
    "EGRESS" \
    "udp:9060" \
    "10.0.0.0/8" \
    "rtpengine"

# Health check from load balancer
create_firewall_rule \
    "rtpengine-health-check" \
    "Health check from GCP load balancer" \
    "INGRESS" \
    "tcp:2223" \
    "35.191.0.0/16,130.211.0.0/22" \
    "rtpengine"

echo -e "${GREEN}Firewall rules setup completed!${NC}"

# List the created rules
echo -e "\n${YELLOW}Created firewall rules:${NC}"
gcloud compute firewall-rules list \
    --project=${PROJECT_ID} \
    --filter="name~'rtpengine-'" \
    --format="table(name,direction,sourceRanges.list():label=SRC_RANGES,allowed[].map().firewall_rule().list():label=ALLOW,targetTags.list():label=TARGET_TAGS)"

# Verify RTPEngine instances have the correct tags
echo -e "\n${YELLOW}Verifying RTPEngine instance tags:${NC}"
INSTANCES=("34.123.38.31" "35.222.101.214" "35.225.65.80")

for IP in "${INSTANCES[@]}"; do
    INSTANCE_NAME=$(gcloud compute instances list --project=${PROJECT_ID} --filter="EXTERNAL_IP=${IP}" --format="value(name)")
    if [ ! -z "$INSTANCE_NAME" ]; then
        echo -e "Adding 'rtpengine' tag to instance: ${INSTANCE_NAME}"
        gcloud compute instances add-tags ${INSTANCE_NAME} \
            --project=${PROJECT_ID} \
            --tags=rtpengine \
            --zone=$(gcloud compute instances list --project=${PROJECT_ID} --filter="name=${INSTANCE_NAME}" --format="value(zone)")
    fi
done

echo -e "\n${GREEN}Firewall configuration complete!${NC}"