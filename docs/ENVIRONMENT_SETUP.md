# WARP Platform Environment Setup Guide

## Overview
This guide explains how to configure environment variables for the WARP platform, including all third-party service integrations.

## Quick Start

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Fill in your credentials for each service
3. Validate your configuration:
```bash
./scripts/validate-env.sh
```

## Required Services Setup

### 1. Google Cloud Platform
Already configured via gcloud CLI, but ensure these are set:
- `GCP_PROJECT_ID`: Your GCP project ID
- `GCP_REGION`: Primary deployment region
- Service accounts should be created for:
  - Kamailio pods
  - API services
  - RTPEngine VMs

### 2. Sinch (SMS/Voice Provider)

#### Account Setup
1. Sign up at [Sinch Dashboard](https://dashboard.sinch.com)
2. Create a new SMS service plan
3. Set up SMPP binds for A2P messaging
4. Configure voice application

#### Required Credentials
- `SINCH_APP_KEY`: Found in Dashboard → Apps
- `SINCH_APP_SECRET`: Generated when creating app
- `SMPP_SYSTEM_ID`: Provided after SMPP setup
- `SMPP_PASSWORD`: SMPP bind password

### 3. Vercel (Frontend Hosting)

#### Setup
1. Install Vercel CLI: `npm i -g vercel`
2. Link your project: `vercel link`
3. Get your API token from [Account Settings](https://vercel.com/account/tokens)

#### Required Values
- `VERCEL_TOKEN`: Personal access token
- `VERCEL_ORG_ID`: Found in team settings
- `VERCEL_PROJECT_ID`: From project settings

### 4. Auth0 or Keycloak (OAuth Provider)

#### Auth0 Setup
1. Create application at [Auth0 Dashboard](https://manage.auth0.com)
2. Configure as "Regular Web Application"
3. Set callback URLs for your domain
4. Create API audience

#### Keycloak Setup (Alternative)
1. Deploy Keycloak on GKE
2. Create realm "warp"
3. Configure client "warp-api"
4. Set up user federation if needed

### 5. Telique (Telecom Data)

#### Account Setup
1. Contact Telique sales for API access
2. Request access to:
   - LERG database
   - LRN lookups
   - CNAM services
3. Get API credentials

#### Configuration
- `TELIQUE_API_KEY`: Provided by Telique
- `TELIQUE_ACCOUNT_ID`: Your account identifier
- Enable specific services via feature flags

### 6. Jasmin SMS Gateway

#### Deployment
```bash
# Deploy on GKE
kubectl apply -f k8s/jasmin/

# Configure SMPP connectors
jasmin-cli connector add sinch
```

#### Configuration
- Default admin password should be changed
- RabbitMQ connection must be configured
- Set up HTTP API authentication

### 7. Database Connections

#### PostgreSQL (Cloud SQL) - Primary Database
```bash
# Create instance with high availability
gcloud sql instances create warp-db \
  --database-version=POSTGRES_14 \
  --tier=db-n1-standard-4 \
  --region=us-central1 \
  --availability-type=REGIONAL \
  --enable-bin-log

# Create databases
gcloud sql databases create warp --instance=warp-db
gcloud sql databases create kamailio --instance=warp-db
gcloud sql databases create homer --instance=warp-db

# Get connection details
gcloud sql instances describe warp-db
```

#### Note on CockroachDB
CockroachDB is NOT used in this architecture. Cloud SQL PostgreSQL with regional replication provides the necessary HA capabilities.

#### Redis
```bash
# Deploy Redis cluster
kubectl apply -f k8s/redis/

# Get connection details
kubectl get service redis-cluster
```

### 8. Monitoring Services

#### Prometheus & Grafana
```bash
# Deploy monitoring stack
helm install monitoring prometheus-community/kube-prometheus-stack
```

#### Sentry
1. Create project at [Sentry.io](https://sentry.io)
2. Get DSN from project settings
3. Configure release tracking

## Environment-Specific Configuration

### Development
```bash
NODE_ENV=development
DEBUG=true
LOG_LEVEL=debug
MOCK_SMS_ENABLED=true
```

### Staging
```bash
NODE_ENV=staging
DEBUG=false
LOG_LEVEL=info
FEATURE_FLAGS_TESTING=true
```

### Production
```bash
NODE_ENV=production
DEBUG=false
LOG_LEVEL=warning
BACKUP_ENABLED=true
DR_ENABLED=true
```

## Security Best Practices

### 1. Secrets Management
```bash
# Use Google Secret Manager
gcloud secrets create api-key --data-file=api-key.txt

# Reference in K8s
kubectl create secret generic warp-secrets \
  --from-env-file=.env.production
```

### 2. Key Rotation
- Rotate JWT secrets monthly
- Update API keys quarterly
- Refresh OAuth tokens as needed
- Document rotation in audit log

### 3. Access Control
- Use service accounts for GCP resources
- Implement least privilege principle
- Enable MFA for all admin accounts
- Audit access logs regularly

## Validation Script

Create `scripts/validate-env.sh`:
```bash
#!/bin/bash

# Check required environment variables
required_vars=(
  "GCP_PROJECT_ID"
  "POSTGRES_HOST"
  "REDIS_HOST"
  "SINCH_APP_KEY"
  "AUTH0_DOMAIN"
  "TELIQUE_API_KEY"
  "KAMAILIO_SERVICE_HOST"
  "JASMIN_HOST"
)

missing_vars=()
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    missing_vars+=($var)
  fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
  echo "Missing required environment variables:"
  printf '%s\n' "${missing_vars[@]}"
  exit 1
fi

echo "✓ All required environment variables are set"

# Test database connections
echo "Testing PostgreSQL connection..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✓ PostgreSQL connection successful"
else
  echo "✗ PostgreSQL connection failed"
  exit 1
fi

# Test Redis connection
echo "Testing Redis connection..."
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD ping > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✓ Redis connection successful"
else
  echo "✗ Redis connection failed"
  exit 1
fi

echo "✓ Environment validation complete"
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors
- Check Cloud SQL proxy is running
- Verify IP whitelisting
- Ensure SSL certificates are valid

#### 2. Authentication Failures
- Verify OAuth callback URLs
- Check token expiration
- Ensure correct audience/scope

#### 3. SMS Delivery Issues
- Verify SMPP bind status
- Check Sinch account balance
- Review DLR reports

#### 4. Missing Environment Variables
- Use validation script
- Check for typos in variable names
- Ensure .env file is loaded

## Support Contacts

- **GCP Support**: Via Cloud Console
- **Sinch Support**: support@sinch.com
- **Telique Support**: api-support@telique.com
- **Auth0 Support**: Via Dashboard
- **Internal**: ops@warp.io

## Next Steps

1. Complete environment setup
2. Run validation script
3. Deploy to development environment
4. Test all integrations
5. Document any custom configurations