#!/bin/bash
# Reconnect vendor after updating database configuration
# Usage: ./reconnect-vendor.sh [vendor_name]

VENDOR_NAME=${1:-Sinch_Atlanta}

echo "=== SMPP Gateway Vendor Reconnect ==="
echo "Vendor: $VENDOR_NAME"
echo ""

# Get vendor ID
echo "Looking up vendor ID..."
VENDOR_ID=$(kubectl exec -n messaging $(kubectl get pod -n messaging -l app=smpp-gateway -o name | head -1) -- \
  wget -qO- http://localhost:8080/api/v1/vendors 2>/dev/null | \
  jq -r ".vendors | to_entries[] | select(.value.vendor_name==\"$VENDOR_NAME\") | .key")

if [ -z "$VENDOR_ID" ]; then
  echo "Error: Vendor '$VENDOR_NAME' not found"
  echo ""
  echo "Available vendors:"
  kubectl exec -n messaging $(kubectl get pod -n messaging -l app=smpp-gateway -o name | head -1) -- \
    wget -qO- http://localhost:8080/api/v1/vendors 2>/dev/null | \
    jq -r '.vendors | to_entries[] | "\(.value.vendor_name) (\(.key))"'
  exit 1
fi

echo "Vendor ID: $VENDOR_ID"
echo ""

# Show current status
echo "Current status:"
kubectl exec -n messaging $(kubectl get pod -n messaging -l app=smpp-gateway -o name | head -1) -- \
  wget -qO- http://localhost:8080/api/v1/vendors 2>/dev/null | \
  jq ".vendors.\"$VENDOR_ID\" | {status, last_error, connected_at}"

echo ""

# Trigger reconnect
echo "Triggering reconnect (reloading config from database)..."
kubectl exec -n messaging $(kubectl get pod -n messaging -l app=smpp-gateway -o name | head -1) -- \
  wget -qO- --post-data='' "http://localhost:8080/api/v1/vendors/reconnect/${VENDOR_ID}" 2>/dev/null | jq .

echo ""
echo "Waiting for connection attempt..."
sleep 3

# Show logs
echo ""
echo "Recent connection logs:"
kubectl logs -n messaging -l app=smpp-gateway --tail=50 | \
  grep -E "(SMPP Bind Request Parameters|TLS handshake|SMPP bind failed|Successfully bound)" | tail -10

echo ""
echo "Updated status:"
kubectl exec -n messaging $(kubectl get pod -n messaging -l app=smpp-gateway -o name | head -1) -- \
  wget -qO- http://localhost:8080/api/v1/vendors 2>/dev/null | \
  jq ".vendors.\"$VENDOR_ID\" | {vendor_name, status, last_error, messages_sent}"

echo ""
echo "Done!"
