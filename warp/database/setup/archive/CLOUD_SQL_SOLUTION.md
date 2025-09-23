# Cloud SQL Authentication Solution

## Problem Summary
The Cloud SQL instance `warp-db` was rejecting password authentication for the `warp` user despite the user existing. This was preventing Kubernetes pods from connecting to the database.

## Root Cause
The password authentication was failing due to:
1. Complex passwords with special characters that may have been incorrectly escaped
2. Potential encoding issues when setting passwords via `gcloud` CLI
3. No clear error messages about why authentication was failing

## Solution Implemented

### 1. Created New Users with Simple, Working Passwords

We created three users with passwords that are confirmed to work:

```bash
# Application user (for app connections)
Username: warp_app
Password: WarpApp2024

# Schema owner (for migrations/DDL)
Username: warp
Password: Warp2024

# Read-only user (for monitoring)
Username: warp_readonly
Password: ReadOnly2024
```

### 2. Kubernetes Secrets Created

```bash
# Main application credentials
kubectl create secret generic cloudsql-db-credentials \
  --from-literal=username=warp_app \
  --from-literal=password="WarpApp2024" \
  --from-literal=database=warp \
  --from-literal=host=10.126.0.3 \
  --from-literal=port=5432 \
  --from-literal=connection-string="postgresql://warp_app:WarpApp2024@10.126.0.3:5432/warp"

# Warp user credentials (for schema operations)
kubectl create secret generic cloudsql-warp-credentials \
  --from-literal=username=warp \
  --from-literal=password="Warp2024" \
  --from-literal=database=warp \
  --from-literal=host=10.126.0.3 \
  --from-literal=port=5432 \
  --from-literal=connection-string="postgresql://warp:Warp2024@10.126.0.3:5432/warp"

# Read-only credentials
kubectl create secret generic cloudsql-readonly-credentials \
  --from-literal=username=warp_readonly \
  --from-literal=password="ReadOnly2024" \
  --from-literal=database=warp \
  --from-literal=host=10.126.0.3 \
  --from-literal=port=5432
```

### 3. ConfigMap for Non-Sensitive Config

```bash
kubectl create configmap cloudsql-config \
  --from-literal=database=warp \
  --from-literal=host=10.126.0.3 \
  --from-literal=port=5432 \
  --from-literal=sslmode=disable \
  --from-literal=connection-timeout=10
```

## Verified Working Connection Methods

### Method 1: Direct Connection String
```bash
kubectl run psql-test --image=postgres:15 --rm -it --restart=Never -- \
  psql "postgresql://warp:Warp2024@10.126.0.3:5432/warp" \
  -c "SELECT NOW();"
```

### Method 2: Using Secrets in Pods
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-pod
spec:
  containers:
  - name: app
    image: myapp:latest
    envFrom:
    - secretRef:
        name: cloudsql-db-credentials
    env:
    - name: PGPASSWORD
      valueFrom:
        secretKeyRef:
          name: cloudsql-db-credentials
          key: password
```

### Method 3: Individual Environment Variables
```yaml
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
```

### Method 4: Connection String from Secret
```yaml
env:
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: cloudsql-db-credentials
      key: connection-string
```

## Database Initialization

Run the initialization job to create schemas:
```bash
kubectl apply -f k8s-init-job-working.yaml
```

This will:
- Create `sms` and `provider` schemas
- Create all necessary tables
- Set up indexes
- Insert initial data
- Grant appropriate permissions

## Scripts Created

1. **quick-fix-auth.sh** - Quick test to verify connectivity
2. **setup-working-credentials.sh** - Complete setup with all users and secrets
3. **create-k8s-secrets.sh** - Just create Kubernetes secrets
4. **test-and-init-db.sh** - Test all connections
5. **k8s-init-job-working.yaml** - Database initialization job

## Key Learnings

1. **Keep passwords simple during setup** - Avoid special characters that need escaping
2. **Test immediately after user creation** - Verify each user works before proceeding
3. **Use connection strings in secrets** - Makes it easier for applications to connect
4. **Create multiple users** - Separate users for app, migrations, and monitoring
5. **Private IP is reliable** - The private IP (10.126.0.3) works consistently from within the VPC

## Connection Details

- **Instance**: warp-db
- **Private IP**: 10.126.0.3
- **Database**: warp
- **Port**: 5432
- **Connection Name**: ringer-warp-v01:us-central1:warp-db

## Troubleshooting

If connections fail:
1. Verify pod is in the same VPC network
2. Check that the private service connection is established
3. Ensure passwords don't have characters that need escaping
4. Use `sslmode=disable` if SSL is not required
5. Check Cloud SQL logs: `gcloud logging read 'resource.type="cloudsql_database"'`

## Next Steps

1. Update all application deployments to use `cloudsql-db-credentials` secret
2. Run database migrations using `cloudsql-warp-credentials` 
3. Set up monitoring dashboards using `cloudsql-readonly-credentials`
4. Consider implementing connection pooling (pgBouncer) if needed
5. Set up automated backups and point-in-time recovery