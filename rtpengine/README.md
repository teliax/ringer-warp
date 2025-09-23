# RTPEngine Deployment for Ringer-Warp

This directory contains all necessary files and scripts to deploy RTPEngine on the voice infrastructure VMs.

## Quick Start

1. **Check VM Status**:
   ```bash
   ./scripts/check_rtpengine_status.sh
   ```

2. **Deploy RTPEngine** (after configuring SSH in the script):
   ```bash
   ./scripts/deploy_rtpengine.sh
   ```

3. **Monitor RTPEngine**:
   ```bash
   ./scripts/monitor_rtpengine.sh
   ```

## Directory Structure

```
rtpengine/
├── scripts/
│   ├── check_rtpengine_status.sh    # Check current VM status
│   ├── install_rtpengine.sh         # RTPEngine installation script
│   ├── deploy_rtpengine.sh          # Main deployment orchestrator
│   ├── configure_firewall.sh        # Firewall configuration
│   └── monitor_rtpengine.sh         # Real-time monitoring
├── config/
│   ├── rtpengine.conf               # Base configuration template
│   ├── rtpengine-vm1.conf           # VM1 specific config (34.123.38.31)
│   ├── rtpengine-vm2.conf           # VM2 specific config (35.222.101.214)
│   ├── rtpengine-vm3.conf           # VM3 specific config (35.225.65.80)
│   └── kamailio-rtpengine.cfg       # Kamailio integration config
├── systemd/
│   └── rtpengine.service            # Systemd service file
└── docs/
    ├── DEPLOYMENT_GUIDE.md          # Step-by-step deployment guide
    └── CONFIGURATION_REFERENCE.md   # Configuration options reference
```

## VM Information

- **VM1**: 34.123.38.31 (rtpengine-1)
- **VM2**: 35.222.101.214 (rtpengine-2)
- **VM3**: 35.225.65.80 (rtpengine-3)

## Key Features Configured

- **High Availability**: Redis-based session sharing
- **Load Balancing**: Multiple RTPEngine instances
- **WebRTC Support**: DTLS and ICE handling
- **Monitoring**: Prometheus metrics endpoint
- **Security**: Proper firewall rules and SSL/TLS
- **Performance**: Optimized kernel parameters

## Documentation

- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) - Complete deployment instructions
- [Configuration Reference](docs/CONFIGURATION_REFERENCE.md) - All configuration options explained

## Support

For issues or questions:
- Check logs: `sudo journalctl -u rtpengine -f`
- Run diagnostics: `sudo rtpengine-ctl statistics`
- Monitor performance: `./scripts/monitor_rtpengine.sh`