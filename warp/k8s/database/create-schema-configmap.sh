#!/bin/bash
# Script to create ConfigMap from schema files

SCHEMA_DIR="/home/daldworth/repos/ringer-warp/warp/database/schema"
NAMESPACE="warp-core"

# Delete existing configmap if it exists
kubectl delete configmap warp-db-schema -n $NAMESPACE --ignore-not-found

# Create configmap from schema files
kubectl create configmap warp-db-schema \
  --from-file=$SCHEMA_DIR/00_extensions.sql \
  --from-file=$SCHEMA_DIR/01_accounts.sql \
  --from-file=$SCHEMA_DIR/02_auth.sql \
  --from-file=$SCHEMA_DIR/03_numbers.sql \
  --from-file=$SCHEMA_DIR/04_routing.sql \
  --from-file=$SCHEMA_DIR/05_cdr.sql \
  --from-file=$SCHEMA_DIR/06_messaging.sql \
  --from-file=$SCHEMA_DIR/07_billing.sql \
  --from-file=$SCHEMA_DIR/08_vendor_mgmt.sql \
  --from-file=$SCHEMA_DIR/09_audit.sql \
  --from-file=$SCHEMA_DIR/10_indexes_performance.sql \
  --from-file=$SCHEMA_DIR/11_seed_data.sql \
  -n $NAMESPACE

echo "ConfigMap warp-db-schema created successfully"