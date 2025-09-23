# RTPEngine VM SSH Commands

This document provides SSH commands to connect to each RTPEngine VM.

## Prerequisites

- gcloud CLI installed and configured
- Proper authentication to project `ringer-warp-v01`
- SSH keys configured for Google Compute Engine

## VM Connection Details

### RTPEngine VM1 (warp-rtpengine-1)
- **External IP**: 34.123.38.31
- **Internal IP**: 10.0.1.2
- **Zone**: us-central1-a
- **SSH Command**: 
```bash
gcloud compute ssh warp-rtpengine-1 --project=ringer-warp-v01 --zone=us-central1-a
```

### RTPEngine VM2 (warp-rtpengine-2)
- **External IP**: 35.222.101.214
- **Internal IP**: 10.0.1.3
- **Zone**: us-central1-b
- **SSH Command**: 
```bash
gcloud compute ssh warp-rtpengine-2 --project=ringer-warp-v01 --zone=us-central1-b
```

### RTPEngine VM3 (warp-rtpengine-3)
- **External IP**: 35.225.65.80
- **Internal IP**: 10.0.1.4
- **Zone**: us-central1-c
- **SSH Command**: 
```bash
gcloud compute ssh warp-rtpengine-3 --project=ringer-warp-v01 --zone=us-central1-c
```

## Quick Commands

### Check RTPEngine Status on VM
```bash
sudo systemctl status rtpengine
```

### View RTPEngine Logs
```bash
sudo tail -f /var/log/rtpengine/rtpengine.log
```

### Check RTPEngine Configuration
```bash
sudo cat /etc/rtpengine/rtpengine.conf
```

### Restart RTPEngine Service
```bash
sudo systemctl restart rtpengine
```

### Check Active Ports
```bash
sudo netstat -tuln | grep -E '(2223|9101|3478)'
```

### View Metrics
```bash
curl http://localhost:9101/metrics
```

### Check Redis Connection
```bash
redis-cli -h 10.206.200.36 -p 6379 ping
```

## Troubleshooting Commands

### Check Kernel Module
```bash
lsmod | grep xt_RTPENGINE
```

### View System Logs
```bash
sudo journalctl -u rtpengine -f
```

### Check Firewall Rules
```bash
sudo iptables -L -n -v | grep -E '(2223|30000|40000)'
```

### Test Control Protocol
```bash
echo -n "1 ping" | nc -u -w1 localhost 2223
```

## Batch Commands

### Execute command on all VMs
```bash
# With correct zones
declare -A zones=( ["warp-rtpengine-1"]="us-central1-a" ["warp-rtpengine-2"]="us-central1-b" ["warp-rtpengine-3"]="us-central1-c" )
for vm in "${!zones[@]}"; do
    echo "=== $vm ==="
    gcloud compute ssh $vm --project=ringer-warp-v01 --zone="${zones[$vm]}" --command="sudo systemctl status rtpengine"
done
```

### Copy file to all VMs
```bash
# With correct zones
declare -A zones=( ["warp-rtpengine-1"]="us-central1-a" ["warp-rtpengine-2"]="us-central1-b" ["warp-rtpengine-3"]="us-central1-c" )
for vm in "${!zones[@]}"; do
    gcloud compute scp /local/path/file $vm:/tmp/file --project=ringer-warp-v01 --zone="${zones[$vm]}"
done
```

## Notes

- VMs are distributed across zones for high availability:
  - warp-rtpengine-1: us-central1-a
  - warp-rtpengine-2: us-central1-b
  - warp-rtpengine-3: us-central1-c
- Use the correct `--zone` parameter for each VM
- Add `--ssh-key-file=/path/to/key` if using custom SSH keys