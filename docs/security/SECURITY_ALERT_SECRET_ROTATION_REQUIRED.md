# 🚨 SECURITY ALERT: Secret Rotation Required

**Date**: 2025-11-26
**Severity**: HIGH
**Status**: ACTION REQUIRED

---

## Issue Summary

The file `services/api-gateway/deployments/kubernetes/deployment.yaml` contains **plaintext secrets** and has been committed to git history. This means these secrets may be exposed in git repositories (local and remote).

---

## Exposed Secrets

The following secrets were found in git commit history:

1. **Database Password**: `G7$k9mQ2@tR1`
2. **JWT Secret**: `n3pSi9VneDMrBQntdfg6WFv4FyP+A/t2ebIGSsX38WY=`
3. **Google Client ID**: `791559065272-mcpfc2uc9jtdd7ksovpvb3o19gsv7o7o.apps.googleusercontent.com`
4. **HubSpot API Key**: `pat-na1-REDACTED` (see Kubernetes secrets)
5. **HubSpot Webhook Secret**: `REDACTED` (see Kubernetes secrets)
6. **TCR API Key**: `REDACTED` (see Kubernetes secrets)

## Git Commits Affected

```
00347ae - Implement complete auth system with Google OAuth + Gatekeeper
acd16c2 - Fix jCli configuration and complete vendor management integration
af70720 - Add Go API Gateway scaffolding with Gin framework
```

---

## Immediate Actions Required

### ✅ DONE - Prevention

1. ✅ Removed secrets from `deployment.yaml`
2. ✅ Created `secrets.yaml.template` (no real secrets)
3. ✅ Created `secrets.yaml` (gitignored)
4. ✅ Updated `.gitignore` to prevent future commits
5. ✅ Created security documentation

### 🔴 TODO - Remediation

#### 1. Rotate Database Password (HIGH PRIORITY)

```bash
# Generate new password
NEW_PASS=$(openssl rand -base64 32)

# Update in Google Secret Manager
echo -n "$NEW_PASS" | gcloud secrets versions add warp-db-password --data-file=-

# Update database user password
PGPASSWORD='G7$k9mQ2@tR1' psql -h 34.42.208.57 -p 5432 -U warp_app -d warp << SQL
ALTER USER warp_app WITH PASSWORD '$NEW_PASS';
SQL

# Update secrets.yaml
sed -i "s/DATABASE_PASSWORD: .*/DATABASE_PASSWORD: \"$NEW_PASS\"/" \
  services/api-gateway/deployments/kubernetes/secrets.yaml

# Apply and restart
kubectl apply -f services/api-gateway/deployments/kubernetes/secrets.yaml
kubectl rollout restart deployment/api-gateway -n warp-api
```

#### 2. Rotate JWT Secret (HIGH PRIORITY)

```bash
# Generate new JWT secret (256-bit)
NEW_JWT=$(openssl rand -base64 32)

# Update in Google Secret Manager
echo -n "$NEW_JWT" | gcloud secrets versions add warp-jwt-secret --data-file=-

# Update secrets.yaml
sed -i "s/JWT_SECRET: .*/JWT_SECRET: \"$NEW_JWT\"/" \
  services/api-gateway/deployments/kubernetes/secrets.yaml

# Apply and restart (will invalidate all existing JWTs - users must re-login)
kubectl apply -f services/api-gateway/deployments/kubernetes/secrets.yaml
kubectl rollout restart deployment/api-gateway -n warp-api

# IMPORTANT: All users will need to log in again!
```

#### 3. Rotate HubSpot API Key (MEDIUM PRIORITY)

```bash
# Manual steps:
# 1. Go to HubSpot → Settings → Integrations → Private Apps
# 2. Deactivate old token: pat-na1-REDACTED
# 3. Create new private app token
# 4. Update secrets

NEW_HUBSPOT_KEY="your-new-hubspot-key-here"

echo -n "$NEW_HUBSPOT_KEY" | gcloud secrets versions add hubspot-api-key --data-file=-

# Update secrets.yaml and redeploy
```

#### 4. Rotate HubSpot Webhook Secret (MEDIUM PRIORITY)

```bash
# Generate new webhook secret
NEW_WEBHOOK_SECRET=$(uuidgen)

# Update in HubSpot:
# 1. Go to HubSpot → Settings → Integrations → Webhooks
# 2. Update webhook configuration with new secret

echo -n "$NEW_WEBHOOK_SECRET" | gcloud secrets versions add hubspot-webhook-secret --data-file=-

# Update secrets.yaml and redeploy
```

#### 5. Rotate TCR API Credentials (MEDIUM PRIORITY)

```bash
# Manual steps:
# 1. Log in to The Campaign Registry
# 2. Go to API Credentials
# 3. Revoke old key: D9B996E41EFB423B8D3E262BD545B3F2
# 4. Generate new credentials
# 5. Update secrets

# Once you have new credentials:
echo -n "$NEW_TCR_KEY" | gcloud secrets versions add tcr-api-key --data-file=-
echo -n "$NEW_TCR_SECRET" | gcloud secrets versions add tcr-api-secret --data-file=-

# Update secrets.yaml and redeploy
```

#### 6. Google OAuth Client (CHECK IF PUBLIC)

**Google Client ID**: `791559065272-mcpfc2uc9jtdd7ksovpvb3o19gsv7o7o.apps.googleusercontent.com`

**Status**: This is a **Client ID**, not a secret. Client IDs are meant to be public, so this is **OK**.

**Action**: No rotation required unless the **Client Secret** was also exposed (which it wasn't in these commits).

---

## Git History Cleanup (OPTIONAL BUT RECOMMENDED)

If this is a **private** repository and you want to remove secrets from history:

### Option 1: BFG Repo-Cleaner (Recommended)

```bash
# Install BFG
brew install bfg

# Clone a fresh copy
git clone --mirror git@github.com:yourorg/ringer-warp.git

# Remove file from history
cd ringer-warp.git
bfg --delete-files deployment.yaml --no-blob-protection

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (CAREFUL!)
git push --force
```

### Option 2: git-filter-repo

```bash
# Install git-filter-repo
pip3 install git-filter-repo

# Remove secrets from specific file
git filter-repo --path services/api-gateway/deployments/kubernetes/deployment.yaml \
  --invert-paths --force

# Force push (CAREFUL!)
git push --force --all
```

### ⚠️ WARNING

**Force pushing rewrites history** and will break:
- Open pull requests
- Other developers' local clones
- CI/CD pipelines that reference specific commits

**Only do this if:**
- Repository is private
- You can coordinate with all team members
- You've rotated all secrets first

---

## Prevention Checklist

✅ All future secrets will be managed securely:

- [x] `secrets.yaml` is gitignored
- [x] `deployment.yaml` contains no secrets
- [x] Template file created for documentation
- [x] README.md explains security practices
- [x] .gitignore updated to prevent secret commits
- [x] Secrets stored in Google Secret Manager
- [ ] Pre-commit hooks to detect secrets (TODO)
- [ ] CI/CD secret scanning (TODO)

---

## Monitoring

After rotating secrets, monitor for:

1. **Failed authentication attempts** (old credentials)
2. **API Gateway restart issues** (bad credentials)
3. **HubSpot sync failures** (API key issues)
4. **TCR API errors** (credential issues)

```bash
# Watch API Gateway logs
kubectl logs -n warp-api -l app=api-gateway -f | grep -i "error\|fail\|401\|403"

# Check HubSpot sync
kubectl logs -n warp-api -l app=api-gateway | grep -i hubspot

# Check TCR client
kubectl logs -n warp-api -l app=api-gateway | grep -i tcr
```

---

## Security Scan Tools (Future Prevention)

### 1. git-secrets (AWS Labs)

```bash
# Install
brew install git-secrets

# Setup
cd /path/to/ringer-warp
git secrets --install
git secrets --register-aws
git secrets --add 'DATABASE_PASSWORD.*'
git secrets --add 'JWT_SECRET.*'
git secrets --add 'pat-na1-[a-f0-9-]+'
```

### 2. truffleHog (Secret Scanning)

```bash
# Install
pip install truffleHog

# Scan entire history
trufflehog git file:///path/to/ringer-warp --json
```

### 3. gitleaks (Secret Detection)

```bash
# Install
brew install gitleaks

# Scan repository
gitleaks detect --source . --verbose
```

---

## Post-Rotation Verification

After rotating all secrets:

```bash
# 1. Verify secrets updated in Secret Manager
gcloud secrets versions list warp-db-password
gcloud secrets versions list warp-jwt-secret
gcloud secrets versions list hubspot-api-key
gcloud secrets versions list tcr-api-key

# 2. Verify Kubernetes secrets updated
kubectl get secret api-gateway-secrets -n warp-api -o yaml

# 3. Verify pods restarted
kubectl get pods -n warp-api -l app=api-gateway

# 4. Verify application works
curl -I https://api.rns.ringer.tel/health
# Should return 200 OK

# 5. Test authentication
curl https://api.rns.ringer.tel/v1/gatekeeper/my-permissions \
  -H "Authorization: Bearer $TOKEN"
# Should return permissions (after re-login)
```

---

## Timeline

| Priority | Action | Deadline | Status |
|----------|--------|----------|--------|
| **HIGH** | Rotate DB password | ASAP | ⏳ Pending |
| **HIGH** | Rotate JWT secret | ASAP | ⏳ Pending |
| **MEDIUM** | Rotate HubSpot API key | 24 hours | ⏳ Pending |
| **MEDIUM** | Rotate HubSpot webhook secret | 24 hours | ⏳ Pending |
| **MEDIUM** | Rotate TCR credentials | 24 hours | ⏳ Pending |
| **LOW** | Clean git history | 1 week | ⏳ Optional |
| **LOW** | Add secret scanning tools | 1 week | ⏳ Pending |

---

## Questions?

Contact: Platform Security Team

**Related Docs**:
- [services/api-gateway/deployments/kubernetes/README.md](services/api-gateway/deployments/kubernetes/README.md)
- [docs/security/SECRETS_MANAGEMENT_GUIDE.md](docs/security/SECRETS_MANAGEMENT_GUIDE.md)

---

**Remember**: Security is not a one-time task. Regular secret rotation and monitoring are essential!
