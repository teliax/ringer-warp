# RTPEngine Golden Image Installation Guide

This directory contains everything needed to create a production-ready RTPEngine mr13.4.1 installation from source.

## Overview

RTPEngine is a proxy for RTP traffic and other UDP-based media traffic. It's meant to be used with SIP proxies like Kamailio or OpenSIPS.

## Files Included

- `install-rtpengine-golden.sh` - Complete installation script
- `rtpengine.conf.template` - Production-ready configuration template
- `optimize-system.sh` - Kernel and system optimizations
- `test-rtpengine.sh` - Comprehensive testing script

## System Requirements

- **OS**: Debian 11 or Ubuntu 20.04+ (64-bit)
- **RAM**: Minimum 4GB, 8GB+ recommended for production
- **CPU**: Multi-core processor recommended
- **Kernel**: Linux 4.19+ (5.x recommended)
- **Storage**: 20GB+ for recordings

## Quick Installation

```bash
# Run as root
sudo -i

# Clone this repository
cd /home/daldworth/repos/ringer-warp/rtpengine/golden-image/

# Run installation
./install-rtpengine-golden.sh

# Apply system optimizations
./optimize-system.sh

# Configure RTPEngine
cp rtpengine.conf.template /etc/rtpengine/rtpengine.conf
nano /etc/rtpengine/rtpengine.conf  # Edit configuration

# Start service
systemctl start rtpengine
systemctl enable rtpengine

# Test installation
./test-rtpengine.sh
```

## Configuration Guide

### Essential Configuration Parameters

1. **Network Interfaces**
   ```
   interface = public/YOUR_PUBLIC_IP!YOUR_PUBLIC_IP
   interface = private/YOUR_PRIVATE_IP!YOUR_PRIVATE_IP
   ```

2. **Port Range**
   ```
   port-min = 30000
   port-max = 40000
   ```

3. **Worker Threads**
   ```
   num-threads = 8  # Set to number of CPU cores
   ```

4. **Control Interfaces**
   ```
   listen-ng = 127.0.0.1:22222      # NG protocol
   listen-cli = 127.0.0.1:9900      # CLI interface
   ```

### Production Checklist

- [ ] Update network interface IPs in configuration
- [ ] Configure appropriate port range for your traffic volume
- [ ] Set worker threads to match CPU cores
- [ ] Configure log levels and destinations
- [ ] Set up log rotation
- [ ] Configure monitoring endpoints
- [ ] Set up firewall rules for RTP ports
- [ ] Configure Redis for distributed deployments
- [ ] Set up recording storage if needed
- [ ] Configure Homer/HEP integration if using

## Kernel Optimizations

The `optimize-system.sh` script applies:

- Network buffer optimizations
- CPU governor settings (performance mode)
- IRQ affinity configuration
- Huge pages setup
- Connection tracking optimizations
- File descriptor limits
- System security hardening

## Testing

Run the comprehensive test suite:

```bash
./test-rtpengine.sh
```

This tests:
- Binary installation
- Kernel module loading
- Configuration validity
- Service status
- Control protocol connectivity
- NG protocol commands
- Port allocation
- Resource limits
- Kernel optimizations

## Monitoring

Monitor RTPEngine performance:

```bash
# Real-time statistics
/usr/local/bin/rtpengine-monitor.sh

# CLI interface
echo "list totals" | nc 127.0.0.1 9900

# Using rtpengine-ctl
rtpengine-ctl list statistics
```

## Troubleshooting

### Service won't start
```bash
# Check logs
journalctl -u rtpengine -n 100

# Verify configuration
/usr/local/bin/rtpengine --config-file /etc/rtpengine/rtpengine.conf --config-test

# Check kernel module
lsmod | grep xt_RTPENGINE
```

### High CPU usage
- Reduce `num-threads` if overprovisioned
- Check for codec transcoding load
- Monitor with `htop` and `/usr/local/bin/rtpengine-monitor.sh`

### Memory issues
- Increase system memory
- Configure huge pages properly
- Check for memory leaks in logs

## Security Considerations

1. **Firewall Rules**
   ```bash
   # Control ports (internal only)
   iptables -A INPUT -p tcp --dport 22222 -s 127.0.0.1 -j ACCEPT
   iptables -A INPUT -p tcp --dport 9900 -s 127.0.0.1 -j ACCEPT
   
   # RTP ports (adjust source as needed)
   iptables -A INPUT -p udp --dport 30000:40000 -j ACCEPT
   ```

2. **File Permissions**
   - Configuration files should be readable only by rtpengine user
   - Recording directories should have appropriate permissions

3. **Network Security**
   - Use private interfaces for control protocols
   - Implement rate limiting for DoS protection
   - Monitor for unusual traffic patterns

## Performance Tuning

### For High Traffic (>1000 concurrent calls)
- Increase `port-max` - `port-min` range
- Use Redis for distributed deployments
- Enable kernel forwarding table
- Increase worker threads
- Use multiple network queues

### For Low Latency
- Enable CPU performance governor
- Configure IRQ affinity
- Use huge pages
- Disable unnecessary services
- Optimize network card settings

## Maintenance

### Log Rotation
```bash
# Add to /etc/logrotate.d/rtpengine
/var/log/rtpengine/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    sharedscripts
    postrotate
        /bin/kill -HUP `cat /var/run/rtpengine/rtpengine.pid 2>/dev/null` 2>/dev/null || true
    endscript
}
```

### Upgrades
1. Backup configuration
2. Stop service
3. Follow installation steps with new version
4. Test thoroughly before production

## Support Resources

- [RTPEngine Documentation](https://github.com/sipwise/rtpengine)
- [RTPEngine Wiki](https://github.com/sipwise/rtpengine/wiki)
- [Mailing List](http://lists.sipwise.com/listinfo/spce-user)

## License

RTPEngine is released under the GPLv3 license.