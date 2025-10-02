# RTPEngine Deployment Runbook

## Purpose

This runbook provides step-by-step procedures for deploying, troubleshooting, and maintaining RTPEngine in the WARP platform production environment.

## Prerequisites

- GCP project access (ringer-warp-v01)
- gcloud CLI configured
- SSH access to VMs
- Monitoring access (Grafana/Prometheus)

## Deployment Procedures

### 1. Initial Deployment from Golden Image

#### Step 1.1: Verify Golden Image

```bash
# List available images
gcloud compute images list --project=ringer-warp-v01 | grep rtpengine

# Expected output:
# rtpengine-golden-image-v1-20241209  ringer-warp-v01  READY
```

#### Step 1.2: Deploy New Instance

```bash
# Set variables
PROJECT_ID="ringer-warp-v01"
INSTANCE_NAME="rtpengine-prod-4"  # Increment for new instance
ZONE="us-central1-a"
IMAGE_NAME="rtpengine-golden-image-v1-20241209"

# Create instance
gcloud compute instances create ${INSTANCE_NAME} \
  --project=${PROJECT_ID} \
  --zone=${ZONE} \
  --machine-type=e2-standard-4 \
  --network-interface=network=default,subnet=default \
  --boot-disk-size=100GB \
  --boot-disk-type=pd-ssd \
  --image=${IMAGE_NAME} \
  --tags=rtpengine,allow-health-check \
  --metadata-from-file startup-script=/path/to/startup-script.sh
```

#### Step 1.3: Verify Deployment

```bash
# Wait for instance to be ready
sleep 60

# SSH and check service
gcloud compute ssh ${INSTANCE_NAME} --zone=${ZONE} --command="sudo systemctl status rtpengine"

# Check logs
gcloud compute ssh ${INSTANCE_NAME} --zone=${ZONE} --command="sudo journalctl -u rtpengine -n 50"
```

### 2. Rolling Update Procedure

#### Step 2.1: Create New Golden Image

```bash
cd /home/daldworth/repos/ringer-warp/rtpengine/golden-image

# Update RTPEngine version
./update-rtpengine.sh --version mr13.4.2

# This will:
# 1. Create new golden VM
# 2. Build new version
# 3. Test installation
# 4. Create new golden image
```

#### Step 2.2: Update Instances One by One

```bash
# For each instance (1, 2, 3):
INSTANCE_NUM=1
OLD_INSTANCE="rtpengine-prod-${INSTANCE_NUM}"
NEW_IMAGE="rtpengine-golden-image-v2-20241210"

# Step 1: Create new instance
gcloud compute instances create ${OLD_INSTANCE}-new \
  --source-machine-image=${NEW_IMAGE} \
  --zone=$(gcloud compute instances describe ${OLD_INSTANCE} --format="get(zone)")

# Step 2: Verify new instance
gcloud compute ssh ${OLD_INSTANCE}-new --command="sudo systemctl status rtpengine"

# Step 3: Update load balancer (if applicable)
# ... update Kamailio configuration ...

# Step 4: Delete old instance
gcloud compute instances delete ${OLD_INSTANCE} --quiet

# Step 5: Rename new instance
gcloud compute instances set-name ${OLD_INSTANCE}-new --name=${OLD_INSTANCE}

# Wait before proceeding to next instance
sleep 300
```

### 3. Emergency Deployment

If all instances are down:

```bash
# Deploy all instances in parallel
for i in 1 2 3; do
  gcloud compute instances create rtpengine-prod-$i \
    --source-machine-image=rtpengine-golden-image-v1-20241209 \
    --zone=us-central1-$( [ $i -eq 1 ] && echo "a" || [ $i -eq 2 ] && echo "b" || echo "c" ) &
done

# Wait for all deployments
wait

# Verify all instances
for i in 1 2 3; do
  echo "Checking rtpengine-prod-$i..."
  gcloud compute ssh rtpengine-prod-$i --command="sudo systemctl status rtpengine"
done
```

## Troubleshooting Procedures

### Issue 1: RTPEngine Not Starting

#### Symptoms
- Service shows as failed in systemctl
- No process listening on port 22222

#### Diagnosis
```bash
# Check service status
sudo systemctl status rtpengine

# Check detailed logs
sudo journalctl -u rtpengine -n 100 --no-pager

# Check configuration
sudo rtpengine --config-file=/etc/rtpengine/rtpengine.conf --config-check

# Check Redis connectivity
redis-cli ping
```

#### Common Causes & Solutions

1. **Port Already in Use**
```bash
# Check port usage
sudo ss -tlnp | grep 22222

# Kill conflicting process
sudo kill -9 $(sudo lsof -t -i:22222)
```

2. **Redis Not Running**
```bash
# Start Redis
sudo systemctl start redis
sudo systemctl enable redis
```

3. **Configuration Syntax Error**
```bash
# Validate configuration
sudo rtpengine --config-file=/etc/rtpengine/rtpengine.conf --config-check

# Common issues:
# - Missing interface name
# - Invalid IP addresses
# - Port range conflicts
```

### Issue 2: High CPU Usage

#### Symptoms
- CPU usage above 80%
- Slow call setup
- Audio quality issues

#### Diagnosis
```bash
# Check CPU usage by thread
top -H -p $(pgrep rtpengine)

# Check active sessions
sudo rtpengine-ctl -ip 127.0.0.1 -port 9900 list totals

# Check packet rate
sudo rtpengine-ctl -ip 127.0.0.1 -port 9900 list interfaces
```

#### Solutions

1. **Too Many Active Sessions**
```bash
# Check session count
sudo rtpengine-ctl -ip 127.0.0.1 -port 9900 list totals

# If over 4000 sessions, distribute load to other instances
```

2. **Thread Count Too Low**
```bash
# Edit configuration
sudo nano /etc/rtpengine/rtpengine.conf

# Increase threads (set to number of CPU cores)
num-threads = 16

# Restart service
sudo systemctl restart rtpengine
```

### Issue 3: Packet Loss / Audio Issues

#### Symptoms
- Choppy audio
- One-way audio
- Metrics show packet loss

#### Diagnosis
```bash
# Check network interface drops
ip -s link show ens4

# Check iptables counters
sudo iptables -L -n -v | grep DROP

# Monitor real-time traffic
sudo tcpdump -i ens4 -c 1000 udp portrange 30000-40000 | grep -c "length"

# Check buffer settings
sysctl net.core.rmem_max
sysctl net.core.wmem_max
```

#### Solutions

1. **Increase Network Buffers**
```bash
# Apply immediately
sudo sysctl -w net.core.rmem_max=134217728
sudo sysctl -w net.core.wmem_max=134217728

# Make permanent
echo 'net.core.rmem_max=134217728' | sudo tee -a /etc/sysctl.conf
echo 'net.core.wmem_max=134217728' | sudo tee -a /etc/sysctl.conf
```

2. **Check Firewall Rules**
```bash
# Verify RTP ports are open
gcloud compute firewall-rules describe allow-rtpengine-rtp

# Test connectivity
nc -u -v INSTANCE_IP 35000
```

### Issue 4: Memory Leak

#### Symptoms
- Gradually increasing memory usage
- Eventually OOM killer activates

#### Diagnosis
```bash
# Monitor memory usage over time
watch -n 10 'ps aux | grep rtpengine | grep -v grep'

# Check for stuck sessions in Redis
redis-cli -n 5 dbsize

# Look for old sessions
redis-cli -n 5 --scan --pattern "*" | head -20
```

#### Solutions

1. **Restart Service** (Temporary)
```bash
sudo systemctl restart rtpengine
```

2. **Clear Old Redis Sessions**
```bash
# Clear sessions older than 24 hours
redis-cli -n 5 --scan --pattern "*" | while read key; do
  TTL=$(redis-cli -n 5 TTL "$key")
  [ $TTL -lt 0 ] && redis-cli -n 5 DEL "$key"
done
```

3. **Update to Latest Version** (Permanent)
- Follow rolling update procedure

## Monitoring Procedures

### Daily Checks

1. **Service Health**
```bash
# Check all instances
for i in 1 2 3; do
  echo "=== rtpengine-prod-$i ==="
  gcloud compute ssh rtpengine-prod-$i --command="
    echo 'Service Status:' && sudo systemctl is-active rtpengine &&
    echo 'Active Sessions:' && sudo rtpengine-ctl -ip 127.0.0.1 -port 9900 list totals | grep 'Total sessions'
  "
done
```

2. **Resource Usage**
- Check Grafana dashboard: https://grafana.ringer.tel
- Verify CPU < 70%
- Verify Memory < 80%
- Check packet loss < 0.01%

### Weekly Maintenance

1. **Log Rotation**
```bash
# Verify log rotation is working
ls -la /var/log/rtpengine/

# Manually rotate if needed
sudo logrotate -f /etc/logrotate.d/rtpengine
```

2. **Performance Analysis**
```bash
# Generate performance report
for i in 1 2 3; do
  gcloud compute ssh rtpengine-prod-$i --command="
    sudo rtpengine-ctl -ip 127.0.0.1 -port 9900 list interfaces
  "
done
```

## Recovery Procedures

### Single Instance Failure

1. **Verify Instance is Down**
```bash
gcloud compute instances describe rtpengine-prod-1 --zone=us-central1-a
```

2. **Attempt Restart**
```bash
gcloud compute instances start rtpengine-prod-1 --zone=us-central1-a
```

3. **If Restart Fails, Recreate**
```bash
# Delete failed instance
gcloud compute instances delete rtpengine-prod-1 --zone=us-central1-a --quiet

# Create new instance from golden image
gcloud compute instances create rtpengine-prod-1 \
  --source-machine-image=rtpengine-golden-image-v1-20241209 \
  --zone=us-central1-a
```

### Complete Outage Recovery

1. **Deploy Emergency Instances**
```bash
# Use emergency deployment script
cd /home/daldworth/repos/ringer-warp/rtpengine/golden-image
./emergency-deploy.sh
```

2. **Restore from Backup**
```bash
# If configuration was lost
./backup-restore.sh restore latest
```

3. **Verify Services**
```bash
# Check all services are responding
./gcloud/verify-deployment.sh
```

## Performance Tuning

### Optimal Settings by Load

#### Light Load (< 1000 concurrent calls)
```ini
num-threads = 8
port-min = 30000
port-max = 35000
```

#### Medium Load (1000-3000 concurrent calls)
```ini
num-threads = 12
port-min = 30000
port-max = 38000
```

#### Heavy Load (3000-5000 concurrent calls)
```ini
num-threads = 16
port-min = 30000
port-max = 40000
```

### Network Optimization

```bash
# Apply high-performance network settings
sudo tee /etc/sysctl.d/99-rtpengine-performance.conf << EOF
# Network performance tuning for RTPEngine
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.core.rmem_default = 262144
net.core.wmem_default = 262144
net.core.netdev_max_backlog = 5000
net.ipv4.udp_rmem_min = 131072
net.ipv4.udp_wmem_min = 131072
net.netfilter.nf_conntrack_max = 262144
net.ipv4.netfilter.ip_conntrack_generic_timeout = 120
net.ipv4.netfilter.ip_conntrack_udp_timeout = 30
net.ipv4.netfilter.ip_conntrack_udp_timeout_stream = 30
EOF

# Apply settings
sudo sysctl -p /etc/sysctl.d/99-rtpengine-performance.conf
```

## Escalation Procedures

### Level 1: Operations Team
- Basic troubleshooting from this runbook
- Service restarts
- Instance recreation from golden image

### Level 2: Platform Team
- Configuration changes
- Performance tuning
- Golden image updates

### Level 3: Engineering
- Code-level debugging
- Patch development
- Architecture changes

### Emergency Contacts

- On-call Engineer: Check PagerDuty
- Platform Lead: [Contact Details]
- GCP Support: [Ticket URL]

## Appendix

### Useful Commands Reference

```bash
# Service management
sudo systemctl status/start/stop/restart rtpengine

# View logs
sudo journalctl -u rtpengine -f

# Check statistics
sudo rtpengine-ctl -ip 127.0.0.1 -port 9900 list totals

# Test connectivity
nc -u -v INSTANCE_IP 35000

# Monitor performance
top -H -p $(pgrep rtpengine)

# Check configuration
cat /etc/rtpengine/rtpengine.conf
```

### Golden Image Versions

| Version | Date | RTPEngine Version | Notes |
|---------|------|-------------------|-------|
| v1-20241209 | 2024-12-09 | mr13.4.1 | Initial production deployment |
| v2-PENDING | TBD | mr13.4.2 | Security updates |

### Related Documentation

- [RTPEngine Deployment Guide](/docs/rtpengine-deployment.md)
- [Platform Monitoring Guide](/docs/monitoring-endpoints.md)
- [Incident Response Playbook](/docs/runbooks/incident-response.md)

---

Last Updated: December 9, 2024
Next Review: January 2025