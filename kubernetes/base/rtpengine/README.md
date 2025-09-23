# RTPEngine Configuration for WARP Platform

## Overview

RTPEngine is deployed on dedicated GCP VM instances to handle media processing for the WARP platform. This configuration provides:

- WebRTC/SRTP support
- Media recording capabilities
- Codec transcoding
- Redis-based session sharing across instances
- Prometheus metrics integration
- Homer/HEP integration for media capture

## Architecture

RTPEngine runs on 3 dedicated GCP VM instances:
- Instance 1: 34.123.38.31
- Instance 2: 35.222.101.214  
- Instance 3: 35.225.65.80

All instances share session state via Redis at: 10.206.200.36:6379

## Configuration Files

### 1. ConfigMap (`configmap-rtpengine.yaml`)
Contains the main RTPEngine configuration with:
- Network interface bindings
- RTP port range: 30000-40000
- Redis session sharing
- Prometheus metrics on port 9101
- Recording configuration
- Codec transcoding support

### 2. Monitoring (`monitoring.yaml`)
- Prometheus ServiceMonitor for metrics collection
- Grafana dashboard for RTPEngine visualization
- Metrics service endpoint configuration

### 3. Consul Service (`consul-service.yaml`)
- Service discovery registration
- Health check definitions
- Service mesh integration

### 4. Firewall Rules (`firewall-setup.sh`)
Run this script to configure GCP firewall rules:
```bash
./firewall-setup.sh
```

Creates rules for:
- Control port: TCP 2223
- RTP media: UDP 30000-40000
- Metrics: TCP 9101
- CLI: TCP 9900
- WebRTC STUN/TURN ports

### 5. VM Setup (`vm-setup.sh`)
Deploy this script on each RTPEngine VM:
```bash
sudo ./vm-setup.sh
```

This will:
- Install RTPEngine from source
- Configure systemd service
- Set up Consul agent
- Configure logging
- Optimize kernel parameters

### 6. Kamailio Integration (`kamailio-integration.cfg`)
Include this configuration in your Kamailio setup to integrate with RTPEngine.

## Deployment Instructions

### Step 1: Configure Firewall Rules
```bash
cd /home/daldworth/repos/ringer-warp/kubernetes/base/rtpengine
./firewall-setup.sh
```

### Step 2: Setup VM Instances
SSH into each RTPEngine instance and run:
```bash
# Copy the setup script to the VM
scp vm-setup.sh user@<instance-ip>:/tmp/

# SSH to the instance
ssh user@<instance-ip>

# Run the setup
sudo /tmp/vm-setup.sh
```

### Step 3: Deploy Kubernetes Resources
```bash
# Apply the ConfigMap
kubectl apply -f configmap-rtpengine.yaml

# Apply monitoring configuration
kubectl apply -f monitoring.yaml

# Apply Consul service registration
kubectl apply -f consul-service.yaml
```

### Step 4: Update Kamailio Configuration
Include the RTPEngine integration configuration in your Kamailio setup:
```bash
# Add to your kamailio.cfg
include_file "/etc/kamailio/rtpengine-integration.cfg"
```

## Monitoring

### Prometheus Metrics
RTPEngine exposes metrics on port 9101. Key metrics include:
- `rtpengine_sessions_total`: Total active sessions
- `rtpengine_packets_total`: Packet counters
- `rtpengine_jitter_avg`: Average jitter
- `rtpengine_packet_loss_percentage`: Packet loss rate
- `rtpengine_transcoded_streams`: Transcoding statistics

### Grafana Dashboard
Import the dashboard from `monitoring.yaml` to visualize:
- Active sessions gauge
- Packet rate graphs
- Jitter measurements
- Packet loss percentage
- Transcoding statistics by codec

### Health Checks
- TCP port 2223: Control protocol health
- HTTP port 9101/metrics: Prometheus endpoint
- TCP port 9900: CLI interface

## WebRTC Support

RTPEngine is configured for full WebRTC support:
- DTLS-SRTP encryption
- ICE candidate handling
- STUN/TURN relay
- Opus codec support
- RFC2833 DTMF

WebRTC calls require these flags in Kamailio:
```
ICE=force RTP/SAVPF DTLS=passive
```

## Recording

Call recordings are stored in `/var/spool/rtpengine` on each VM instance. 
- Format: PCAP files
- Method: Raw RTP capture
- Retention: Configure based on storage capacity

## Troubleshooting

### Check Service Status
```bash
systemctl status rtpengine
```

### View Logs
```bash
tail -f /var/log/rtpengine/rtpengine.log
```

### Test Control Protocol
```bash
# From Kamailio server
echo "ping" | nc -u <rtpengine-ip> 2223
```

### Check Redis Connectivity
```bash
redis-cli -h 10.206.200.36 ping
```

### Verify Metrics
```bash
curl http://<rtpengine-ip>:9101/metrics
```

## Performance Tuning

### Kernel Parameters
The VM setup script configures optimal kernel parameters for RTP traffic:
- Increased UDP buffer sizes
- Extended local port range
- Higher network backlog

### Resource Allocation
- Machine type: n2-standard-8 (8 vCPU, 32GB RAM)
- Supports up to 50,000 concurrent sessions per instance
- Total capacity: 150,000 sessions across 3 instances

## Security Considerations

1. Firewall rules restrict control port access to internal networks only
2. RTP ports are open to internet for media traffic
3. Use SRTP for encrypted media when possible
4. Redis requires authentication in production
5. Consul communication should use mTLS

## Maintenance

### Log Rotation
Logs are automatically rotated daily with 7-day retention.

### Updates
To update RTPEngine:
1. Pull latest code from repository
2. Recompile on VM
3. Restart service with minimal disruption

### Scaling
Add more VM instances and update:
1. Kamailio's RTPEngine socket list
2. Firewall rules for new instances
3. Monitoring targets