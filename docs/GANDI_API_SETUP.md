# Gandi API Key Setup Guide

## Obtaining Your Gandi API Key

### 1. Login to Gandi Account
1. Go to https://admin.gandi.net
2. Login with your Gandi credentials

### 2. Generate API Key
1. Navigate to **User Settings** → **Security**
2. Click on **"Generate an API key"** or **"Personal Access Token (PAT)"**
3. Give it a descriptive name: `WARP Platform Staging DNS`
4. Select permissions:
   - ✅ **See and renew domain names**
   - ✅ **Manage domain name technical configurations**
   - ✅ **Manage LiveDNS** (most important)
5. Click **"Create"**
6. **IMPORTANT**: Copy the API key immediately (shown only once)

### 3. Test the API Key
```bash
# Test that your API key works
curl -H "Authorization: Apikey YOUR_API_KEY" \
  https://api.gandi.net/v5/livedns/domains/ringer.tel

# Should return domain info if successful
```

## Storing the API Key Securely

### For Local Development
```bash
# Add to .env.staging (never commit this file)
GANDI_API_KEY=your-actual-api-key-here

# Add .env.staging to .gitignore
echo ".env.staging" >> .gitignore
```

### For CI/CD (GitHub Actions)
1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Click **"New repository secret"**
4. Name: `GANDI_API_KEY`
5. Value: Your API key
6. Click **"Add secret"**

### For Google Cloud (Production)
```bash
# Store in Google Secret Manager
gcloud secrets create gandi-api-key \
  --data-file=- \
  --replication-policy="automatic" \
  --project=ringer-warp-v01

# Type your API key and press Ctrl+D

# Grant access to service accounts
gcloud secrets add-iam-policy-binding gandi-api-key \
  --member="serviceAccount:warp-dns-manager@ringer-warp-v01.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### For Kubernetes Deployments
```yaml
# Create secret in Kubernetes
kubectl create secret generic gandi-credentials \
  --from-literal=api-key=YOUR_API_KEY \
  --namespace=warp-staging

# Reference in deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dns-manager
spec:
  template:
    spec:
      containers:
      - name: dns-manager
        env:
        - name: GANDI_API_KEY
          valueFrom:
            secretKeyRef:
              name: gandi-credentials
              key: api-key
```

## Environment Variables Required

Add these to your `.env.staging` file:

```bash
# Gandi DNS Management
GANDI_API_KEY=                    # Your API key from Gandi
GANDI_DOMAIN=ringer.tel           # Primary domain
GANDI_API_URL=https://api.gandi.net/v5/livedns
GANDI_RATE_LIMIT=300              # Max requests per minute
```

## Quick Test Script

Create `test-gandi-api.sh`:
```bash
#!/bin/bash

# Load environment variables
source .env.staging

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "Testing Gandi API connection..."

# Test API key validity
response=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Apikey ${GANDI_API_KEY}" \
  https://api.gandi.net/v5/livedns/domains/${GANDI_DOMAIN})

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
  echo -e "${GREEN}✓ API key is valid${NC}"
  echo -e "${GREEN}✓ Domain ${GANDI_DOMAIN} found${NC}"

  # List current records
  echo -e "\nCurrent DNS records for ${GANDI_DOMAIN}:"
  curl -s -H "Authorization: Apikey ${GANDI_API_KEY}" \
    https://api.gandi.net/v5/livedns/domains/${GANDI_DOMAIN}/records | \
    jq -r '.[] | "\(.rrset_name) \(.rrset_type) \(.rrset_values[])"' | head -20
else
  echo -e "${RED}✗ API key test failed with HTTP $http_code${NC}"
  echo "$body"
  exit 1
fi
```

## Security Best Practices

### 1. API Key Rotation
- Rotate API keys every 90 days
- Keep a backup key during rotation
- Update all services with new key

### 2. Access Restrictions
- Create separate API keys for different environments
- Use read-only keys where possible
- Limit key permissions to minimum required

### 3. Monitoring
- Log all DNS changes
- Set up alerts for unexpected modifications
- Monitor API rate limits

### 4. Backup Strategy
```bash
# Backup current DNS records before changes
curl -H "Authorization: Apikey ${GANDI_API_KEY}" \
  https://api.gandi.net/v5/livedns/domains/ringer.tel/records \
  > dns-backup-$(date +%Y%m%d).json
```

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Check API key is correct
   - Verify key hasn't expired
   - Ensure proper header format: `Authorization: Apikey YOUR_KEY`

2. **429 Too Many Requests**
   - Implement exponential backoff
   - Reduce request frequency
   - Batch operations where possible

3. **403 Forbidden**
   - Check API key has LiveDNS permissions
   - Verify domain ownership

### Debug Mode
```bash
# Enable verbose output for debugging
export GANDI_DEBUG=true

# Test with curl verbose mode
curl -v -H "Authorization: Apikey ${GANDI_API_KEY}" \
  https://api.gandi.net/v5/livedns/domains/ringer.tel
```

## API Key Permissions Checklist

Your API key needs these permissions:
- ✅ See and renew domain names
- ✅ Manage domain name technical configurations
- ✅ **Manage LiveDNS** (required)
- ❌ Manage domain name contacts (not needed)
- ❌ Manage billing (not needed)
- ❌ Manage products (not needed)

## Integration Testing

Once configured, test the integration:

```bash
# 1. Test creating a test record
./scripts/gandi-dns.sh create-a test-staging "1.2.3.4" 300

# 2. Verify record was created
dig test-staging.ringer.tel

# 3. Clean up test record
curl -X DELETE \
  -H "Authorization: Apikey ${GANDI_API_KEY}" \
  https://api.gandi.net/v5/livedns/domains/ringer.tel/records/test-staging/A
```

## Next Steps

1. ✅ Obtain API key from Gandi
2. ✅ Store securely in Secret Manager
3. ✅ Test API connectivity
4. ✅ Run integration tests
5. ✅ Configure CI/CD pipeline
6. ✅ Deploy DNS management service

---
*Remember: Never commit API keys to git. Always use environment variables or secret management systems.*