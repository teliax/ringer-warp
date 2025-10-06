# WARP Platform Database Schema Documentation

## Overview
The WARP platform uses PostgreSQL 15 on Google Cloud SQL as its primary database, with BigQuery for analytics and CDR/MDR storage.

## Database Architecture

### PostgreSQL Schemas

#### 1. **auth** - Authentication & Authorization
- `users` - System users and authentication
- `sessions` - Active user sessions
- `permissions` - Permission definitions
- `roles` - Role definitions
- `user_roles` - User-role associations

#### 2. **accounts** - Account Management
- `accounts` - Customer accounts (BAN - Billing Account Number)
- `account_contacts` - Account contact information
- `account_settings` - Account-specific settings
- `account_features` - Enabled features per account

#### 3. **billing** - Billing & Rating
- `rate_plans` - Customer rate plan definitions
- `rate_plan_rates` - Specific rates within plans
- `invoices` - Monthly invoices
- `invoice_items` - Line items on invoices
- `payments` - Payment records
- `payment_methods` - Stored payment methods
- `tax_rates` - Tax configuration
- `taxes_applied` - Applied taxes on invoices
- `product_catalog` - SKU-based product definitions
- `balance_updates` - Account balance tracking
- `bigquery_streaming_config` - CDR/MDR streaming configuration

#### 4. **trunks** - SIP Trunk Configuration
- `trunks` - SIP trunk definitions
- `trunk_auth` - Authentication credentials
- `trunk_features` - Enabled features per trunk
- `trunk_access_lists` - IP ACL configuration

#### 5. **numbers** - Number Inventory
- `number_inventory` - DID/TFN inventory
- `number_assignments` - Number-to-trunk assignments
- `number_features` - Features per number (CNAM, E911, etc.)
- `number_porting` - Port-in/out tracking

#### 6. **routing** - Call Routing Engine
- `providers` - Vendor/carrier definitions
- `rates` - Provider rate decks
- `routing_plans` - Routing strategies
- `routing_plan_providers` - Provider assignments
- `provider_performance` - Real-time ASR/ACD tracking
- `provider_poi` - Points of Interconnection

#### 7. **audit** - Audit Trail
- `audit_log` - Comprehensive change tracking
- `api_logs` - API request/response logging
- `login_history` - Authentication audit trail

#### 8. **sms** - SMS/MMS Management
- `jasmin_users` - Jasmin HTTP user accounts
- `jasmin_routes` - Message routing rules
- `jasmin_connectors` - SMPP connector configurations
- `campaigns` - SMS campaign definitions
- `campaign_messages` - Campaign message tracking
- `campaign_rules` - Campaign business rules
- `message_templates` - Pre-approved templates
- `shortcodes` - Shortcode inventory
- `tcr_registrations` - 10DLC brand/campaign registrations
- `opt_outs` - Opt-out management

#### 9. **providers** - Provider Integration
- `netsuite_config` - NetSuite integration settings
- `netsuite_field_mappings` - Field mapping configurations
- `netsuite_sync_logs` - Synchronization history
- `toll_free_management` - RespOrg configurations
- `toll_free_features` - Toll-free number features
- `api_configurations` - Third-party API settings
- `webhook_endpoints` - Webhook URL configurations

### Key Design Principles

1. **Multi-tenancy**: All tables include `account_id` for customer isolation
2. **Soft Deletes**: Most tables use `deleted_at` timestamp instead of hard deletes
3. **Audit Trail**: Critical tables have triggers for comprehensive audit logging
4. **UUID Keys**: All primary keys use UUID v4 for distributed compatibility
5. **Timestamps**: All tables include `created_at` and `updated_at` fields

### Performance Optimizations

#### Indexes
- **B-tree indexes** on all foreign keys
- **Composite indexes** on common query patterns
- **Partial indexes** for soft-delete queries
- **GIN indexes** for JSONB fields
- **BRIN indexes** on timestamp columns for time-series data

#### Partitioning Strategy
- CDR/MDR tables partitioned by date (if stored in PostgreSQL)
- Audit logs partitioned monthly
- Archive strategy moves old data to BigQuery

### BigQuery Integration

#### Datasets
1. **warp_cdr** - Call Detail Records
   - Table: `raw_cdr` (partitioned daily, 90-day retention)
   - Real-time streaming from PostgreSQL

2. **warp_mdr** - Message Detail Records
   - Table: `message_records` (partitioned daily, 90-day retention)
   - Real-time streaming for SMS/MMS records

3. **warp_analytics** - Aggregated Analytics
   - Views: `daily_usage_summary`, `vendor_performance`
   - No expiration, used for long-term reporting

#### Streaming Architecture
- Service account: `warp-bq-streamer@ringer-warp-v01.iam.gserviceaccount.com`
- Batch size: 500 records for CDR, 1000 for MDR
- Batch timeout: 10 seconds
- Error handling: 3 retries with exponential backoff

### Security Model

1. **Row-Level Security**: Implemented via application layer
2. **Encryption**: 
   - At-rest encryption via Cloud SQL
   - In-transit via SSL/TLS
   - Sensitive fields encrypted with pgcrypto
3. **Access Control**:
   - Application user: `warp_app` (limited permissions)
   - Admin user: `postgres` (for maintenance only)
   - Monitoring user: `warp_monitor` (read-only)

### Backup & Recovery

1. **Automated Backups**: Daily via Cloud SQL
2. **Point-in-Time Recovery**: 7-day window
3. **Cross-Region Replicas**: For disaster recovery
4. **Archive Strategy**: 
   - CDRs > 90 days exported to Cloud Storage
   - Audit logs > 1 year archived

### Connection Pooling

- Recommended: PgBouncer or application-level pooling
- Max connections: 1000 (Cloud SQL limit)
- Pool size per service: 20-50 connections
- Connection timeout: 30 seconds

### Monitoring & Alerts

1. **Key Metrics**:
   - Connection count
   - Query performance (p95, p99)
   - Replication lag
   - Disk usage
   - Lock waits

2. **Alert Thresholds**:
   - Connections > 80% of max
   - Disk usage > 85%
   - Replication lag > 30 seconds
   - Long-running queries > 5 minutes

### Data Retention Policies

| Data Type | PostgreSQL Retention | BigQuery Retention | Archive Location |
|-----------|---------------------|-------------------|------------------|
| CDRs | 7 days | 90 days | Cloud Storage |
| MDRs | 7 days | 90 days | Cloud Storage |
| Audit Logs | 90 days | 2 years | Cloud Storage |
| API Logs | 30 days | 1 year | Cloud Storage |
| Invoices | 7 years | Indefinite | N/A |
| Payments | 7 years | Indefinite | N/A |

### Migration Considerations

1. **From Old System**: 
   - Project ID changed from `ringer-472421` to `ringer-warp-v01`
   - Instance name changed to `warp-db`
   - All "dev" references removed

2. **Schema Versioning**: 
   - Use migration tool (e.g., Flyway, Liquibase)
   - Track schema versions in `schema_migrations` table
   - Never modify past migrations

3. **Zero-Downtime Deployments**:
   - Use online schema changes
   - Create indexes CONCURRENTLY
   - Add columns with defaults separately