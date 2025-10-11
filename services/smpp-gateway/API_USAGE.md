# SMPP Gateway API Usage Guide
**Version:** v1.3.0
**Updated:** October 10, 2025

## Quick Reference

### Get Vendor ID
First, get the vendor ID for Sinch_Atlanta:
```bash
kubectl exec -n messaging $(kubectl get pod -n messaging -l app=smpp-gateway -o name | head -1) -- \
  wget -qO- http://localhost:8080/api/v1/vendors | jq '.vendors | to_entries[] | {id: .key, name: .value.vendor_name}'
```

Example output:
```json
{
  "id": "9e22660d-6f2e-4761-8729-f4272d30eb71",
  "name": "Sinch_Atlanta"
}
```

Save the ID for use in commands below.

## Vendor Lifecycle Management

### 1. Reconnect Vendor (Reload Config + Reconnect)

**Use Case:** After updating credentials or config in PostgreSQL

```bash
# Set vendor ID
VENDOR_ID="9e22660d-6f2e-4761-8729-f4272d30eb71"

# Method 1: From inside cluster
kubectl exec -n messaging $(kubectl get pod -n messaging -l app=smpp-gateway -o name | head -1) -- \
  wget -qO- --post-data='' "http://localhost:8080/api/v1/vendors/reconnect/${VENDOR_ID}" | jq .

# Method 2: Via port-forward
kubectl port-forward -n messaging svc/smpp-gateway-api 8080:8080 &
curl -X POST http://localhost:8080/api/v1/vendors/reconnect/${VENDOR_ID} | jq .
```

**What It Does:**
1. Disconnects existing vendor connection
2. Reloads vendor config from PostgreSQL (fresh query)
3. Creates new client with updated config
4. Attempts new connection in background

**Response:**
```json
{
  "success": true,
  "message": "Vendor reconnection initiated",
  "vendor_id": "9e22660d-6f2e-4761-8729-f4272d30eb71"
}
```

### 2. Disconnect Vendor

**Use Case:** Temporarily stop sending to a vendor

```bash
VENDOR_ID="9e22660d-6f2e-4761-8729-f4272d30eb71"

kubectl exec -n messaging $(kubectl get pod -n messaging -l app=smpp-gateway -o name | head -1) -- \
  wget -qO- --post-data='' "http://localhost:8080/api/v1/vendors/disconnect/${VENDOR_ID}" | jq .
```

**Response:**
```json
{
  "success": true,
  "message": "Vendor disconnected",
  "vendor_id": "9e22660d-6f2e-4761-8729-f4272d30eb71"
}
```

### 3. Connect Vendor

**Use Case:** Reconnect without reloading config (uses existing in-memory config)

```bash
VENDOR_ID="9e22660d-6f2e-4761-8729-f4272d30eb71"

kubectl exec -n messaging $(kubectl get pod -n messaging -l app=smpp-gateway -o name | head -1) -- \
  wget -qO- --post-data='' "http://localhost:8080/api/v1/vendors/connect/${VENDOR_ID}" | jq .
```

**Response:**
```json
{
  "success": true,
  "message": "Vendor connection initiated",
  "vendor_id": "9e22660d-6f2e-4761-8729-f4272d30eb71"
}
```

## Monitoring & Status

### Check Vendor Status

```bash
kubectl exec -n messaging $(kubectl get pod -n messaging -l app=smpp-gateway -o name | head -1) -- \
  wget -qO- http://localhost:8080/api/v1/vendors | jq .
```

**Response:**
```json
{
  "success": true,
  "count": 1,
  "vendors": {
    "9e22660d-6f2e-4761-8729-f4272d30eb71": {
      "vendor_id": "9e22660d-6f2e-4761-8729-f4272d30eb71",
      "vendor_name": "Sinch_Atlanta",
      "status": "connected",
      "connected_at": "2025-10-10T23:00:25Z",
      "last_error": "",
      "messages_sent": 0,
      "messages_success": 0,
      "messages_failed": 0,
      "dlrs_received": 0
    }
  }
}
```

### Check Overall Statistics

```bash
kubectl exec -n messaging $(kubectl get pod -n messaging -l app=smpp-gateway -o name | head -1) -- \
  wget -qO- http://localhost:8080/api/v1/admin/stats | jq .
```

### View Detailed Connection Logs

```bash
# Watch logs in real-time
kubectl logs -n messaging -l app=smpp-gateway --tail=50 -f

# Filter for connection events
kubectl logs -n messaging -l app=smpp-gateway --tail=200 | \
  grep -E "(SMPP Bind|TLS handshake|bind failed|Successfully bound)"
```

## Typical Workflow: Testing New Credentials

### Step 1: Update Database
```sql
-- Connect to PostgreSQL
-- Update Sinch_Atlanta credentials
UPDATE vendor_mgmt.service_providers
SET
  username = 'new_system_id',
  password = 'new_password',
  system_type = 'new_type'  -- e.g., 'ESME', 'cp', 'smpp', etc.
WHERE instance_name = 'Sinch_Atlanta';
```

### Step 2: Get Vendor ID
```bash
VENDOR_ID=$(kubectl exec -n messaging $(kubectl get pod -n messaging -l app=smpp-gateway -o name | head -1) -- \
  wget -qO- http://localhost:8080/api/v1/vendors 2>/dev/null | \
  jq -r '.vendors | to_entries[] | select(.value.vendor_name=="Sinch_Atlanta") | .key')

echo "Vendor ID: $VENDOR_ID"
```

### Step 3: Trigger Reconnect
```bash
kubectl exec -n messaging $(kubectl get pod -n messaging -l app=smpp-gateway -o name | head -1) -- \
  wget -qO- --post-data='' "http://localhost:8080/api/v1/vendors/reconnect/${VENDOR_ID}" | jq .
```

### Step 4: Watch Logs
```bash
# Watch for connection attempt (should happen within 1-2 seconds)
kubectl logs -n messaging -l app=smpp-gateway --tail=100 -f | \
  grep -E "(SMPP Bind Request|TLS handshake|bind failed|Successfully bound)"
```

### Step 5: Verify Status
```bash
kubectl exec -n messaging $(kubectl get pod -n messaging -l app=smpp-gateway -o name | head -1) -- \
  wget -qO- http://localhost:8080/api/v1/vendors | \
  jq '.vendors."'$VENDOR_ID'"'
```

## Current Sinch Configuration

**From Logs (v1.3.0):**
```json
{
  "smsc": "msgbrokersmpp-atl.inteliquent.com:3601",
  "system_id": "telxMBa1",
  "password": "7C****{A",
  "system_type": "ESME",
  "bind_type": "TRX (transceiver)",
  "tls_enabled": true,
  "smpp_version": "3.4"
}
```

**Status:**
- ✅ TLS handshake successful (proves IP 34.58.165.135 is whitelisted)
- ❌ SMPP bind fails with EOF (Sinch closes connection)
- ❌ Error occurs AFTER TLS, during SMPP protocol exchange

## Testing Different Configurations

### Test Without System Type
```sql
UPDATE vendor_mgmt.service_providers
SET system_type = ''
WHERE instance_name = 'Sinch_Atlanta';
```

Then reconnect:
```bash
kubectl exec -n messaging $(kubectl get pod -n messaging -l app=smpp-gateway -o name | head -1) -- \
  wget -qO- --post-data='' "http://localhost:8080/api/v1/vendors/reconnect/${VENDOR_ID}" | jq .
```

### Test Different Bind Types

Currently hardcoded to **TRX** (transceiver). The `bind_type` column in the database exists but isn't used yet.

To test **TX** (transmitter) or **RX** (receiver), we'd need to modify the code to use `vendor.BindType`:
- `TRX` = Transceiver (send + receive)
- `TX` = Transmitter (send only)
- `RX` = Receiver (receive only)

## Error Reference

### Common Errors

**EOF after TLS:**
- **Meaning:** Sinch accepted TLS connection but closed during SMPP bind
- **Causes:**
  - Wrong bind type (expecting TX/RX instead of TRX)
  - Wrong system_type value
  - Wrong credentials
  - IP not fully activated on Sinch's end

**Connection timeout:**
- **Meaning:** Network issue or IP not whitelisted
- **Cause:** IP blocked by firewall or not in whitelist

**TLS dial failed:**
- **Meaning:** TLS handshake failed
- **Causes:**
  - Wrong port
  - Certificate issues
  - TLS version mismatch

## Prometheus Metrics

The gateway exposes Prometheus metrics at `/metrics`:
```bash
kubectl exec -n messaging $(kubectl get pod -n messaging -l app=smpp-gateway -o name | head -1) -- \
  wget -qO- http://localhost:8080/metrics | grep smpp_
```

Available metrics:
- `smpp_messages_sent_total`
- `smpp_messages_success_total`
- `smpp_messages_failed_total`
- `smpp_dlrs_received_total`
- `smpp_active_sessions`

## Complete API Reference

### GET Endpoints
| Endpoint | Description |
|----------|-------------|
| `/health` | General health check |
| `/ready` | Readiness (503 if no vendors connected) |
| `/api/v1/vendors` | List all vendors with status |
| `/api/v1/vendors/status` | Detailed vendor status |
| `/api/v1/messages/{id}` | Get message delivery status |
| `/api/v1/admin/stats` | Overall gateway statistics |
| `/api/v1/admin/sessions` | Active customer sessions |
| `/metrics` | Prometheus metrics |

### POST Endpoints
| Endpoint | Description | Parameters |
|----------|-------------|------------|
| `/api/v1/vendors/reconnect/{id}` | Reload config + reconnect | Vendor UUID |
| `/api/v1/vendors/disconnect/{id}` | Disconnect vendor | Vendor UUID |
| `/api/v1/vendors/connect/{id}` | Connect vendor | Vendor UUID |

## Next Steps for Sinch Debugging

1. **Contact Sinch Support** with this information:
   - Source IP: 34.58.165.135
   - Destination: msgbrokersmpp-atl.inteliquent.com:3601
   - System ID: telxMBa1
   - System Type: ESME
   - Bind Type: TRX (transceiver)
   - Error: EOF after successful TLS handshake
   - Ask: "What bind type and system_type do you expect?"

2. **Try Different Bind Types** (requires code change)
   - Test TX (transmitter only)
   - Test RX (receiver only)

3. **Test Alternative System Types**
   ```sql
   -- Try empty
   UPDATE vendor_mgmt.service_providers SET system_type = '' WHERE instance_name = 'Sinch_Atlanta';

   -- Try 'cp' (from old email)
   UPDATE vendor_mgmt.service_providers SET system_type = 'cp' WHERE instance_name = 'Sinch_Atlanta';

   -- Try 'smpp'
   UPDATE vendor_mgmt.service_providers SET system_type = 'smpp' WHERE instance_name = 'Sinch_Atlanta';
   ```

   After each change, reconnect via API.

## Helper Scripts

Save this as `reconnect-vendor.sh`:
```bash
#!/bin/bash
VENDOR_NAME=${1:-Sinch_Atlanta}

# Get vendor ID
VENDOR_ID=$(kubectl exec -n messaging $(kubectl get pod -n messaging -l app=smpp-gateway -o name | head -1) -- \
  wget -qO- http://localhost:8080/api/v1/vendors 2>/dev/null | \
  jq -r ".vendors | to_entries[] | select(.value.vendor_name==\"$VENDOR_NAME\") | .key")

if [ -z "$VENDOR_ID" ]; then
  echo "Error: Vendor '$VENDOR_NAME' not found"
  exit 1
fi

echo "Reconnecting vendor: $VENDOR_NAME ($VENDOR_ID)"

# Trigger reconnect
kubectl exec -n messaging $(kubectl get pod -n messaging -l app=smpp-gateway -o name | head -1) -- \
  wget -qO- --post-data='' "http://localhost:8080/api/v1/vendors/reconnect/${VENDOR_ID}" 2>/dev/null | jq .

# Wait and check status
sleep 3
kubectl logs -n messaging -l app=smpp-gateway --tail=30 | grep -E "(SMPP Bind Request|TLS handshake|bind failed|Successfully bound)"
```

Usage:
```bash
chmod +x reconnect-vendor.sh
./reconnect-vendor.sh Sinch_Atlanta
```
