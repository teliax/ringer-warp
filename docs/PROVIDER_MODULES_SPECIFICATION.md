# Provider Modules Specification

## Overview

The WARP platform uses a plugin-based architecture for all third-party service integrations. Each provider has a dedicated module that implements a common interface while handling provider-specific requirements.

## Core Architecture

### Provider Interface Hierarchy

```go
// Base interface all providers must implement
type Provider interface {
    Initialize(config json.RawMessage) error
    TestConnection() error
    GetCapabilities() []string
    GetConfigSchema() ConfigSchema
    GetHealth() HealthStatus
    Close() error
}

// Category-specific interfaces
type TelecomProvider interface {
    Provider
    LookupLRN(phoneNumber string) (*LRNResponse, error)
    LookupLERG(npa string, nxx string) (*LERGResponse, error)
    LookupCNAM(phoneNumber string) (*CNAMResponse, error)
}

type MessagingProvider interface {
    Provider
    SendSMS(message SMSMessage) (*MessageResponse, error)
    SendMMS(message MMSMessage) (*MessageResponse, error)
    GetDeliveryStatus(messageId string) (*DeliveryStatus, error)
    HandleInbound(handler InboundHandler) error
}

type PaymentProvider interface {
    Provider
    ChargeCard(payment CardPayment) (*PaymentResponse, error)
    RefundPayment(transactionId string, amount decimal.Decimal) (*RefundResponse, error)
    GetTransaction(transactionId string) (*Transaction, error)
    StorePaymentMethod(method PaymentMethod) (*StoredMethod, error)
}

type ERPProvider interface {
    Provider
    CreateInvoice(invoice Invoice) (*InvoiceResponse, error)
    GetCustomer(customerId string) (*Customer, error)
    SyncInventory(items []InventoryItem) error
    HandleWebhook(event WebhookEvent) error
}
```

## Provider Modules

### Telecom Providers

#### Telique (LRN/LERG/CNAM)
```yaml
module: telique
version: 1.0.0
capabilities:
  - lrn_lookup
  - lerg_lookup
  - cnam_lookup
  - bulk_lookup
configuration:
  credentials:
    api_key:
      type: secret
      required: true
      description: "Telique API key"
    account_id:
      type: string
      required: true
      description: "Telique account identifier"
  settings:
    api_url:
      type: url
      default: "https://api-dev.ringer.tel"
      description: "API endpoint URL"
    timeout_seconds:
      type: number
      default: 5
      min: 1
      max: 30
    retry_attempts:
      type: number
      default: 3
      min: 0
      max: 5
    cache_ttl_seconds:
      type: number
      default: 3600
      description: "How long to cache lookup results"
  features:
    enable_lrn:
      type: boolean
      default: true
    enable_lerg:
      type: boolean
      default: true
    enable_cnam:
      type: boolean
      default: true
    enable_bulk_api:
      type: boolean
      default: false
      description: "Use bulk API for batch lookups"
```

#### Somos (Toll-Free Management)
```yaml
module: somos
version: 1.0.0
capabilities:
  - tollfree_search
  - tollfree_reserve
  - tollfree_provision
  - resporg_management
configuration:
  credentials:
    username:
      type: string
      required: true
    password:
      type: secret
      required: true
    resp_org_id:
      type: string
      required: true
      pattern: "^[A-Z0-9]{5}$"
    client_key:
      type: secret
      required: false
      description: "OAuth client key if using OAuth"
    client_secret:
      type: secret
      required: false
  settings:
    api_url:
      type: url
      default: "https://api.somos.com/v2"
    environment:
      type: enum
      values: [production, sandbox]
      default: production
    enable_auto_provision:
      type: boolean
      default: false
```

#### TransUnion (CNAM)
```yaml
module: transunion
version: 1.0.0
capabilities:
  - cnam_provisioning
  - cnam_verification
configuration:
  credentials:
    api_key:
      type: secret
      required: true
    api_secret:
      type: secret
      required: false
  settings:
    api_url:
      type: url
      default: "https://webgateway.callerid.neustar.biz/ecid/v1/"
    timeout_seconds:
      type: number
      default: 10
```

### Messaging Providers

#### SMPP Generic Module
```yaml
module: smpp_generic
version: 1.0.0
capabilities:
  - sms_mt
  - sms_mo
  - delivery_receipts
  - concatenated_sms
configuration:
  credentials:
    system_id:
      type: string
      required: true
    password:
      type: secret
      required: true
  connection:
    host:
      type: string
      required: true
    port:
      type: number
      default: 2775
      min: 1
      max: 65535
    system_type:
      type: string
      default: ""
    bind_type:
      type: enum
      values: [transceiver, transmitter, receiver]
      default: transceiver
    interface_version:
      type: enum
      values: ["3.3", "3.4", "5.0"]
      default: "3.4"
  settings:
    window_size:
      type: number
      default: 10
      min: 1
      max: 100
    enquire_link_interval:
      type: number
      default: 30
      description: "Seconds between keep-alive pings"
    reconnect_delay:
      type: number
      default: 5
      description: "Seconds to wait before reconnecting"
    max_reconnect_attempts:
      type: number
      default: 10
    source_addr_ton:
      type: number
      default: 1
    source_addr_npi:
      type: number
      default: 1
    dest_addr_ton:
      type: number
      default: 1
    dest_addr_npi:
      type: number
      default: 1
```

#### TCR (10DLC Registration)
```yaml
module: tcr
version: 1.0.0
capabilities:
  - brand_registration
  - campaign_registration
  - number_assignment
configuration:
  credentials:
    api_key:
      type: secret
      required: true
    csp_id:
      type: string
      required: true
      description: "Campaign Service Provider ID"
  settings:
    api_url:
      type: url
      default: "https://csp-api.campaignregistry.com/v2"
    webhook_url:
      type: url
      required: false
      description: "URL to receive TCR status updates"
```

### Business Systems

#### NetSuite
```yaml
module: netsuite
version: 1.0.0
capabilities:
  - invoicing
  - payments
  - customer_sync
  - inventory_sync
  - custom_records
configuration:
  credentials:
    account_id:
      type: string
      required: true
      pattern: "^[0-9]+(_SB[0-9]+)?$"
    consumer_key:
      type: secret
      required: true
    consumer_secret:
      type: secret
      required: true
    token_id:
      type: secret
      required: true
    token_secret:
      type: secret
      required: true
  settings:
    api_version:
      type: enum
      values: ["2023.1", "2023.2", "2024.1"]
      default: "2023.2"
    subsidiary_id:
      type: string
      required: false
    location_id:
      type: string
      required: false
    department_id:
      type: string
      required: false
    class_id:
      type: string
      required: false
    custom_form_id:
      type: string
      required: false
    tax_item_id:
      type: string
      required: false
  webhooks:
    invoice_created:
      type: url
      required: false
    payment_received:
      type: url
      required: false
    customer_updated:
      type: url
      required: false
  field_mappings:
    type: json
    description: "Custom field mappings between WARP and NetSuite"
```

#### HubSpot
```yaml
module: hubspot
version: 1.0.0
capabilities:
  - contact_sync
  - company_sync
  - deal_management
  - ticket_management
  - email_marketing
configuration:
  credentials:
    api_key:
      type: secret
      required: false
      description: "Legacy API key (deprecated)"
    access_token:
      type: secret
      required: false
      description: "OAuth2 access token"
    refresh_token:
      type: secret
      required: false
    app_id:
      type: string
      required: false
    portal_id:
      type: string
      required: true
  settings:
    api_url:
      type: url
      default: "https://api.hubapi.com"
    sync_interval_minutes:
      type: number
      default: 15
      min: 5
      max: 1440
    enable_bidirectional_sync:
      type: boolean
      default: true
    default_pipeline_id:
      type: string
      required: false
    default_owner_id:
      type: string
      required: false
  webhooks:
    contact_created:
      type: url
      required: false
    deal_updated:
      type: url
      required: false
    ticket_created:
      type: url
      required: false
  field_mappings:
    contact_fields:
      type: json
    company_fields:
      type: json
    deal_fields:
      type: json
```

#### Avalara (Tax)
```yaml
module: avalara
version: 1.0.0
capabilities:
  - tax_calculation
  - address_validation
  - tax_reporting
configuration:
  credentials:
    account_id:
      type: string
      required: true
    license_key:
      type: secret
      required: true
  settings:
    api_url:
      type: url
      default: "https://rest.avatax.com"
      description: "Use sandbox URL for testing"
    company_code:
      type: string
      required: true
    commit_transactions:
      type: boolean
      default: false
      description: "Auto-commit transactions to AvaTax"
    enable_address_validation:
      type: boolean
      default: true
    default_tax_code:
      type: string
      default: "P0000000"
```

### Payment Processors

#### Authorize.Net
```yaml
module: authorizenet
version: 1.0.0
capabilities:
  - credit_card_processing
  - ach_processing
  - recurring_billing
  - payment_profiles
configuration:
  credentials:
    api_login_id:
      type: string
      required: true
    transaction_key:
      type: secret
      required: true
  settings:
    environment:
      type: enum
      values: [production, sandbox]
      default: production
    api_url:
      type: url
      computed: true # Set based on environment
    enable_cim:
      type: boolean
      default: true
      description: "Customer Information Manager for storing cards"
    enable_arb:
      type: boolean
      default: true
      description: "Automated Recurring Billing"
    duplicate_window:
      type: number
      default: 120
      description: "Seconds to check for duplicate transactions"
```

#### Mustache/Plaid
```yaml
module: mustache
version: 1.0.0
capabilities:
  - ach_processing
  - bank_verification
  - balance_checks
configuration:
  credentials:
    api_key:
      type: secret
      required: true
    secret_key:
      type: secret
      required: true
    plaid_client_id:
      type: string
      required: false
    plaid_secret:
      type: secret
      required: false
  settings:
    environment:
      type: enum
      values: [production, sandbox, development]
      default: sandbox
    webhook_url:
      type: url
      required: false
    enable_micro_deposits:
      type: boolean
      default: true
    enable_plaid_link:
      type: boolean
      default: false
```

### Infrastructure Services

#### SendGrid
```yaml
module: sendgrid
version: 1.0.0
capabilities:
  - transactional_email
  - marketing_email
  - email_validation
configuration:
  credentials:
    api_key:
      type: secret
      required: true
  settings:
    from_email:
      type: email
      required: true
      default: "noreply@ringer.tel"
    from_name:
      type: string
      default: "WARP Platform"
    reply_to_email:
      type: email
      required: false
    enable_tracking:
      type: boolean
      default: true
    enable_click_tracking:
      type: boolean
      default: false
    sandbox_mode:
      type: boolean
      default: false
  webhooks:
    event_webhook:
      type: url
      required: false
      description: "Receive email events (opens, clicks, bounces)"
```

#### Gandi (DNS)
```yaml
module: gandi
version: 1.0.0
capabilities:
  - dns_management
  - domain_registration
  - ssl_certificates
configuration:
  credentials:
    api_key:
      type: secret
      required: true
  settings:
    api_url:
      type: url
      default: "https://api.gandi.net/v5/livedns"
    default_ttl:
      type: number
      default: 300
      min: 300
      max: 2592000
    enable_dnssec:
      type: boolean
      default: false
```

#### Airbrake
```yaml
module: airbrake
version: 1.0.0
capabilities:
  - error_tracking
  - performance_monitoring
  - deployment_tracking
configuration:
  credentials:
    project_id:
      type: string
      required: true
    project_key:
      type: secret
      required: true
  settings:
    environment:
      type: enum
      values: [production, staging, development]
      default: production
    api_url:
      type: url
      default: "https://api.airbrake.io"
    ignore_environments:
      type: array
      items: string
      default: ["development", "test"]
    filter_parameters:
      type: array
      items: string
      default: ["password", "api_key", "token", "secret"]
```

## Admin UI Dynamic Form Generation

The admin UI will dynamically generate configuration forms based on the module schemas:

```typescript
interface ProviderFormGenerator {
  // Load provider module schema
  loadSchema(providerType: string): Promise<ConfigSchema>
  
  // Generate form fields from schema
  generateForm(schema: ConfigSchema): FormDefinition
  
  // Validate form data against schema
  validateForm(data: any, schema: ConfigSchema): ValidationResult
  
  // Handle secret fields (store in Secret Manager)
  processSecrets(data: any, schema: ConfigSchema): Promise<ProcessedConfig>
}

// Dynamic form field rendering
const renderField = (field: FieldDefinition) => {
  switch(field.type) {
    case 'secret':
      return <PasswordInput encrypted={true} />
    case 'url':
      return <URLInput validation={validateURL} />
    case 'enum':
      return <SelectInput options={field.values} />
    case 'boolean':
      return <ToggleSwitch />
    case 'number':
      return <NumberInput min={field.min} max={field.max} />
    case 'json':
      return <JSONEditor schema={field.schema} />
    case 'array':
      return <ArrayInput itemType={field.items} />
    default:
      return <TextInput pattern={field.pattern} />
  }
}
```

## Provider Selection Logic

```go
// Service layer selects appropriate provider based on capabilities
type ProviderSelector struct {
    providers map[string][]Provider
}

func (ps *ProviderSelector) GetProvider(capability string) (Provider, error) {
    // Get all providers with this capability
    candidates := ps.getProvidersWithCapability(capability)
    
    // Filter by active status
    active := filterActive(candidates)
    
    // Sort by priority
    sorted := sortByPriority(active)
    
    // Check health status
    for _, provider := range sorted {
        if provider.GetHealth() == HealthyStatus {
            return provider, nil
        }
    }
    
    // Fallback to degraded if no healthy providers
    for _, provider := range sorted {
        if provider.GetHealth() == DegradedStatus {
            return provider, nil
        }
    }
    
    return nil, ErrNoAvailableProvider
}
```

## Webhook Management

Each provider can define webhooks that need to be configured:

```go
type WebhookManager struct {
    // Register webhook endpoint for provider
    RegisterWebhook(providerId string, webhook WebhookConfig) error
    
    // Handle incoming webhook
    HandleWebhook(request *http.Request) error
    
    // Verify webhook signature
    VerifySignature(providerId string, request *http.Request) bool
    
    // Route webhook to appropriate handler
    RouteWebhook(event WebhookEvent) error
}
```

## Health Monitoring

Continuous health checks for all configured providers:

```go
type HealthMonitor struct {
    interval time.Duration
    
    // Run health checks for all providers
    CheckAll() {
        for _, provider := range providers {
            go ps.checkProvider(provider)
        }
    }
    
    // Check individual provider
    checkProvider(provider Provider) {
        start := time.Now()
        err := provider.TestConnection()
        duration := time.Since(start)
        
        status := HealthyStatus
        if err != nil {
            status = UnhealthyStatus
        } else if duration > provider.GetSLO() {
            status = DegradedStatus
        }
        
        // Store health check result
        ps.storeHealthCheck(provider.ID, status, duration, err)
        
        // Alert if status changed
        if status != provider.LastStatus {
            ps.alertStatusChange(provider, status)
        }
    }
}
```

## Migration Path for Existing Integrations

For the hive-mind implementation:

1. **Phase 1**: Build provider modules for existing integrations
2. **Phase 2**: Create admin UI for provider configuration
3. **Phase 3**: Migrate hardcoded configs to database
4. **Phase 4**: Enable dynamic provider switching
5. **Phase 5**: Add health monitoring and auto-failover

## Hive-Mind Implementation Notes

The Claude Flow hive-mind should:

1. **Use the API documentation** in `/docs/api_docs/` to build accurate provider modules
2. **Create comprehensive test suites** for each provider module
3. **Implement retry logic** with exponential backoff for all external calls
4. **Add circuit breakers** to prevent cascade failures
5. **Cache responses** where appropriate (especially for telecom lookups)
6. **Log all interactions** for debugging and audit purposes
7. **Handle rate limits** gracefully with queuing and backpressure
8. **Support bulk operations** where provider APIs allow
9. **Implement webhook handlers** for async events
10. **Create provider-specific error mappings** to standardize error handling
