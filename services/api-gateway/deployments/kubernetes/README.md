# Kubernetes Deployment - Security Guidelines

## ⚠️ IMPORTANT: Secret Management

**NEVER commit secrets to git!** This directory contains both deployment configuration and secrets, but they must be managed separately.

---

## File Structure

```
kubernetes/
├── deployment.yaml          # Deployment, Service, HPA (NO SECRETS)
├── secrets.yaml.template    # Template showing secret structure
├── secrets.yaml             # ACTUAL SECRETS (gitignored, never commit!)
└── README.md                # This file
```

---

## How to Deploy

### Step 1: Create secrets.yaml (First Time Only)

```bash
# Copy the template
cp secrets.yaml.template secrets.yaml

# Edit with your actual secrets
vim secrets.yaml

# Or use this command to create from Google Secret Manager
cat > secrets.yaml << 'EOF'
apiVersion: v1
kind: Secret
metadata:
  name: api-gateway-secrets
  namespace: warp-api
type: Opaque
stringData:
  DATABASE_PASSWORD: "$(gcloud secrets versions access latest --secret=warp-db-password)"
  JWT_SECRET: "$(gcloud secrets versions access latest --secret=warp-jwt-secret)"
  GOOGLE_CLIENT_ID: "$(gcloud secrets versions access latest --secret=google-client-id)"
  HUBSPOT_API_KEY: "$(gcloud secrets versions access latest --secret=hubspot-api-key)"
  HUBSPOT_WEBHOOK_SECRET: "$(gcloud secrets versions access latest --secret=hubspot-webhook-secret)"
  TCR_API_KEY: "$(gcloud secrets versions access latest --secret=tcr-api-key)"
  TCR_API_SECRET: "$(gcloud secrets versions access latest --secret=tcr-api-secret)"
  TCR_SANDBOX: "$(gcloud secrets versions access latest --secret=tcr-sandbox)"
EOF
```

### Step 2: Apply Secrets Separately

```bash
# Apply secrets first (separate from deployment)
kubectl apply -f secrets.yaml

# Verify secrets were created
kubectl get secret api-gateway-secrets -n warp-api
```

### Step 3: Deploy Application

```bash
# Apply deployment (references secrets, doesn't contain them)
kubectl apply -f deployment.yaml

# Wait for rollout
kubectl rollout status deployment/api-gateway -n warp-api
```

---

## Security Best Practices

### ✅ DO:

1. **Use Google Secret Manager** for storing secrets
2. **Keep secrets.yaml local only** (it's gitignored)
3. **Use secrets.yaml.template** for documentation
4. **Apply secrets separately** from deployment
5. **Rotate secrets regularly** (every 90 days)
6. **Use RBAC** to limit secret access
7. **Audit secret access** via Google Cloud logs

### ❌ DON'T:

1. ❌ **Never commit secrets.yaml** to git
2. ❌ **Never put secrets in deployment.yaml**
3. ❌ **Never share secrets via Slack/email**
4. ❌ **Never log secrets** in application code
5. ❌ **Never use default/weak secrets**
6. ❌ **Never hardcode secrets** in source code

---

## Secret Rotation

### When to Rotate Secrets

- **Immediately** if compromised
- **Every 90 days** as best practice
- **Before production deployment**
- **After team member leaves**

### How to Rotate Secrets

```bash
# 1. Update secret in Google Secret Manager
gcloud secrets versions add tcr-api-key --data-file=-
# (paste new value, press Ctrl+D)

# 2. Update secrets.yaml locally
vim secrets.yaml

# 3. Apply updated secret
kubectl apply -f secrets.yaml

# 4. Restart pods to pick up new secret
kubectl rollout restart deployment/api-gateway -n warp-api
```

---

## Alternative: Using Google Secret Manager Directly

Instead of Kubernetes Secrets, you can use Google Secret Manager with Workload Identity:

### Setup (One-time)

```bash
# Create service account
gcloud iam service-accounts create api-gateway-sa \
  --display-name="API Gateway Service Account"

# Grant Secret Manager access
gcloud projects add-iam-policy-binding ringer-warp-v01 \
  --member="serviceAccount:api-gateway-sa@ringer-warp-v01.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Bind to Kubernetes service account
gcloud iam service-accounts add-iam-policy-binding \
  api-gateway-sa@ringer-warp-v01.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:ringer-warp-v01.svc.id.goog[warp-api/api-gateway]"
```

### Update Deployment

```yaml
spec:
  serviceAccountName: api-gateway
  containers:
  - name: api-gateway
    env:
    - name: DATABASE_PASSWORD
      valueFrom:
        secretKeyRef:
          name: database-password  # Synced from GSM
          key: password
```

---

## Troubleshooting

### Secret Not Found

```bash
# Check if secret exists
kubectl get secret api-gateway-secrets -n warp-api

# If missing, apply secrets.yaml
kubectl apply -f secrets.yaml
```

### Secret Not Updated

```bash
# Delete and recreate
kubectl delete secret api-gateway-secrets -n warp-api
kubectl apply -f secrets.yaml

# Restart pods
kubectl rollout restart deployment/api-gateway -n warp-api
```

### Checking Secret Values (for debugging)

```bash
# View secret (base64 encoded)
kubectl get secret api-gateway-secrets -n warp-api -o yaml

# Decode a specific key
kubectl get secret api-gateway-secrets -n warp-api \
  -o jsonpath='{.data.TCR_API_KEY}' | base64 -d
```

---

## Migration from Committed Secrets

If you previously committed secrets to git:

### 1. Remove from Git History

```bash
# Use git-filter-repo to remove secrets from history
git filter-repo --path services/api-gateway/deployments/kubernetes/deployment.yaml \
  --invert-paths --force

# Or use BFG Repo-Cleaner
bfg --delete-files deployment.yaml
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### 2. Rotate ALL Compromised Secrets

```bash
# Any secret that was committed to git is now public
# You MUST rotate all of them immediately:

# Database password
# JWT secret
# Google OAuth client
# HubSpot API key
# TCR API credentials
```

### 3. Update .gitignore

Already done! See `.gitignore` for the rules.

---

## Security Checklist

Before deploying:

- [ ] secrets.yaml is NOT committed to git
- [ ] secrets.yaml.template contains no real secrets
- [ ] deployment.yaml contains no secrets
- [ ] .gitignore includes `**/secrets.yaml`
- [ ] Secrets applied to cluster separately
- [ ] Secrets stored in Google Secret Manager
- [ ] RBAC configured to limit secret access
- [ ] Audit logging enabled for secret access

---

## Questions?

- **Secret Management**: See [docs/security/SECRETS_MANAGEMENT_GUIDE.md](../../../docs/security/SECRETS_MANAGEMENT_GUIDE.md)
- **Auth System**: See [docs/security/AUTH_AND_PERMISSION_SYSTEM.md](../../../docs/security/AUTH_AND_PERMISSION_SYSTEM.md)
- **Deployment**: See [docs/deployment/DEPLOYMENT.md](../../../docs/deployment/DEPLOYMENT.md)

---

**Last Updated**: 2025-11-26
