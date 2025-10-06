#!/bin/bash

# Fix Cloud SQL Authentication Issues
# This script creates a foolproof solution for connecting to Cloud SQL from Kubernetes

set -e

PROJECT_ID="ringer-warp-v01"
INSTANCE_NAME="warp-db"
REGION="us-central1"
DATABASE="warp"
ZONE="us-central1-a"
CLUSTER_NAME="warp-platform"

echo "=== Cloud SQL Authentication Fix Script ==="
echo "Project: $PROJECT_ID"
echo "Instance: $INSTANCE_NAME"
echo "Database: $DATABASE"
echo

# Set project context
gcloud config set project $PROJECT_ID

# Get instance connection name
CONNECTION_NAME=$(gcloud sql instances describe $INSTANCE_NAME --format="value(connectionName)")
echo "Connection Name: $CONNECTION_NAME"

# Get private IP
PRIVATE_IP=$(gcloud sql instances describe $INSTANCE_NAME --format="get(ipAddresses[2].ipAddress)")
echo "Private IP: $PRIVATE_IP"

# Step 1: Create a new user with a simple password
echo
echo "=== Step 1: Creating new database user ==="
NEW_USER="warp_app"
NEW_PASSWORD="WarpApp2024!"

# Delete user if exists
echo "Removing existing user if any..."
gcloud sql users delete $NEW_USER --instance=$INSTANCE_NAME --quiet 2>/dev/null || true

# Create new user
echo "Creating user: $NEW_USER"
gcloud sql users create $NEW_USER \
  --instance=$INSTANCE_NAME \
  --password="$NEW_PASSWORD"

echo "User created successfully!"

# Step 2: Reset the existing warp user password
echo
echo "=== Step 2: Resetting warp user password ==="
WARP_PASSWORD="Warp2024Simple"

gcloud sql users set-password warp \
  --instance=$INSTANCE_NAME \
  --password="$WARP_PASSWORD"

echo "warp user password reset successfully!"

# Step 3: Create Kubernetes secret with both passwords
echo
echo "=== Step 3: Creating Kubernetes secrets ==="

# Get kubectl context
kubectl config use-context gke_${PROJECT_ID}_${REGION}_${CLUSTER_NAME}

# Delete existing secrets
kubectl delete secret cloudsql-db-credentials 2>/dev/null || true
kubectl delete secret cloudsql-instance-credentials 2>/dev/null || true

# Create new secrets
kubectl create secret generic cloudsql-db-credentials \
  --from-literal=username=$NEW_USER \
  --from-literal=password="$NEW_PASSWORD" \
  --from-literal=database=$DATABASE \
  --from-literal=host=$PRIVATE_IP \
  --from-literal=connection-name=$CONNECTION_NAME

kubectl create secret generic cloudsql-warp-credentials \
  --from-literal=username=warp \
  --from-literal=password="$WARP_PASSWORD" \
  --from-literal=database=$DATABASE \
  --from-literal=host=$PRIVATE_IP

echo "Secrets created successfully!"

# Step 4: Create service account for Cloud SQL proxy
echo
echo "=== Step 4: Setting up Cloud SQL Proxy service account ==="

# Create service account if not exists
SA_NAME="cloudsql-proxy"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts describe $SA_EMAIL &>/dev/null || \
gcloud iam service-accounts create $SA_NAME \
  --display-name="Cloud SQL Proxy Service Account"

# Grant Cloud SQL client role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/cloudsql.client"

# Create key and store in Kubernetes
echo "Creating service account key..."
gcloud iam service-accounts keys create /tmp/key.json \
  --iam-account=$SA_EMAIL

kubectl delete secret cloudsql-proxy-credentials 2>/dev/null || true
kubectl create secret generic cloudsql-proxy-credentials \
  --from-file=service_account.json=/tmp/key.json

rm -f /tmp/key.json
echo "Service account configured!"

# Step 5: Deploy Cloud SQL Proxy
echo
echo "=== Step 5: Deploying Cloud SQL Proxy ==="

cat > /tmp/cloudsql-proxy.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cloudsql-proxy
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cloudsql-proxy
  template:
    metadata:
      labels:
        app: cloudsql-proxy
    spec:
      serviceAccountName: default
      containers:
      - name: cloud-sql-proxy
        image: gcr.io/cloud-sql-connectors/cloud-sql-proxy:latest
        command:
          - "/cloud-sql-proxy"
          - "--structured-logs"
          - "--port=5432"
          - "$CONNECTION_NAME"
        securityContext:
          runAsNonRoot: true
        volumeMounts:
        - name: cloudsql-creds
          mountPath: /secrets/cloudsql
          readOnly: true
        env:
        - name: GOOGLE_APPLICATION_CREDENTIALS
          value: /secrets/cloudsql/service_account.json
      volumes:
      - name: cloudsql-creds
        secret:
          secretName: cloudsql-proxy-credentials
---
apiVersion: v1
kind: Service
metadata:
  name: cloudsql-proxy
spec:
  ports:
  - port: 5432
    targetPort: 5432
  selector:
    app: cloudsql-proxy
EOF

kubectl apply -f /tmp/cloudsql-proxy.yaml
echo "Cloud SQL Proxy deployed!"

# Step 6: Create test pod with multiple connection methods
echo
echo "=== Step 6: Creating test pod ==="

cat > /tmp/test-connection.yaml << EOF
apiVersion: v1
kind: Pod
metadata:
  name: postgres-test
spec:
  containers:
  - name: postgres
    image: postgres:15
    env:
    # Method 1: Direct connection with new user
    - name: PGHOST
      value: "$PRIVATE_IP"
    - name: PGUSER
      value: "$NEW_USER"
    - name: PGPASSWORD
      value: "$NEW_PASSWORD"
    - name: PGDATABASE
      value: "$DATABASE"
    # Method 2: Connection via proxy
    - name: PROXY_HOST
      value: "cloudsql-proxy"
    # Method 3: Original warp user
    - name: WARP_USER
      value: "warp"
    - name: WARP_PASSWORD
      value: "$WARP_PASSWORD"
    command: ["/bin/bash", "-c", "sleep infinity"]
EOF

kubectl delete pod postgres-test 2>/dev/null || true
kubectl apply -f /tmp/test-connection.yaml

echo
echo "=== Waiting for pod to be ready ==="
kubectl wait --for=condition=Ready pod/postgres-test --timeout=60s

# Step 7: Test connections
echo
echo "=== Step 7: Testing connections ==="

echo "Test 1: Direct connection with new user..."
kubectl exec postgres-test -- psql -h $PRIVATE_IP -U $NEW_USER -d $DATABASE -c "SELECT version();" || echo "Direct connection failed"

echo
echo "Test 2: Connection via Cloud SQL Proxy..."
kubectl exec postgres-test -- psql -h cloudsql-proxy -U $NEW_USER -d $DATABASE -c "SELECT version();" || echo "Proxy connection failed"

echo
echo "Test 3: Direct connection with warp user..."
kubectl exec postgres-test -- psql -h $PRIVATE_IP -U warp -d $DATABASE -c "SELECT version();" || echo "Warp user connection failed"

# Step 8: Create connection instructions
echo
echo "=== Creating connection documentation ==="

cat > connection-config.txt << EOF
Cloud SQL Connection Configuration
==================================

Instance Details:
- Project: $PROJECT_ID
- Instance: $INSTANCE_NAME
- Connection Name: $CONNECTION_NAME
- Private IP: $PRIVATE_IP
- Database: $DATABASE

Users Created:
1. User: $NEW_USER
   Password: $NEW_PASSWORD
   
2. User: warp
   Password: $WARP_PASSWORD

Connection Methods:

1. Direct Private IP Connection:
   Host: $PRIVATE_IP
   Port: 5432
   Database: $DATABASE
   User: $NEW_USER or warp
   Password: (see above)

2. Cloud SQL Proxy Connection:
   Host: cloudsql-proxy
   Port: 5432
   Database: $DATABASE
   User: $NEW_USER or warp
   Password: (see above)

3. Connection String Examples:
   - Direct: postgresql://$NEW_USER:$NEW_PASSWORD@$PRIVATE_IP:5432/$DATABASE
   - Proxy: postgresql://$NEW_USER:$NEW_PASSWORD@cloudsql-proxy:5432/$DATABASE

Kubernetes Secrets:
- cloudsql-db-credentials: Contains new user credentials
- cloudsql-warp-credentials: Contains warp user credentials
- cloudsql-proxy-credentials: Contains service account key

Test Commands:
kubectl exec postgres-test -- psql -h $PRIVATE_IP -U $NEW_USER -d $DATABASE -c "SELECT NOW();"
kubectl exec postgres-test -- psql -h cloudsql-proxy -U $NEW_USER -d $DATABASE -c "SELECT NOW();"
EOF

echo
echo "=== SUMMARY ==="
echo "1. Created new user: $NEW_USER with password: $NEW_PASSWORD"
echo "2. Reset warp user password to: $WARP_PASSWORD"
echo "3. Created Kubernetes secrets for both users"
echo "4. Deployed Cloud SQL Proxy as a service"
echo "5. Created test pod for verification"
echo
echo "Connection details saved to: connection-config.txt"
echo
echo "Next steps:"
echo "1. Update your application to use one of these connection methods"
echo "2. Use environment variables from the secrets"
echo "3. Test with: kubectl exec postgres-test -- psql -h $PRIVATE_IP -U $NEW_USER -d $DATABASE"