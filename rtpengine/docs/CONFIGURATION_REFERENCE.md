# RTPEngine Configuration Reference

## Configuration File Format

RTPEngine uses an INI-style configuration file, typically located at `/etc/rtpengine/rtpengine.conf`.

## Core Configuration Options

### Network Interface Configuration

```ini
# Single interface
interface = [NAME/]IP[!IP]

# Multiple interfaces
interface = internal/10.0.0.10
interface = external/203.0.113.10!203.0.113.10

# Examples:
interface = 192.168.1.10              # Simple IP binding
interface = eth0                      # Bind to interface name
interface = external/1.2.3.4!1.2.3.4  # Named with public/private IP
```

### Control Protocol

```ini
# NG Protocol (recommended for Kamailio)
listen-ng = 127.0.0.1:22222
listen-ng = [::1]:22222              # IPv6

# Legacy protocols
listen-tcp = 127.0.0.1:22222
listen-udp = 127.0.0.1:22222

# CLI interface
listen-cli = 127.0.0.1:22223
```

### Media Port Range

```ini
# UDP port range for RTP/RTCP
port-min = 30000
port-max = 40000
```

### Performance Settings

```ini
# Number of worker threads
num-threads = 16

# Thread stack size (KB)
thread-stack = 2048

# Maximum concurrent sessions
max-sessions = 10000

# CPU/Load limits (0.0-1.0)
max-load = 0.8
max-cpu = 0.9

# Bandwidth limit (bits/sec)
max-bandwidth = 1000000000
```

### Timeouts

```ini
# Default timeout for inactive streams (seconds)
timeout = 60

# Timeout for silent streams
silent-timeout = 3600

# Final timeout after session termination
final-timeout = 10800

# Offer timeout
offer-timeout = 3600
```

### Logging

```ini
# Log level: 0=EMERG to 7=DEBUG
log-level = 6

# Log to stderr
log-stderr = false

# Syslog facility
log-facility = daemon
log-facility = local5

# Log to file
log-file = /var/log/rtpengine/rtpengine.log

# Log prefix
log-prefix = rtpengine
```

### Redis Configuration

```ini
# Redis server for HA/clustering
redis = 127.0.0.1:6379
redis = [::1]:6379                   # IPv6

# Redis database number
redis-db = 1

# Key expiration (seconds)
redis-expires = 86400

# Error handling
redis-allowed-errors = -1
redis-disable-time = 10

# Timeouts
redis-cmd-timeout = 0
redis-connect-timeout = 10

# Authentication
redis-auth = your_redis_password

# Key prefix
redis-prefix = rtpengine
```

### Recording Options

```ini
# Recording directory
recording-dir = /var/spool/rtpengine

# Recording method
recording-method = proc
recording-method = pcap
recording-method = mixed

# Recording format
recording-format = wav
recording-format = mp3

# Recording metadata
recording-meta-file = /var/spool/rtpengine/metadata
```

### Kernel Module

```ini
# Kernel forwarding table
table = 0

# Disable fallback to userspace
no-fallback = false
```

### QoS Settings

```ini
# TOS value for RTP packets
tos = 184                           # CS5 + ECT(0)

# Socket priority
socket-priority = 6
```

### WebRTC/DTLS Support

```ini
# DTLS certificates
cert = /etc/rtpengine/cert.pem
key = /etc/rtpengine/key.pem

# DTLS settings
dtls-passive = false
dtls-mtu = 1200

# Cipher list
cipher-list = DEFAULT:!NULL:!aNULL:!MD5:!DSS
```

### ICE Support

```ini
# ICE processing
ice-force = true
ice-force-relay = false
ice-lite = false
ice-tcp = false

# ICE candidate filtering
ice-filter = blacklist
ice-filter-list = 192.168.0.0/16,10.0.0.0/8
```

### STUN/TURN

```ini
# Enable STUN
stun-only = false

# Enable TURN
turn = true
turn-ttl = 86400

# TURN credentials
turn-username = user
turn-password = pass
```

### Transcoding

```ini
# Enable transcoding
transcode = G711,G722,opus,AMR

# Always transcode
always-transcode = false

# Codec preferences
codec-order = opus,G722,PCMU,PCMA
```

### NAT Handling

```ini
# Symmetric RTP
symmetric-codecs = false
asymmetric-codecs = false

# RTCP multiplexing
rtcp-mux-require = false
rtcp-mux-offer = true

# Force media relay
force-relay = false
```

### Monitoring Integration

```ini
# Homer/HEP
homer = 127.0.0.1:9060
homer-protocol = udp
homer-id = 1001

# Graphite
graphite = 127.0.0.1:2003
graphite-interval = 60
graphite-prefix = rtpengine

# Prometheus
prometheus-endpoint = 0.0.0.0:9103
```

### Advanced Options

```ini
# B2B User Agent
b2b-url = http://127.0.0.1:8080/

# Jitter buffer
jitter-buffer = 50
jitter-buffer-delay = 100

# SIP OPTIONS ping
sip-ping = true
sip-ping-interval = 30

# Media addresses
media-address = 1.2.3.4
media-address-ipv6 = 2001:db8::1

# Advertisement address
advertised-address = 1.2.3.4
```

## Command Line Options

RTPEngine can also be configured via command line:

```bash
rtpengine \
  --interface=192.168.1.10 \
  --listen-ng=127.0.0.1:22222 \
  --port-min=30000 \
  --port-max=40000 \
  --log-level=6 \
  --log-facility=daemon
```

## Environment Variables

```bash
# Override config file location
RTPENGINE_CONFIG=/etc/rtpengine/custom.conf

# Additional options
RTPENGINE_OPTS="--table=0"
```

## Configuration Examples

### Basic Configuration

```ini
[rtpengine]
interface = 192.168.1.10
listen-ng = 127.0.0.1:22222
port-min = 30000
port-max = 40000
log-level = 6
log-facility = local5
```

### High Availability Configuration

```ini
[rtpengine]
interface = external/10.0.0.10!203.0.113.10
listen-ng = 0.0.0.0:22222
port-min = 30000
port-max = 40000
redis = 10.0.0.100:6379
redis-db = 1
redis-expires = 86400
max-sessions = 20000
num-threads = 32
```

### WebRTC Configuration

```ini
[rtpengine]
interface = external/10.0.0.10!203.0.113.10
listen-ng = 127.0.0.1:22222
port-min = 30000
port-max = 40000
cert = /etc/rtpengine/cert.pem
key = /etc/rtpengine/key.pem
dtls-passive = false
ice-force = true
ice-force-relay = false
rtcp-mux-offer = true
```

### Recording Configuration

```ini
[rtpengine]
interface = 192.168.1.10
listen-ng = 127.0.0.1:22222
port-min = 30000
port-max = 40000
recording-dir = /var/spool/rtpengine
recording-method = mixed
recording-format = wav
```

## Kamailio Integration Parameters

### RTPEngine Manage Flags

```
# Basic flags
RTP/AVP         - Force RTP/AVP profile
RTP/SAVP        - Force RTP/SAVP profile
RTP/AVPF        - Force RTP/AVPF profile
RTP/SAVPF       - Force RTP/SAVPF profile

# ICE handling
ICE=force       - Force ICE processing
ICE=remove      - Remove ICE attributes
ICE=force-relay - Force relay candidates

# Address handling
replace-origin           - Replace origin in SDP
replace-session-connection - Replace connection address

# Direction flags
direction=internal - Internal network side
direction=external - External network side

# DTLS flags
DTLS=passive    - DTLS passive mode
DTLS=active     - DTLS active mode
DTLS=off        - Disable DTLS

# Transcoding
transcode-PCMU  - Transcode to PCMU
transcode-PCMA  - Transcode to PCMA
transcode-opus  - Transcode to Opus

# Recording
record-call     - Enable recording
```

### Usage Example

```cfg
rtpengine_manage("replace-origin replace-session-connection ICE=force RTP/SAVPF");
```

## Performance Tuning Tips

1. **CPU Affinity**: Bind RTPEngine threads to specific CPUs
2. **Kernel Module**: Use kernel forwarding for better performance
3. **Thread Count**: Set to number of CPU cores
4. **Memory**: Ensure sufficient memory for session table
5. **Network Buffers**: Tune kernel network buffers

## Security Best Practices

1. **Bind to Localhost**: For control ports when possible
2. **Firewall Rules**: Restrict RTP ports to necessary ranges
3. **Redis Auth**: Use authentication for Redis
4. **SSL/TLS**: Use strong ciphers for DTLS
5. **Monitoring**: Enable logging and metrics