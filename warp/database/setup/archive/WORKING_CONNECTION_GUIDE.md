# Cloud SQL Working Connection Guide

## Connection Details

**Instance Information:**
- Project ID: ringer-warp-v01
- Instance Name: warp-db
- Connection Name: ringer-warp-v01:us-central1:warp-db
- Private IP: 10.126.0.3
- Database: warp

## Working Credentials

### 1. Application User (Full Access)
- Username: warp_app
- Password: WarpApp2024
- Connection String: postgresql://warp_app:WarpApp2024@10.126.0.3:5432/warp

### 2. Warp User (Schema Owner)
- Username: warp  
- Password: Warp2024
- Connection String: postgresql://warp:Warp2024@10.126.0.3:5432/warp

### 3. Read-Only User (Monitoring)
- Username: warp_readonly
- Password: ReadOnly2024
- Connection String: postgresql://warp_readonly:ReadOnly2024@10.126.0.3:5432/warp

## Kubernetes Secrets

```bash
# Application credentials
kubectl get secret cloudsql-db-credentials -o yaml

# Warp user credentials  
kubectl get secret cloudsql-warp-credentials -o yaml

# Read-only credentials
kubectl get secret cloudsql-readonly-credentials -o yaml

# Instance details
kubectl get secret cloudsql-instance-details -o yaml
```

## Using in Deployments

### Method 1: Environment Variables from Secret
```yaml
envFrom:
- secretRef:
    name: cloudsql-db-credentials
```

### Method 2: Individual Environment Variables
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

### Method 3: Connection String
```yaml
env:
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: cloudsql-db-credentials
      key: connection-string
```

## Testing Connection

```bash
# Quick test
kubectl run psql-test --image=postgres:15 --rm -it --restart=Never -- \
  psql "postgresql://warp_app:WarpApp2024@10.126.0.3:5432/warp" \
  -c "SELECT NOW();"

# Test with secret
kubectl run psql-secret-test --image=postgres:15 --rm -it --restart=Never \
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
  }' -- psql -h $host -U $username -d $database -c "SELECT NOW();"
```

## Troubleshooting

1. **Connection Refused**: Check that the pod is in the same VPC/network
2. **Authentication Failed**: Verify the password doesn't have special characters that need escaping
3. **Timeout**: Ensure private service connection is established
4. **SSL Required**: Add sslmode=disable to connection string if needed

## Next Steps

1. Run database initialization: `kubectl apply -f k8s-init-job-updated.yaml`
2. Update application deployments to use the secrets
3. Set up monitoring with the read-only user
4. Configure connection pooling if needed
