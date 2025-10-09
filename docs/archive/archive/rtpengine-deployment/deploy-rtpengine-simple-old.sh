#!/bin/bash

# Simple RTPEngine deployment script

set -e

PROJECT_ID="ringer-warp-v01"
REDIS_HOST="10.206.200.36"

# VM details
declare -A VMS
VMS[warp-rtpengine-1]="us-central1-a"
VMS[warp-rtpengine-2]="us-central1-b"
VMS[warp-rtpengine-3]="us-central1-c"

echo "=== RTPEngine Simple Deployment ==="

# Deploy to each VM
for VM_NAME in "${!VMS[@]}"; do
    ZONE=${VMS[$VM_NAME]}
    echo ""
    echo "Deploying to $VM_NAME in $ZONE..."
    
    # Create simplified setup script
    cat > /tmp/rtpengine-install.sh << 'EOF'
#!/bin/bash
set -e

# Update system
sudo apt-get update

# Install RTPEngine from package
sudo apt-get install -y software-properties-common
sudo add-apt-repository -y ppa:sipwise/rtpengine
sudo apt-get update
sudo apt-get install -y ngcp-rtpengine-daemon ngcp-rtpengine-iptables ngcp-rtpengine-kernel-dkms

# Get instance IPs
INSTANCE_IP=$(curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/ip)
EXTERNAL_IP=$(curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip)

# Configure RTPEngine
sudo tee /etc/rtpengine/rtpengine.conf > /dev/null << CONFIG
[rtpengine]
table = 0
interface = private/${INSTANCE_IP}
interface = public/${EXTERNAL_IP}!${EXTERNAL_IP}
listen-ng = 0.0.0.0:2223
listen-cli = 127.0.0.1:9900
port-min = 30000
port-max = 40000
timeout = 60
silent-timeout = 3600
redis = redis://REDIS_HOST:6379/1
redis-write = redis://REDIS_HOST:6379/1
log-level = 6
prometheus-port = 9101
CONFIG

# Replace Redis host
sudo sed -i "s/REDIS_HOST/${REDIS_HOST}/g" /etc/rtpengine/rtpengine.conf

# Enable and start RTPEngine
sudo systemctl enable ngcp-rtpengine-daemon
sudo systemctl restart ngcp-rtpengine-daemon

# Check status
sudo systemctl status ngcp-rtpengine-daemon --no-pager
EOF

    # Make script executable
    chmod +x /tmp/rtpengine-install.sh
    
    # Replace REDIS_HOST in script
    export REDIS_HOST="$REDIS_HOST"
    
    # Copy and execute script on VM
    gcloud compute scp /tmp/rtpengine-install.sh ${VM_NAME}:/tmp/rtpengine-install.sh \
        --project=${PROJECT_ID} \
        --zone=${ZONE}
    
    gcloud compute ssh ${VM_NAME} \
        --project=${PROJECT_ID} \
        --zone=${ZONE} \
        --command="bash /tmp/rtpengine-install.sh"
    
    echo "✓ Deployed to $VM_NAME"
done

echo ""
echo "=== Deployment Complete ==="
echo "Run ./rtpengine-health-check.sh to verify status"