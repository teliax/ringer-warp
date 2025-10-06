# WARP Database Initialization

This directory contains Kubernetes resources for initializing the WARP database schema.

## Components

1. **db-credentials-secret.yaml** - Kubernetes Secret containing database credentials
2. **create-schema-configmap.sh** - Script to create ConfigMap from SQL schema files
3. **db-init-job.yaml** - Kubernetes Job with hardcoded credentials (not recommended)
4. **db-init-job-with-secret.yaml** - Kubernetes Job using Secret for credentials (recommended)
5. **deploy-db-init.sh** - Complete deployment script

## Prerequisites

- Kubernetes cluster with kubectl configured
- Access to the `warp-core` namespace
- PostgreSQL database running at `10.126.0.3`
- Schema files located at `/home/daldworth/repos/ringer-warp/warp/database/schema/`

## Quick Start

Run the complete initialization process:

```bash
cd /home/daldworth/repos/ringer-warp/warp/k8s/database
./deploy-db-init.sh
```

## Manual Steps

If you prefer to run the steps manually:

1. Create the namespace (if it doesn't exist):
   ```bash
   kubectl create namespace warp-core
   ```

2. Create the database credentials secret:
   ```bash
   kubectl apply -f db-credentials-secret.yaml
   ```

3. Create the ConfigMap with schema files:
   ```bash
   ./create-schema-configmap.sh
   ```

4. Run the initialization job:
   ```bash
   kubectl apply -f db-init-job-with-secret.yaml
   ```

5. Monitor the job:
   ```bash
   kubectl logs -f -n warp-core job/warp-db-init
   ```

## Database Details

- **Host**: 10.126.0.3 (internal IP)
- **Port**: 5432
- **Database**: warp
- **User**: warp
- **Schemas Created**:
  - accounts
  - auth
  - billing
  - numbers
  - routing
  - cdr
  - messaging
  - audit
  - vendor_mgmt

## Schema Files

The following SQL files are executed in order:

1. `00_extensions.sql` - PostgreSQL extensions and custom types
2. `01_accounts.sql` - Account management tables
3. `02_auth.sql` - Authentication and authorization tables
4. `03_numbers.sql` - Phone number management
5. `04_routing.sql` - Call routing configuration
6. `05_cdr.sql` - Call Detail Records
7. `06_messaging.sql` - SMS/MMS messaging tables
8. `07_billing.sql` - Billing and invoicing
9. `08_vendor_mgmt.sql` - Vendor/carrier management
10. `09_audit.sql` - Audit logging
11. `10_indexes_performance.sql` - Performance indexes
12. `11_seed_data.sql` - Initial seed data

## Job Features

- **Idempotent**: The job checks if schemas already exist and skips initialization if the database is already set up
- **Error Handling**: Uses `ON_ERROR_STOP=1` to halt on any SQL errors
- **Verification**: After initialization, verifies that all schemas, tables, and extensions were created
- **TTL**: Job is automatically cleaned up after 1 hour (`ttlSecondsAfterFinished: 3600`)
- **Retry**: Configured with `backoffLimit: 3` for automatic retries on failure

## Troubleshooting

1. **Check job status**:
   ```bash
   kubectl get jobs -n warp-core
   ```

2. **View job logs**:
   ```bash
   kubectl logs -n warp-core job/warp-db-init
   ```

3. **Delete and retry**:
   ```bash
   kubectl delete job warp-db-init -n warp-core
   kubectl apply -f db-init-job-with-secret.yaml
   ```

4. **Verify database connection**:
   ```bash
   kubectl run -it --rm psql-test --image=postgres:15-alpine --restart=Never -n warp-core -- \
     psql postgresql://warp:)T]!sXUi>SE+DeWt6a8Wmy*Q)A4q6R:}@10.126.0.3:5432/warp -c "\dn"
   ```

## Security Notes

- The database password is stored in a Kubernetes Secret
- Consider using sealed-secrets or external secret management in production
- Ensure the database credentials secret is properly secured with RBAC
- The database should only be accessible from within the cluster network