#!/bin/bash

# Get internal IPs for RTPEngine VMs

PROJECT_ID="ringer-warp-v01"

echo "Getting internal IPs for RTPEngine VMs..."
echo

# VM external IPs
EXTERNAL_IPS=("34.123.38.31" "35.222.101.214" "35.225.65.80")

for EXTERNAL_IP in "${EXTERNAL_IPS[@]}"; do
    echo -n "VM with external IP ${EXTERNAL_IP}: "
    
    # Get instance details
    INSTANCE_INFO=$(gcloud compute instances list --project=${PROJECT_ID} --filter="EXTERNAL_IP=${EXTERNAL_IP}" --format="value(name,networkInterfaces[0].networkIP)")
    
    if [ ! -z "${INSTANCE_INFO}" ]; then
        INSTANCE_NAME=$(echo "${INSTANCE_INFO}" | awk '{print $1}')
        INTERNAL_IP=$(echo "${INSTANCE_INFO}" | awk '{print $2}')
        echo "Instance=${INSTANCE_NAME}, Internal IP=${INTERNAL_IP}"
    else
        echo "Not found"
    fi
done

echo
echo "Update the Kamailio configuration with these internal IPs."