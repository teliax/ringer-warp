#!/bin/bash
# Configure RTPEngine on WARP VMs

set -euo pipefail

PROJECT_ID="ringer-warp-v01"
ZONE_A="us-central1-a"
ZONE_B="us-central1-b"
ZONE_C="us-central1-c"

echo "🔊 Configuring RTPEngine on VMs..."

# RTPEngine configuration
RTPENGINE_CONFIG='
[rtpengine]
interface = pub/EXTERNAL_IP!EXTERNAL_IP;priv/INTERNAL_IP!INTERNAL_IP
listen-ng = 0.0.0.0:2223
listen-udp = 0.0.0.0:2223
listen-cli = 0.0.0.0:9900
port-min = 10000
port-max = 20000
recording-dir = /var/spool/rtpengine
recording-method = proc
recording-format = mp3
log-level = 6
log-facility = local0
log-facility-cdr = local1
log-facility-rtcp = local2
homer = 127.0.0.1:9060
homer-protocol = udp
homer-id = 2001
graphite = 127.0.0.1:2003
graphite-interval = 60
graphite-prefix = rtpengine
tos = 184
delete-delay = 30
timeout = 60
silent-timeout = 3600
final-timeout = 10800
offer-timeout = 360
xmlrpc-format = 0
'

# Function to configure a single RTPEngine instance
configure_rtpengine() {
    local instance_name=$1
    local zone=$2
    
    echo "📡 Configuring $instance_name in $zone..."
    
    # Get instance IPs
    EXTERNAL_IP=$(gcloud compute instances describe "$instance_name" \
        --zone="$zone" \
        --project="$PROJECT_ID" \
        --format="get(networkInterfaces[0].accessConfigs[0].natIP)")
    
    INTERNAL_IP=$(gcloud compute instances describe "$instance_name" \
        --zone="$zone" \
        --project="$PROJECT_ID" \
        --format="get(networkInterfaces[0].networkIP)")
    
    echo "   External IP: $EXTERNAL_IP"
    echo "   Internal IP: $INTERNAL_IP"
    
    # Create configuration with proper IPs
    CONFIG_WITH_IPS=$(echo "$RTPENGINE_CONFIG" | sed \
        -e "s/EXTERNAL_IP/$EXTERNAL_IP/g" \
        -e "s/INTERNAL_IP/$INTERNAL_IP/g")
    
    # SSH into instance and configure
    gcloud compute ssh "$instance_name" \
        --zone="$zone" \
        --project="$PROJECT_ID" \
        --command="
            set -e
            
            # Install RTPEngine if not already installed
            if ! command -v rtpengine &> /dev/null; then
                echo 'Installing RTPEngine...'
                sudo apt-get update
                sudo apt-get install -y gnupg2 software-properties-common
                
                # Add RTPEngine repository
                wget -qO - https://deb.sipwise.com/spce/sipwise.key | sudo apt-key add -
                echo 'deb https://deb.sipwise.com/spce/mr11.5.1 bullseye main' | sudo tee /etc/apt/sources.list.d/sipwise.list
                
                sudo apt-get update
                sudo apt-get install -y rtpengine rtpengine-kernel-dkms
            fi
            
            # Create RTPEngine configuration
            sudo tee /etc/rtpengine/rtpengine.conf << 'EOF'
$CONFIG_WITH_IPS
EOF
            
            # Create systemd override for proper startup
            sudo mkdir -p /etc/systemd/system/rtpengine.service.d
            sudo tee /etc/systemd/system/rtpengine.service.d/override.conf << 'EOF'
[Service]
ExecStartPre=/bin/sleep 10
Restart=always
RestartSec=5
EOF
            
            # Configure firewall rules
            sudo iptables -I INPUT -p udp --dport 2223 -j ACCEPT
            sudo iptables -I INPUT -p udp --dport 10000:20000 -j ACCEPT
            sudo iptables -I INPUT -p tcp --dport 9900 -j ACCEPT
            
            # Make firewall rules persistent
            sudo apt-get install -y iptables-persistent
            sudo netfilter-persistent save
            
            # Enable and start RTPEngine
            sudo systemctl daemon-reload
            sudo systemctl enable rtpengine
            sudo systemctl restart rtpengine
            
            # Check status
            sudo systemctl status rtpengine --no-pager
            
            # Configure Consul health check
            sudo tee /etc/consul.d/rtpengine.json << 'EOF'
{
  \"service\": {
    \"name\": \"rtpengine\",
    \"tags\": [\"rtp\", \"media\"],
    \"port\": 2223,
    \"check\": {
      \"id\": \"rtpengine-check\",
      \"name\": \"RTPEngine Health Check\",
      \"tcp\": \"localhost:2223\",
      \"interval\": \"10s\",
      \"timeout\": \"2s\"
    }
  }
}
EOF
            
            # Reload Consul
            sudo systemctl reload consul || true
            
            echo '✅ RTPEngine configured successfully!'
        "
    
    if [ $? -eq 0 ]; then
        echo "✅ $instance_name configured successfully"
    else
        echo "❌ Failed to configure $instance_name"
        return 1
    fi
}

# Configure all RTPEngine instances
configure_rtpengine "warp-rtpengine-1" "$ZONE_A"
configure_rtpengine "warp-rtpengine-2" "$ZONE_B"
configure_rtpengine "warp-rtpengine-3" "$ZONE_C"

echo ""
echo "🎉 RTPEngine configuration complete!"
echo ""
echo "📊 RTPEngine endpoints:"
echo "- warp-rtpengine-1: $(gcloud compute instances describe warp-rtpengine-1 --zone=$ZONE_A --project=$PROJECT_ID --format='get(networkInterfaces[0].accessConfigs[0].natIP)'):2223"
echo "- warp-rtpengine-2: $(gcloud compute instances describe warp-rtpengine-2 --zone=$ZONE_B --project=$PROJECT_ID --format='get(networkInterfaces[0].accessConfigs[0].natIP)'):2223"
echo "- warp-rtpengine-3: $(gcloud compute instances describe warp-rtpengine-3 --zone=$ZONE_C --project=$PROJECT_ID --format='get(networkInterfaces[0].accessConfigs[0].natIP)'):2223"