#!/bin/bash

# Create Kubernetes secrets for Cloud SQL
set -e

# Connection details
PRIVATE_IP="10.126.0.3"
DATABASE="warp"
CONNECTION_NAME="ringer-warp-v01:us-central1:warp-db"

# User credentials (from our successful setup)
APP_USER="warp_app"
APP_PASS="WarpApp2024"
WARP_USER="warp"
WARP_PASS="Warp2024"
RO_USER="warp_readonly"
RO_PASS="ReadOnly2024"

echo "=== Creating Kubernetes Secrets ==="

# Main application secret
kubectl delete secret cloudsql-db-credentials 2>/dev/null || true
kubectl create secret generic cloudsql-db-credentials \
  --from-literal=username=$APP_USER \
  --from-literal=password="$APP_PASS" \
  --from-literal=database=$DATABASE \
  --from-literal=host=$PRIVATE_IP \
  --from-literal=port=5432 \
  --from-literal=connection-string="postgresql://${APP_USER}:${APP_PASS}@${PRIVATE_IP}:5432/${DATABASE}"

echo "✓ Created secret: cloudsql-db-credentials"

# Warp user secret
kubectl delete secret cloudsql-warp-credentials 2>/dev/null || true
kubectl create secret generic cloudsql-warp-credentials \
  --from-literal=username=$WARP_USER \
  --from-literal=password="$WARP_PASS" \
  --from-literal=database=$DATABASE \
  --from-literal=host=$PRIVATE_IP \
  --from-literal=port=5432 \
  --from-literal=connection-string="postgresql://${WARP_USER}:${WARP_PASS}@${PRIVATE_IP}:5432/${DATABASE}"

echo "✓ Created secret: cloudsql-warp-credentials"

# Read-only secret
kubectl delete secret cloudsql-readonly-credentials 2>/dev/null || true
kubectl create secret generic cloudsql-readonly-credentials \
  --from-literal=username=$RO_USER \
  --from-literal=password="$RO_PASS" \
  --from-literal=database=$DATABASE \
  --from-literal=host=$PRIVATE_IP \
  --from-literal=port=5432

echo "✓ Created secret: cloudsql-readonly-credentials"

# ConfigMap with non-sensitive info
kubectl delete configmap cloudsql-config 2>/dev/null || true
kubectl create configmap cloudsql-config \
  --from-literal=database=$DATABASE \
  --from-literal=host=$PRIVATE_IP \
  --from-literal=port=5432 \
  --from-literal=sslmode=disable \
  --from-literal=connection-timeout=10

echo "✓ Created configmap: cloudsql-config"

# Test the connection
echo
echo "=== Testing Connection ==="
kubectl run psql-test-final --image=postgres:15 --rm -it --restart=Never -- \
  psql "postgresql://${WARP_USER}:${WARP_PASS}@${PRIVATE_IP}:5432/${DATABASE}" \
  -c "SELECT current_database(), current_user, inet_client_addr(), version();"