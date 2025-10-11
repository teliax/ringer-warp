#!/bin/bash
set -e

echo "Initializing WARP database schema..."

DB_HOST="10.126.0.3"
DB_PORT="5432"
DB_USER="warp_app"
DB_NAME="warp"

# Copy schema to temp location in pod
kubectl run psql-init --rm -i --image=postgres:15-alpine --restart=Never --namespace=messaging -- \
  sh -c "cat > /tmp/schema.sql && PGPASSWORD=')T]\\!sXUi>SE+DeWt6a8Wmy*Q)A4q6R:}' psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f /tmp/schema.sql" \
  < ../../infrastructure/database/schemas/01-core-schema.sql

echo "✅ Database schema initialized"
