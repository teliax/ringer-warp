# Secrets Management Implementation Guide

## Overview
This guide provides instructions for hive-mind agents on how to handle credentials and secrets in the WARP platform. ALL sensitive credentials must be stored in Google Secret Manager, never in code or `.env` files.

## Core Principles

1. **No secrets in code** - Never hardcode credentials
2. **No secrets in `.env`** - Only non-sensitive configuration
3. **Use Google Secret Manager** - All credentials stored centrally
4. **Use Google Artifact Registry** - All Docker images stored here (NOT Container Registry)
5. **Build for AMD64** - All images must be AMD64 architecture

## Google Secret Manager Setup

### Secret Naming Convention
```
projects/ringer-472421/secrets/{service}-credentials/versions/latest
```

### Complete API Inventory and Required Secrets

Based on the api_docs folder, the following third-party integrations require secrets:

#### Authentication & Identity
- **Google Identity Platform**: OAuth2 for portals
  - Secret name: `gcp-identity-platform`
  - Fields: api_key, auth_domain, project_id
  - Used for: Customer/Admin portal authentication

- **Telco API Keys**: High-performance API authentication
  - Secret name: `telco-api-keys`
  - Fields: JSON array of API key configurations
  - Format: `[{"key_hash": "sha256_hash", "customer_id": "123", "rate_limit": 5000, "ip_allowlist": ["35.1.1.1"]}]`
  - Used for: LRN/LERG/CNAM lookups at 5000+ TPS

#### Telecom Core Services  
- **Telique**: LRN/LERG/CNAM lookups
  - Secret name: `telique-credentials`
  - Fields: api_key, api_url, account_id
  
- **Somos**: Toll-free number management and RespOrg operations
  - Secret name: `somos-credentials`
  - Fields: username, password, client_key, client_secret, resp_org_id
  
- **TransUnion**: CNAM provisioning
  - Secret name: `transunion-credentials`
  - Fields: api_key, api_url

- **Teliport**: Number porting operations
  - Secret name: `teliport-credentials`
  - Fields: api_key, api_url, account_id

#### Messaging Services
- **Sinch**: SMS/Voice provider
  - Secret name: `sinch-credentials`
  - Fields: app_key, app_secret, service_plan_id
  
- **Sinch SMPP**: SMPP gateway for SMS
  - Secret name: `sinch-smpp-credentials`
  - Fields: host, port, system_id, password, system_type
  
- **TCR (Campaign Registry)**: 10DLC campaign management
  - Secret name: `tcr-credentials`
  - Fields: api_key, csp_id, api_url

- **LSMS**: Local SMS routing
  - Secret name: `lsms-credentials`
  - Fields: api_key, api_url

#### Business Systems
- **NetSuite**: ERP and billing
  - Secret name: `netsuite-credentials`
  - Fields: account_id, consumer_key, consumer_secret, token_id, token_secret
  
- **HubSpot**: CRM integration
  - Secret name: `hubspot-credentials`
  - Fields: api_key, portal_id
  
- **Avalara**: Tax calculation
  - Secret name: `avalara-credentials`
  - Fields: account_id, license_key, company_code

#### Payment Processing
- **Authorize.Net**: Credit card processing
  - Secret name: `authorizenet-credentials`
  - Fields: api_login_id, transaction_key
  
- **Mustache/Plaid**: ACH payments
  - Secret name: `mustache-credentials`
  - Fields: api_key, secret_key

#### Infrastructure Services
- **SendGrid**: Email delivery
  - Secret name: `sendgrid-credentials`
  - Fields: api_key, from_email, from_name
  
- **Gandi**: DNS management
  - Secret name: `gandi-credentials`
  - Fields: api_key, api_url

- **Airbrake**: Error tracking
  - Secret name: `airbrake-credentials`
  - Fields: project_id, project_key

#### Internal Services (Auto-Generated During Infrastructure Creation)
**NOTE**: These secrets will be automatically created when the hive-mind provisions the infrastructure. They are listed here for reference only.

- **PostgreSQL (Cloud SQL)**: Primary database
  - Secret name: `cloudsql-postgres-credentials`
  - Auto-generated when: Cloud SQL instance is created
  - Will contain: host, port, database, username, password

- **BigQuery**: Analytics and CDR storage
  - Secret name: `bigquery-credentials`
  - Auto-generated when: BigQuery datasets are created
  - Will contain: dataset_id, project_id

- **Redis (Memorystore)**: Caching
  - Secret name: `redis-credentials`
  - Auto-generated when: Memorystore instance is created
  - Will contain: host, port, password (if auth enabled)

### Creating External API Secrets (Manual Setup Required)

These are third-party API credentials that must be obtained from external vendors and stored before infrastructure creation:

```bash
# Example: Create Google Identity Platform credentials secret
echo -n '{
  "domain": "warp.firebaseapp.com",
  "client_id": "xxx",
  "client_secret": "yyy",
  "audience": "https://api.ringer.tel"
}' | gcloud secrets create gcp-identity-platform \
    --data-file=- \
    --replication-policy="automatic" \
    --project=ringer-472421

# Example: Create Telique credentials
echo -n '{
  "api_key": "xxx",
  "api_url": "https://api.telique.com/v1",
  "account_id": "yyy"
}' | gcloud secrets create telique-credentials \
    --data-file=- \
    --replication-policy="automatic" \
    --project=ringer-472421
```

### Creating Internal Service Secrets (Automated by Infrastructure)

When the hive-mind creates the infrastructure, it will automatically:

```bash
# Example: What happens when Cloud SQL is created
# 1. Terraform/Kubernetes creates Cloud SQL instance
resource "google_sql_database_instance" "postgres" {
  name = "warp-postgres"
  # ... configuration
}

# 2. Generate secure password
resource "random_password" "postgres" {
  length = 32
  special = true
}

# 3. Store in Secret Manager automatically
resource "google_secret_manager_secret_version" "postgres" {
  secret = google_secret_manager_secret.postgres.id
  secret_data = jsonencode({
    host     = google_sql_database_instance.postgres.private_ip_address
    port     = "5432"
    database = "warp"
    username = "warp_admin"
    password = random_password.postgres.result
  })
}
```

### Accessing Secrets in Code

#### Go Services
```go
import (
    secretmanager "cloud.google.com/go/secretmanager/apiv1"
    "context"
)

func getSecret(secretName string) (string, error) {
    ctx := context.Background()
    client, err := secretmanager.NewClient(ctx)
    if err != nil {
        return "", err
    }
    defer client.Close()

    // Build the resource name
    name := fmt.Sprintf("projects/ringer-472421/secrets/%s/versions/latest", secretName)
    
    // Access the secret
    result, err := client.AccessSecretVersion(ctx, &secretmanagerpb.AccessSecretVersionRequest{
        Name: name,
    })
    if err != nil {
        return "", err
    }
    
    return string(result.Payload.Data), nil
}

// Usage
identityConfig, err := getSecret("gcp-identity-platform")
```

#### Node.js/TypeScript Services
```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

class SecretManager {
  private client: SecretManagerServiceClient;
  
  constructor() {
    this.client = new SecretManagerServiceClient();
  }
  
  async getSecret(secretName: string): Promise<string> {
    const name = `projects/ringer-472421/secrets/${secretName}/versions/latest`;
    
    const [version] = await this.client.accessSecretVersion({ name });
    const payload = version.payload?.data?.toString();
    
    if (!payload) {
      throw new Error(`Secret ${secretName} is empty`);
    }
    
    return payload;
  }
}

// Usage
const secretManager = new SecretManager();
const identityConfig = JSON.parse(await secretManager.getSecret('gcp-identity-platform'));
```

#### Python Services
```python
from google.cloud import secretmanager
import json

def get_secret(secret_name: str) -> str:
    """Retrieve secret from Google Secret Manager"""
    client = secretmanager.SecretManagerServiceClient()
    
    # Build the resource name
    name = f"projects/ringer-472421/secrets/{secret_name}/versions/latest"
    
    # Access the secret
    response = client.access_secret_version(request={"name": name})
    payload = response.payload.data.decode("UTF-8")
    
    return payload

# Usage
identity_config = json.loads(get_secret("gcp-identity-platform"))
```

## Google Artifact Registry Setup

### Registry Configuration
```bash
# Create the repository (one-time setup)
gcloud artifacts repositories create warp-platform \
    --repository-format=docker \
    --location=us-central1 \
    --description="WARP platform container images" \
    --project=ringer-472421

# Configure Docker authentication
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### Building and Pushing Images

```bash
# Build image for AMD64 architecture
docker buildx build \
    --platform linux/amd64 \
    -t us-central1-docker.pkg.dev/ringer-472421/warp-platform/api-gateway:latest \
    -f Dockerfile \
    .

# Push to Artifact Registry
docker push us-central1-docker.pkg.dev/ringer-472421/warp-platform/api-gateway:latest
```

### Dockerfile Example
```dockerfile
# Always specify platform
FROM --platform=linux/amd64 golang:1.21-alpine AS builder

# Build stage
WORKDIR /app
COPY . .
RUN go build -o api-gateway

# Runtime stage
FROM --platform=linux/amd64 alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/api-gateway .
CMD ["./api-gateway"]
```

## Kubernetes Deployment with Secrets

### Using Workload Identity for Secret Access
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: api-gateway-sa
  annotations:
    iam.gke.io/gcp-service-account: api-gateway@ringer-472421.iam.gserviceaccount.com

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  template:
    spec:
      serviceAccountName: api-gateway-sa
      containers:
      - name: api-gateway
        image: us-central1-docker.pkg.dev/ringer-472421/warp-platform/api-gateway:latest
        env:
        - name: GCP_PROJECT_ID
          value: "ringer-472421"
        - name: SECRET_MANAGER_PROJECT
          value: "ringer-472421"
        # No actual secrets in env vars!
```

### Grant Secret Access to Service Account
```bash
# Grant secret accessor role to service account
gcloud secrets add-iam-policy-binding gcp-identity-platform \
    --member="serviceAccount:api-gateway@ringer-472421.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --project=ringer-472421
```

## Vercel Frontend Deployment

### Setting Environment Variables in Vercel

```bash
# Use Vercel CLI to set environment variables
vercel env add NEXT_PUBLIC_API_URL production
# Enter value: https://api.ringer.tel/v1

vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN production
# Enter value: warp.firebaseapp.com

# For secrets that frontend needs (rare)
vercel env add FIREBASE_PROJECT_ID production
# Enter value: [paste from Google Identity Platform dashboard]
```

### Next.js Configuration
```typescript
// next.config.js
module.exports = {
  env: {
    // Only NEXT_PUBLIC_ variables are exposed to browser
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  },
  // Server-side only variables don't need NEXT_PUBLIC_ prefix
  serverRuntimeConfig: {
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  },
}
```

## Local Development

### Using Secret Manager in Development
```bash
# Set up Application Default Credentials
gcloud auth application-default login
gcloud config set project ringer-472421

# Your local code will now use your Google credentials to access secrets
```

### Development Override Pattern
```typescript
// config.ts
export async function getConfig() {
  if (process.env.NODE_ENV === 'development' && process.env.USE_LOCAL_SECRETS) {
    // Load from local .env.development for non-sensitive values
    return {
      apiUrl: process.env.API_URL || 'http://localhost:8080',
      // ... other non-sensitive config
    };
  }
  
  // Production: Load from Secret Manager
  const secretManager = new SecretManager();
  const googleIdentity = JSON.parse(await secretManager.getSecret('gcp-identity-platform'));
  
  return {
    googleIdentity,
    // ... other production config
  };
}
```

## Security Best Practices

1. **Least Privilege**: Each service account only gets access to secrets it needs
2. **Rotation**: Set up rotation reminders for API keys (90 days)
3. **Audit Logging**: Enable Cloud Audit Logs for secret access
4. **Version Control**: Never commit secrets, even encrypted
5. **Environment Isolation**: Separate secrets for dev/staging/production

## Hive-Mind Implementation Checklist

### Agent 1 (Infrastructure)
- [ ] Create Google Artifact Registry repository
- [ ] Set up Workload Identity for GKE
- [ ] Create service accounts for each service
- [ ] Grant secret access permissions

### Agent 2 (Core Services)
- [ ] Implement secret manager client in each service
- [ ] Remove all hardcoded credentials
- [ ] Build AMD64 Docker images
- [ ] Push images to Artifact Registry

### Agent 3 (Integrations)
- [ ] Store all external API credentials in Secret Manager
- [ ] Update integration code to fetch secrets
- [ ] Test secret rotation procedures

### Agent 4 (Frontend)
- [ ] Configure Vercel environment variables
- [ ] Ensure no secrets in client-side code
- [ ] Use NEXT_PUBLIC_ prefix correctly

## Common Pitfalls to Avoid

1. **DON'T** put secrets in `.env` files
2. **DON'T** use Google Container Registry (deprecated)
3. **DON'T** build ARM architecture images
4. **DON'T** hardcode project IDs (use environment variable)
5. **DON'T** expose secrets in client-side JavaScript
6. **DON'T** log secret values

## Troubleshooting

### Permission Denied on Secret Access
```bash
# Check service account permissions
gcloud secrets get-iam-policy gcp-identity-platform --project=ringer-472421

# Grant access if missing
gcloud secrets add-iam-policy-binding gcp-identity-platform \
    --member="serviceAccount:YOUR-SA@ringer-472421.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

### Cannot Push to Artifact Registry
```bash
# Authenticate Docker
gcloud auth configure-docker us-central1-docker.pkg.dev

# Check repository exists
gcloud artifacts repositories list --location=us-central1
```

### Secret Not Found
```bash
# List all secrets
gcloud secrets list --project=ringer-472421

# Check secret exists and has versions
gcloud secrets versions list gcp-identity-platform --project=ringer-472421
```

---

This guide ensures all hive-mind agents handle secrets consistently and securely using Google Secret Manager and Artifact Registry.
