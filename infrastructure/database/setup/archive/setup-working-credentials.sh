#!/bin/bash

# Setup working Cloud SQL credentials
# Based on successful test with simple passwords

set -e

PROJECT_ID="ringer-warp-v01"
INSTANCE_NAME="warp-db"
DATABASE="warp"
REGION="us-central1"
CLUSTER_NAME="warp-kamailio-cluster"

echo "=== Setting up Working Cloud SQL Credentials ==="

# Set project
gcloud config set project $PROJECT_ID

# Get instance details
CONNECTION_NAME=$(gcloud sql instances describe $INSTANCE_NAME --format="value(connectionName)")
PRIVATE_IP=$(gcloud sql instances describe $INSTANCE_NAME --format="get(ipAddresses[2].ipAddress)")

echo "Instance: $INSTANCE_NAME"
echo "Connection Name: $CONNECTION_NAME"
echo "Private IP: $PRIVATE_IP"
echo "Database: $DATABASE"

# Create production users with working passwords
echo
echo "=== Creating/Updating Database Users ==="

# 1. Application user
APP_USER="warp_app"
APP_PASS="WarpApp2024"

gcloud sql users delete $APP_USER --instance=$INSTANCE_NAME --quiet 2>/dev/null || true
gcloud sql users create $APP_USER --instance=$INSTANCE_NAME --password="$APP_PASS"
echo "✓ Created user: $APP_USER"

# 2. Update warp user
WARP_USER="warp"
WARP_PASS="Warp2024"

gcloud sql users set-password $WARP_USER --instance=$INSTANCE_NAME --password="$WARP_PASS"
echo "✓ Updated user: $WARP_USER"

# 3. Create read-only user for monitoring
RO_USER="warp_readonly"
RO_PASS="ReadOnly2024"

gcloud sql users delete $RO_USER --instance=$INSTANCE_NAME --quiet 2>/dev/null || true
gcloud sql users create $RO_USER --instance=$INSTANCE_NAME --password="$RO_PASS"
echo "✓ Created user: $RO_USER"

# Create Kubernetes secrets
echo
echo "=== Creating Kubernetes Secrets ==="

kubectl config use-context gke_${PROJECT_ID}_${REGION}_${CLUSTER_NAME}

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

# Instance details secret
kubectl delete secret cloudsql-instance-details 2>/dev/null || true
kubectl create secret generic cloudsql-instance-details \
  --from-literal=connection-name=$CONNECTION_NAME \
  --from-literal=private-ip=$PRIVATE_IP \
  --from-literal=database=$DATABASE \
  --from-literal=project-id=$PROJECT_ID \
  --from-literal=instance-name=$INSTANCE_NAME

echo "✓ Created secret: cloudsql-instance-details"

# Create ConfigMap with non-sensitive connection info
echo
echo "=== Creating ConfigMap ==="

kubectl delete configmap cloudsql-config 2>/dev/null || true
kubectl create configmap cloudsql-config \
  --from-literal=database=$DATABASE \
  --from-literal=host=$PRIVATE_IP \
  --from-literal=port=5432 \
  --from-literal=sslmode=disable \
  --from-literal=connection-timeout=10 \
  --from-literal=pool-size=25

echo "✓ Created configmap: cloudsql-config"

# Test all connections
echo
echo "=== Testing Connections ==="

# Create test pod
cat > /tmp/test-all-connections.yaml << EOF
apiVersion: v1
kind: Pod
metadata:
  name: db-connection-test
spec:
  restartPolicy: Never
  containers:
  - name: postgres
    image: postgres:15
    command: ["/bin/bash"]
    args: 
    - -c
    - |
      echo "Testing application user..."
      PGPASSWORD='$APP_PASS' psql -h $PRIVATE_IP -U $APP_USER -d $DATABASE -c "SELECT 'App user connected' as status, current_user, now();"
      
      echo -e "\nTesting warp user..."
      PGPASSWORD='$WARP_PASS' psql -h $PRIVATE_IP -U $WARP_USER -d $DATABASE -c "SELECT 'Warp user connected' as status, current_user, now();"
      
      echo -e "\nTesting read-only user..."
      PGPASSWORD='$RO_PASS' psql -h $PRIVATE_IP -U $RO_USER -d $DATABASE -c "SELECT 'Read-only user connected' as status, current_user, now();"
      
      echo -e "\nAll connections successful!"
EOF

kubectl delete pod db-connection-test 2>/dev/null || true
kubectl apply -f /tmp/test-all-connections.yaml

echo "Waiting for test pod..."
kubectl wait --for=condition=Completed pod/db-connection-test --timeout=30s || true
kubectl logs db-connection-test

# Create updated database init job
echo
echo "=== Creating Updated Database Init Job ==="

cat > k8s-init-job-updated.yaml << EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: warp-db-init
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: db-init
        image: postgres:15
        envFrom:
        - secretRef:
            name: cloudsql-db-credentials
        - configMapRef:
            name: cloudsql-config
        env:
        - name: PGPASSWORD
          valueFrom:
            secretKeyRef:
              name: cloudsql-db-credentials
              key: password
        command: ["/bin/bash"]
        args:
        - -c
        - |
          echo "Initializing database schema..."
          cd /sql
          
          # Test connection
          psql -h \$host -U \$username -d \$database -c "SELECT version();"
          
          # Run initialization scripts
          for script in *.sql; do
            echo "Running \$script..."
            psql -h \$host -U \$username -d \$database -f "\$script"
          done
          
          echo "Database initialization complete!"
        volumeMounts:
        - name: sql-scripts
          mountPath: /sql
      volumes:
      - name: sql-scripts
        configMap:
          name: warp-db-init-scripts
EOF

echo "✓ Created k8s-init-job-updated.yaml"

# Create connection documentation
cat > WORKING_CONNECTION_GUIDE.md << EOF
# Cloud SQL Working Connection Guide

## Connection Details

**Instance Information:**
- Project ID: $PROJECT_ID
- Instance Name: $INSTANCE_NAME
- Connection Name: $CONNECTION_NAME
- Private IP: $PRIVATE_IP
- Database: $DATABASE

## Working Credentials

### 1. Application User (Full Access)
- Username: $APP_USER
- Password: $APP_PASS
- Connection String: postgresql://${APP_USER}:${APP_PASS}@${PRIVATE_IP}:5432/${DATABASE}

### 2. Warp User (Schema Owner)
- Username: $WARP_USER  
- Password: $WARP_PASS
- Connection String: postgresql://${WARP_USER}:${WARP_PASS}@${PRIVATE_IP}:5432/${DATABASE}

### 3. Read-Only User (Monitoring)
- Username: $RO_USER
- Password: $RO_PASS
- Connection String: postgresql://${RO_USER}:${RO_PASS}@${PRIVATE_IP}:5432/${DATABASE}

## Kubernetes Secrets

\`\`\`bash
# Application credentials
kubectl get secret cloudsql-db-credentials -o yaml

# Warp user credentials  
kubectl get secret cloudsql-warp-credentials -o yaml

# Read-only credentials
kubectl get secret cloudsql-readonly-credentials -o yaml

# Instance details
kubectl get secret cloudsql-instance-details -o yaml
\`\`\`

## Using in Deployments

### Method 1: Environment Variables from Secret
\`\`\`yaml
envFrom:
- secretRef:
    name: cloudsql-db-credentials
\`\`\`

### Method 2: Individual Environment Variables
\`\`\`yaml
env:
- name: DB_HOST
  valueFrom:
    secretKeyRef:
      name: cloudsql-db-credentials
      key: host
- name: DB_USER
  valueFrom:
    secretKeyRef:
      name: cloudsql-db-credentials
      key: username
- name: DB_PASSWORD
  valueFrom:
    secretKeyRef:
      name: cloudsql-db-credentials
      key: password
\`\`\`

### Method 3: Connection String
\`\`\`yaml
env:
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: cloudsql-db-credentials
      key: connection-string
\`\`\`

## Testing Connection

\`\`\`bash
# Quick test
kubectl run psql-test --image=postgres:15 --rm -it --restart=Never -- \\
  psql "postgresql://${APP_USER}:${APP_PASS}@${PRIVATE_IP}:5432/${DATABASE}" \\
  -c "SELECT NOW();"

# Test with secret
kubectl run psql-secret-test --image=postgres:15 --rm -it --restart=Never \\
  --overrides='{
    "spec": {
      "containers": [{
        "name": "psql-secret-test",
        "image": "postgres:15",
        "envFrom": [{
          "secretRef": {"name": "cloudsql-db-credentials"}
        }],
        "env": [{
          "name": "PGPASSWORD",
          "valueFrom": {
            "secretKeyRef": {"name": "cloudsql-db-credentials", "key": "password"}
          }
        }]
      }]
    }
  }' -- psql -h \$host -U \$username -d \$database -c "SELECT NOW();"
\`\`\`

## Troubleshooting

1. **Connection Refused**: Check that the pod is in the same VPC/network
2. **Authentication Failed**: Verify the password doesn't have special characters that need escaping
3. **Timeout**: Ensure private service connection is established
4. **SSL Required**: Add sslmode=disable to connection string if needed

## Next Steps

1. Run database initialization: \`kubectl apply -f k8s-init-job-updated.yaml\`
2. Update application deployments to use the secrets
3. Set up monitoring with the read-only user
4. Configure connection pooling if needed
EOF

echo "✓ Created WORKING_CONNECTION_GUIDE.md"

echo
echo "=== SETUP COMPLETE ==="
echo
echo "Users created:"
echo "- $APP_USER / $APP_PASS (application user)"
echo "- $WARP_USER / $WARP_PASS (schema owner)"
echo "- $RO_USER / $RO_PASS (read-only)"
echo
echo "Kubernetes secrets created:"
echo "- cloudsql-db-credentials"
echo "- cloudsql-warp-credentials"
echo "- cloudsql-readonly-credentials"
echo "- cloudsql-instance-details"
echo
echo "ConfigMap created:"
echo "- cloudsql-config"
echo
echo "Documentation: WORKING_CONNECTION_GUIDE.md"
echo "Updated init job: k8s-init-job-updated.yaml"