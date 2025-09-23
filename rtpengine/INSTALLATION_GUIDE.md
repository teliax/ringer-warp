# RTPEngine Installation Guide

## For VM1 (Already Complete)
RTPEngine is running successfully on VM1 (10.0.1.2).

## For VM2 and VM3

### Quick Installation Steps

1. **SSH to the VM**:
   ```bash
   gcloud compute ssh warp-rtpengine-2 --zone=us-central1-b
   # or
   gcloud compute ssh warp-rtpengine-3 --zone=us-central1-c
   ```

2. **Clone the repository**:
   ```bash
   git clone https://github.com/teliax/ringer-warp.git
   cd ringer-warp
   ```

3. **Install dependencies and build RTPEngine**:
   ```bash
   # Install all dependencies
   sudo apt-get update
   sudo apt-get install -y \
       build-essential git curl wget pandoc \
       libavcodec-dev libavfilter-dev libavformat-dev libavutil-dev \
       libcurl4-gnutls-dev libglib2.0-dev libhiredis-dev \
       libjson-glib-dev libpcap-dev libpcre3-dev libssl-dev \
       libxmlrpc-core-c3-dev zlib1g-dev libsystemd-dev \
       libip4tc-dev libip6tc-dev libiptc-dev libxtables-dev \
       libmnl-dev libnftnl-dev libnftables-dev \
       libmariadb-dev default-libmysqlclient-dev \
       libspandsp-dev libopus-dev libwebsockets-dev \
       libevent-dev libpcap0.8-dev ffmpeg \
       libbencode-perl libcrypt-rijndael-perl libdigest-crc-perl \
       libdigest-hmac-perl libio-socket-inet6-perl libjson-perl \
       libnet-interface-perl libsocket6-perl libconfig-tiny-perl
   ```

4. **Build RTPEngine from source**:
   ```bash
   cd /usr/local/src
   sudo git clone https://github.com/sipwise/rtpengine.git
   cd rtpengine
   sudo git checkout -B mr13.4.1 origin/mr13.4.1
   sudo CFLAGS="-O3" make -j$(nproc) WITH_TRANSCODING=yes BUILD_DOCS=no
   sudo make install
   ```

5. **Configure RTPEngine**:
   ```bash
   cd ~/ringer-warp
   sudo ./rtpengine/scripts/configure_rtpengine.sh
   ```

6. **Verify installation**:
   ```bash
   sudo ./rtpengine/scripts/test_rtpengine.sh
   ```

## Expected Results

After successful installation on all VMs:

- **VM1**: 10.0.1.2:22222 (us-central1-a) ✅ Running
- **VM2**: 10.0.1.3:22222 (us-central1-b) 
- **VM3**: 10.0.1.4:22222 (us-central1-c)

## Kamailio Integration

Once all RTPEngine instances are running, update Kamailio configuration:

```kamailio
# RTPEngine control sockets
modparam("rtpengine", "rtpengine_sock", "udp:10.0.1.2:22222=1")
modparam("rtpengine", "rtpengine_sock", "udp:10.0.1.3:22222=2") 
modparam("rtpengine", "rtpengine_sock", "udp:10.0.1.4:22222=3")
```

## Troubleshooting

If RTPEngine fails to start:
1. Check logs: `sudo journalctl -u rtpengine -f`
2. Verify config: `sudo rtpengine --config-file=/etc/rtpengine/rtpengine.conf --foreground`
3. Check firewall: `sudo iptables -L -n | grep 22222`
4. Test manually: `echo "1 ping" | nc -u 127.0.0.1 22222`

## Monitoring

Use the monitoring script to check health:
```bash
sudo ./rtpengine/scripts/monitor_rtpengine.sh
```