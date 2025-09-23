# RTPEngine Complete Deployment Guide

This guide provides comprehensive instructions for deploying, managing, and maintaining RTPEngine in production environments.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Initial Deployment](#initial-deployment)
4. [Configuration Management](#configuration-management)
5. [Monitoring Setup](#monitoring-setup)
6. [Backup and Recovery](#backup-and-recovery)
7. [Updates and Maintenance](#updates-and-maintenance)
8. [Troubleshooting](#troubleshooting)
9. [Security Considerations](#security-considerations)
10. [Performance Tuning](#performance-tuning)

## Overview

The RTPEngine deployment solution provides:
- **Zero-downtime deployment** with rolling updates
- **Automated backups** with disaster recovery
- **Comprehensive monitoring** via Prometheus/Grafana
- **Multi-instance support** for high availability
- **Kernel-level optimization** for performance

### Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Kamailio/LB   │────▶│  Load Balancer  │
└─────────────────┘     └─────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
    ┌─────▼──────┐      ┌─────▼──────┐      ┌─────▼──────┐
    │ RTPEngine  │      │ RTPEngine  │      │ RTPEngine  │
    │ Instance 1 │      │ Instance 2 │      │ Instance 3 │
    └────────────┘      └────────────┘      └────────────┘
          │                    │                    │
    ┌─────▼──────────────────────────────────────▼─────┐
    │              Prometheus + Grafana                 │
    └───────────────────────────────────────────────────┘
```

## Prerequisites

### System Requirements

- **OS**: Debian 10/11/12 or Ubuntu 20.04/22.04
- **CPU**: Minimum 4 cores (8+ recommended)
- **RAM**: Minimum 8GB (16GB+ recommended)
- **Disk**: 50GB+ for recordings and logs
- **Network**: Multiple NICs recommended for media/signaling separation

### Network Requirements

- Ports 30000-40000 (UDP) for RTP media
- Ports 7722-7725 (UDP) for NG protocol
- Ports 8080-8083 (TCP) for metrics/HTTP
- Ports 9080-9083 (TCP) for CLI control

### Dependencies

The deployment scripts will automatically install all required dependencies, including:
- Build tools and kernel headers
- Media processing libraries (FFmpeg, Opus, etc.)
- Monitoring stack (Prometheus, node-exporter)
- Network utilities

## Initial Deployment

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/rtpengine-deployment.git
cd rtpengine-deployment/golden-image
```

### 2. Configure Deployment Parameters

Edit deployment configuration:

```bash
# Copy template
cp deployment.conf.example deployment.conf

# Edit configuration
nano deployment.conf
```

Key configuration options:

```bash
# Number of RTPEngine instances
INSTANCE_COUNT=4

# Network interface for RTP
RTP_INTERFACE=eth0

# Port ranges for each instance
PORT_START=30000
PORT_RANGE=2000

# Enable kernel module
USE_KERNEL_MODULE=true

# Monitoring settings
ENABLE_PROMETHEUS=true
PROMETHEUS_PORT=9090
```

### 3. Run Initial Deployment

Execute the orchestration script:

```bash
# Dry run first
sudo DRY_RUN=true ./orchestrate-deployment.sh

# Actual deployment
sudo ./orchestrate-deployment.sh
```

The script will:
1. Install all dependencies
2. Build RTPEngine from source
3. Configure multiple instances
4. Set up systemd services
5. Configure monitoring
6. Perform health checks

### 4. Verify Deployment

Check deployment status:

```bash
# Check services
systemctl status rtpengine-*

# Check ports
ss -tlnp | grep rtpengine

# Check metrics
curl http://localhost:8080/metrics
```

## Configuration Management

### Instance Configuration

Each RTPEngine instance has its own configuration file:

```bash
/etc/rtpengine/rtpengine-1.conf
/etc/rtpengine/rtpengine-2.conf
/etc/rtpengine/rtpengine-3.conf
/etc/rtpengine/rtpengine-4.conf
```

### Key Configuration Parameters

```ini
[rtpengine]
# Network settings
interface = public/192.168.1.10;private/10.0.0.10

# Port ranges (unique per instance)
port-min = 30000
port-max = 31999

# Control ports (unique per instance)
listen-ng = 127.0.0.1:7722
listen-cli = 127.0.0.1:9080
listen-http = 127.0.0.1:8080

# Recording
recording-method = proc
recording-dir = /var/spool/rtpengine

# Performance
num-threads = 8
```

### Applying Configuration Changes

```bash
# Edit configuration
sudo nano /etc/rtpengine/rtpengine-1.conf

# Reload specific instance
sudo systemctl reload rtpengine-1

# Or restart if needed
sudo systemctl restart rtpengine-1
```

## Monitoring Setup

### Prometheus Integration

The deployment automatically configures Prometheus targets:

```json
[
  {
    "targets": ["localhost:8080", "localhost:8081", "localhost:8082", "localhost:8083"],
    "labels": {
      "job": "rtpengine",
      "environment": "production"
    }
  }
]
```

### Grafana Dashboard

Import the provided dashboard:

```bash
# Via UI
1. Go to Grafana → Dashboards → Import
2. Upload monitoring-dashboard.json
3. Select Prometheus datasource

# Via API
curl -X POST -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -d @monitoring-dashboard.json \
     http://localhost:3000/api/dashboards/db
```

### Key Metrics to Monitor

- **Call Volume**: `rtpengine_sessions_total`
- **Packet Loss**: `rtpengine_packets_lost`
- **CPU Usage**: `rtpengine_cpu_usage`
- **Memory Usage**: `rtpengine_memory_usage`
- **Port Utilization**: `rtpengine_ports_used`

### Alert Rules

Example Prometheus alerts:

```yaml
groups:
  - name: rtpengine
    rules:
      - alert: RTPEngineDown
        expr: up{job="rtpengine"} == 0
        for: 2m
        annotations:
          summary: "RTPEngine instance {{ $labels.instance }} is down"
      
      - alert: HighPacketLoss
        expr: rate(rtpengine_packets_lost[5m]) > 0.01
        for: 5m
        annotations:
          summary: "High packet loss on {{ $labels.instance }}"
      
      - alert: HighCPUUsage
        expr: rtpengine_cpu_usage > 80
        for: 10m
        annotations:
          summary: "High CPU usage on {{ $labels.instance }}"
```

## Backup and Recovery

### Automated Backups

Set up automated daily backups:

```bash
sudo ./backup-restore.sh setup-cron
```

### Manual Backup

```bash
# Full backup
sudo ./backup-restore.sh backup

# Backup with encryption
sudo BACKUP_ENCRYPT=true BACKUP_ENCRYPT_KEY="secret" ./backup-restore.sh backup

# Backup to S3
sudo S3_BUCKET="my-backup-bucket" ./backup-restore.sh backup
```

### Restore Procedures

```bash
# List available backups
sudo ./backup-restore.sh list

# Restore from specific backup
sudo ./backup-restore.sh restore /var/backups/rtpengine/rtpengine_backup_20231201_120000.tar.gz

# Restore only configuration
sudo ./backup-restore.sh restore backup.tar.gz --components config

# Disaster recovery (automatic)
sudo ./backup-restore.sh disaster-recovery
```

### Backup Contents

Each backup includes:
- RTPEngine binaries
- Configuration files
- Systemd service files
- Kernel modules
- Recording data (optional)
- Metrics snapshots

## Updates and Maintenance

### Rolling Updates

Perform zero-downtime updates:

```bash
# Update to latest version
sudo ./update-rtpengine.sh

# Update to specific version
sudo ./update-rtpengine.sh --version v9.5.0

# Canary deployment (25% of instances)
sudo ./update-rtpengine.sh --mode canary

# Custom batch size
sudo ./update-rtpengine.sh --batch-size 2 --delay 120
```

### Update Process

1. **Pre-update**: Creates full backup
2. **Build**: Compiles new version
3. **Validation**: Tests new binary
4. **Rolling update**: Updates instances one by one
5. **Health checks**: Verifies each instance
6. **Auto-rollback**: Reverts on failure

### Maintenance Tasks

#### Log Rotation

Configure logrotate:

```bash
/var/log/rtpengine/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 rtpengine rtpengine
    sharedscripts
    postrotate
        systemctl reload rtpengine-* > /dev/null 2>&1 || true
    endscript
}
```

#### Disk Cleanup

```bash
# Clean old recordings
find /var/spool/rtpengine -name "*.pcap" -mtime +7 -delete

# Clean old logs
find /var/log/rtpengine -name "*.log.gz" -mtime +30 -delete
```

## Troubleshooting

### Common Issues

#### 1. Instance Won't Start

```bash
# Check logs
journalctl -u rtpengine-1 -n 100

# Verify configuration
rtpengine --config-file /etc/rtpengine/rtpengine-1.conf --config-check

# Check port conflicts
ss -tlnp | grep :7722
```

#### 2. High CPU Usage

```bash
# Check thread count
ps -eLf | grep rtpengine | wc -l

# Monitor per-core usage
mpstat -P ALL 1

# Check kernel module
lsmod | grep xt_RTPENGINE
```

#### 3. Packet Loss

```bash
# Check network buffers
cat /proc/sys/net/core/rmem_max
cat /proc/sys/net/core/wmem_max

# Monitor interface stats
watch -n1 'ip -s link show eth0'

# Check iptables rules
iptables -t raw -L -n -v
```

### Debug Mode

Enable debug logging:

```bash
# Edit configuration
log-level = 7
log-facility = local1

# Or via CLI
rtpengine-ctl -p 9080 set loglevel 7
```

### Performance Analysis

```bash
# CPU profiling
perf record -g -p $(pidof rtpengine)
perf report

# Memory analysis
valgrind --leak-check=full rtpengine

# Network analysis
tcpdump -i eth0 -w capture.pcap port 30000
```

## Security Considerations

### Network Security

1. **Firewall Rules**

```bash
# Allow RTP ports
iptables -A INPUT -p udp --dport 30000:40000 -j ACCEPT

# Restrict control ports to localhost
iptables -A INPUT -p tcp --dport 9080:9083 -s 127.0.0.1 -j ACCEPT
iptables -A INPUT -p tcp --dport 9080:9083 -j DROP
```

2. **Rate Limiting**

```bash
# Limit new connections
iptables -A INPUT -p udp --dport 30000:40000 \
    -m conntrack --ctstate NEW \
    -m limit --limit 100/second --limit-burst 200 \
    -j ACCEPT
```

### Authentication

Configure NG protocol authentication:

```ini
[rtpengine]
# Enable authentication
ng-auth = true
ng-auth-secret = your-secret-key
```

### TLS/DTLS

Enable DTLS for WebRTC:

```ini
[rtpengine]
dtls-passive = false
dtls-certificate = /etc/rtpengine/dtls-cert.pem
dtls-private-key = /etc/rtpengine/dtls-key.pem
```

## Performance Tuning

### Kernel Parameters

```bash
# Network buffers
echo 'net.core.rmem_max = 134217728' >> /etc/sysctl.conf
echo 'net.core.wmem_max = 134217728' >> /etc/sysctl.conf
echo 'net.core.netdev_max_backlog = 5000' >> /etc/sysctl.conf

# Apply settings
sysctl -p
```

### CPU Affinity

Bind instances to specific CPUs:

```bash
# In systemd service file
[Service]
CPUAffinity=0-3
```

### NUMA Optimization

For NUMA systems:

```bash
# Check NUMA topology
numactl --hardware

# Bind to NUMA node
numactl --cpunodebind=0 --membind=0 rtpengine
```

### Kernel Module

Enable kernel forwarding for better performance:

```bash
# Load module
modprobe xt_RTPENGINE

# Configure iptables
iptables -I INPUT -p udp -j RTPENGINE --id 0
```

## Maintenance Schedule

### Daily
- Monitor metrics and alerts
- Check disk usage
- Verify backup completion

### Weekly
- Review performance metrics
- Clean old recordings
- Update monitoring dashboards

### Monthly
- Security patches
- Performance analysis
- Capacity planning

### Quarterly
- Major version updates
- Architecture review
- Disaster recovery testing

## Support and Documentation

### Logs Location

- RTPEngine logs: `/var/log/rtpengine/`
- Deployment logs: `/var/log/rtpengine-deployment/`
- Backup logs: `/var/log/rtpengine-backup/`

### Getting Help

1. Check logs first
2. Review this documentation
3. Check RTPEngine GitHub issues
4. Contact support team

### Additional Resources

- [RTPEngine Documentation](https://github.com/sipwise/rtpengine)
- [Kamailio Integration Guide](https://www.kamailio.org/docs/modules/stable/modules/rtpengine.html)
- [Performance Tuning Guide](https://github.com/sipwise/rtpengine/wiki/Performance-Tuning)

---

Last Updated: December 2023