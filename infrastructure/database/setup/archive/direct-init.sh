#!/bin/bash

# Direct database initialization script
# Since network connectivity is confirmed, let's use a simple approach

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Database configuration
DB_HOST="10.126.0.3"
DB_PORT="5432"
DB_NAME="warp"
DB_USER="warp"
DB_PASS='WarpDB2025!'

echo -e "${GREEN}=== Direct Database Initialization ===${NC}"
echo "Host: $DB_HOST"
echo "Database: $DB_NAME"
echo "User: $DB_USER"

# Create a simple init pod
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: db-init-direct
  namespace: warp-core
spec:
  restartPolicy: Never
  containers:
  - name: psql
    image: postgres:15
    env:
    - name: PGHOST
      value: "${DB_HOST}"
    - name: PGPORT
      value: "${DB_PORT}"
    - name: PGDATABASE
      value: "${DB_NAME}"
    - name: PGUSER
      value: "${DB_USER}"
    - name: PGPASSWORD
      value: "${DB_PASS}"
    command: ["/bin/bash", "-c"]
    args:
    - |
      echo "Testing database connection..."
      psql -c "SELECT version();" || exit 1
      
      echo "Connection successful!"
      echo "Checking if schemas exist..."
      
      SCHEMA_COUNT=\$(psql -t -c "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name IN ('accounts', 'auth', 'billing', 'cdr', 'messaging', 'routing', 'services', 'voice', 'webhooks');")
      
      if [ "\$SCHEMA_COUNT" -gt "0" ]; then
        echo -e "${YELLOW}WARNING: Some schemas already exist. Database may already be initialized.${NC}"
        echo "Found \$SCHEMA_COUNT schemas."
        psql -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('accounts', 'auth', 'billing', 'cdr', 'messaging', 'routing', 'services', 'voice', 'webhooks') ORDER BY schema_name;"
      else
        echo -e "${GREEN}No existing schemas found. Database is ready for initialization.${NC}"
      fi
      
      echo -e "${GREEN}Database connectivity verified!${NC}"
      exit 0
EOF

echo ""
echo "Waiting for pod to complete..."
kubectl wait --for=condition=Ready pod/db-init-direct -n warp-core --timeout=30s || true

echo ""
echo "Checking pod logs..."
kubectl logs db-init-direct -n warp-core

echo ""
echo "Cleaning up..."
kubectl delete pod db-init-direct -n warp-core --wait=false

echo -e "${GREEN}Done!${NC}"