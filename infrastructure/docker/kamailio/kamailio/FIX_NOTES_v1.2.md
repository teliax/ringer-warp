# Kamailio v1.2 Fix Notes

## Issue in v1.1
The Kamailio v1.1 Docker image had a configuration parsing error:
```
unable to resolve advertised name Not
```

This error occurred when the `PUBLIC_IP` environment variable was not properly set, resulting in invalid advertise syntax in kamailio.cfg.

## Root Cause
1. When `PUBLIC_IP` was empty or not set, the configuration line:
   ```
   listen=udp:__PRIVATE_IP__:5060 advertise __PUBLIC_IP__:5060
   ```
   Would become:
   ```
   listen=udp:10.0.0.1:5060 advertise :5060
   ```

2. The empty advertise address (`:5060`) caused Kamailio to fail parsing the configuration.

## Fix in v1.2

### 1. Enhanced IP Detection (docker-entrypoint.sh)
- Improved metadata service error handling
- Added validation to ensure both PUBLIC_IP and PRIVATE_IP are set
- Added debug logging to show detected IP addresses
- Exit with error if IPs cannot be determined

### 2. Smart Advertise Handling
- If PUBLIC_IP equals PRIVATE_IP (common in private networks), the advertise directive is removed
- This prevents unnecessary NAT traversal configuration when not needed

### 3. Configuration Validation
- Added check to ensure all placeholder variables are replaced before starting Kamailio
- Display all configuration variables for debugging

## Building v1.2

```bash
cd /home/daldworth/repos/ringer-warp/warp/docker/kamailio
./build-and-push-v1.2.sh
```

## Deploying v1.2

Update your Kubernetes deployment:
```bash
kubectl set image deployment/kamailio kamailio=us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/kamailio:v1.2 -n warp
```

## Testing

The fix includes:
1. Better error messages when IPs cannot be determined
2. Configuration variable display for debugging
3. Validation that all placeholders are replaced

## Environment Variables

The following environment variables control the configuration:
- `PUBLIC_IP`: Public/advertised IP (auto-detected from GCE metadata if not set)
- `PRIVATE_IP`: Private/bind IP (auto-detected from hostname if not set)
- `DB_HOST`: PostgreSQL host (default: 34.42.208.57)
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_NAME`: Database name (default: warp)
- `DB_USER`: Database user (default: warp)
- `DB_PASS`: Database password (must be set via Kubernetes secret)
- `SIP_DOMAIN`: SIP domain (default: ringer.tel)
- `RTPENGINE_LIST`: RTPEngine socket (default: udp:rtpengine:2223)