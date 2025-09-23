# RTPEngine Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying RTPEngine on your VMs and integrating it with Kamailio for media relay and NAT traversal.

## Architecture

### VM Details
- **VM1**: 34.123.38.31 (rtpengine-1)
- **VM2**: 35.222.101.214 (rtpengine-2)
- **VM3**: 35.225.65.80 (rtpengine-3)

### Port Configuration
- **Control Ports**: 22222 (UDP/TCP) - Kamailio communication
- **CLI Port**: 22223 (TCP) - Management interface
- **Media Ports**: 30000-40000 (UDP) - RTP/RTCP traffic
- **Metrics Port**: 9103 (TCP) - Prometheus metrics

## Pre-Deployment Steps

### 1. Check Current VM Status

First, SSH into each VM and run the status check script:

```bash
# Copy and run on each VM
scp scripts/check_rtpengine_status.sh user@VM_IP:/tmp/
ssh user@VM_IP
chmod +x /tmp/check_rtpengine_status.sh
sudo /tmp/check_rtpengine_status.sh
```

### 2. Prerequisites

Ensure the following on each VM:
- Debian/Ubuntu OS (recommended: Debian 11 or Ubuntu 20.04/22.04)
- Root or sudo access
- Network connectivity
- Sufficient resources (minimum 2 CPU, 4GB RAM)

## Deployment Process

### Option 1: Automated Deployment (Recommended)

1. **Configure SSH access** in the deployment script:
   ```bash
   # Edit scripts/deploy_rtpengine.sh
   SSH_USER="your_ssh_user"
   SSH_KEY="path/to/your/ssh/key"
   ```

2. **Run the deployment script**:
   ```bash
   chmod +x scripts/deploy_rtpengine.sh
   ./scripts/deploy_rtpengine.sh
   ```

### Option 2: Manual Deployment

For each VM, perform the following steps:

1. **Copy installation files**:
   ```bash
   scp scripts/install_rtpengine.sh user@VM_IP:/tmp/
   scp scripts/configure_firewall.sh user@VM_IP:/tmp/
   scp config/rtpengine-vmX.conf user@VM_IP:/tmp/rtpengine.conf
   scp systemd/rtpengine.service user@VM_IP:/tmp/
   ```

2. **SSH into the VM** and run installation:
   ```bash
   ssh user@VM_IP
   chmod +x /tmp/*.sh
   sudo /tmp/install_rtpengine.sh
   ```

3. **Install configuration**:
   ```bash
   sudo cp /tmp/rtpengine.conf /etc/rtpengine/
   sudo cp /tmp/rtpengine.service /etc/systemd/system/
   ```

4. **Configure firewall**:
   ```bash
   sudo /tmp/configure_firewall.sh
   ```

5. **Generate SSL certificates**:
   ```bash
   sudo openssl req -x509 -newkey rsa:2048 -keyout /etc/rtpengine/key.pem \
     -out /etc/rtpengine/cert.pem -days 365 -nodes \
     -subj '/CN=rtpengine.example.com'
   sudo chown rtpengine:rtpengine /etc/rtpengine/*.pem
   ```

6. **Start RTPEngine**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable rtpengine
   sudo systemctl start rtpengine
   sudo systemctl status rtpengine
   ```

## Kamailio Integration

### 1. Load RTPEngine Module

Add to your Kamailio configuration:

```cfg
loadmodule "rtpengine.so"
```

### 2. Configure RTPEngine Sockets

For single instance:
```cfg
modparam("rtpengine", "rtpengine_sock", "udp:34.123.38.31:22222")
```

For multiple instances with load balancing:
```cfg
modparam("rtpengine", "rtpengine_sock", "1 == udp:34.123.38.31:22222")
modparam("rtpengine", "rtpengine_sock", "2 == udp:35.222.101.214:22222")
modparam("rtpengine", "rtpengine_sock", "3 == udp:35.225.65.80:22222")
```

### 3. Add Routing Logic

Include the RTPEngine routing configuration:
```cfg
include_file "/path/to/rtpengine/config/kamailio-rtpengine.cfg"
```

Or copy the routing blocks from `config/kamailio-rtpengine.cfg` into your main configuration.

## Post-Deployment Configuration

### 1. Redis Configuration (for HA)

If using Redis for session sharing:

```bash
# Install Redis
sudo apt-get install redis-server

# Configure Redis
sudo vim /etc/redis/redis.conf
# Set: bind 0.0.0.0
# Set: protected-mode no (or configure auth)

# Restart Redis
sudo systemctl restart redis
```

Update RTPEngine configs to point to Redis server.

### 2. Monitoring Setup

#### Prometheus Configuration

Add to `prometheus.yml`:
```yaml
scrape_configs:
  - job_name: 'rtpengine'
    static_configs:
      - targets: 
        - '34.123.38.31:9103'
        - '35.222.101.214:9103'
        - '35.225.65.80:9103'
```

#### Grafana Dashboard

Import RTPEngine dashboard:
- Dashboard ID: 15505 (RTPEngine Statistics)
- Or use custom dashboard from monitoring templates

### 3. Test the Deployment

1. **Check service status**:
   ```bash
   sudo systemctl status rtpengine
   ```

2. **Test with CLI**:
   ```bash
   sudo rtpengine-ctl list
   sudo rtpengine-ctl statistics
   ```

3. **Monitor logs**:
   ```bash
   sudo journalctl -u rtpengine -f
   sudo tail -f /var/log/rtpengine/rtpengine.log
   ```

4. **Run monitoring script**:
   ```bash
   chmod +x scripts/monitor_rtpengine.sh
   ./scripts/monitor_rtpengine.sh
   ```

## Troubleshooting

### Common Issues

1. **Service fails to start**
   - Check logs: `sudo journalctl -u rtpengine -n 50`
   - Verify configuration syntax
   - Ensure ports are not in use

2. **No audio / one-way audio**
   - Check firewall rules
   - Verify NAT configuration
   - Ensure correct interface configuration

3. **High CPU usage**
   - Check number of active sessions
   - Verify transcoding is not overused
   - Consider kernel module installation

### Debug Commands

```bash
# Check active sessions
sudo rtpengine-ctl list

# Get detailed statistics
sudo rtpengine-ctl statistics all

# Test offer/answer
echo "offer" | nc -u localhost 22222

# Check kernel module
lsmod | grep rtpengine

# Network debugging
tcpdump -i any -n port 30000:40000
```

## Performance Tuning

### Kernel Parameters

Already configured by installation script in `/etc/sysctl.d/99-rtpengine.conf`

### RTPEngine Optimization

1. **Enable kernel forwarding** (if module available):
   ```cfg
   table = 0
   ```

2. **Adjust thread count** based on CPU cores:
   ```cfg
   num-threads = 16  # Set to number of CPU cores
   ```

3. **Limit transcoding** to save CPU:
   ```cfg
   codec-mask-PCMU = 0
   codec-mask-PCMA = 0
   ```

## Security Considerations

1. **Firewall Rules**: Only allow RTP ports from trusted sources
2. **Control Port**: Restrict access to Kamailio servers only
3. **SSL/TLS**: Use proper certificates for DTLS
4. **Monitoring**: Set up alerts for unusual traffic patterns

## Maintenance

### Regular Tasks

1. **Log Rotation**: Configured automatically
2. **Updates**: 
   ```bash
   sudo apt-get update
   sudo apt-get upgrade ngcp-rtpengine
   ```
3. **Backups**: Backup `/etc/rtpengine/` directory
4. **Monitoring**: Check metrics regularly

### Scaling

To add more RTPEngine instances:
1. Deploy to new VM using deployment script
2. Add to Kamailio configuration
3. Update monitoring configuration
4. Test load balancing

## Support

- Official Documentation: https://github.com/sipwise/rtpengine
- Kamailio RTPEngine Module: https://www.kamailio.org/docs/modules/stable/modules/rtpengine.html
- Community: Kamailio mailing lists and forums