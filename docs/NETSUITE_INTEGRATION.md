# NetSuite Integration Guide

## Overview
This document provides the complete specification for integrating NetSuite with the WARP platform using OAuth 2.0 Authorization Code Flow. The integration enables automated synchronization of customer data, billing information, and financial records between WARP and NetSuite.

## Authentication Configuration

### OAuth 2.0 Authorization Code Flow
NetSuite uses OAuth 2.0 (not Token-Based Authentication) for REST API access.

#### Account Information
- **NetSuite Account ID**: `4708559`
- **Base API URL**: `https://4708559.suitetalk.api.netsuite.com/services/rest`
- **Authorization URL**: `https://4708559.app.netsuite.com/app/login/oauth2/authorize.nl`
- **Token URL**: `https://4708559.restlets.api.netsuite.com/rest/platform/v1/oauth/token`
- **Redirect URI**: `http://localhost:8080/callback` (development)
- **Production Redirect URI**: `https://api.ringer.tel/v1/netsuite/callback`

#### Required OAuth Parameters
- **Response Type**: `code`
- **Grant Type**: `authorization_code`
- **Scope**: `rest_webservices`
- **State**: Random string for CSRF protection

## Initial Setup Process

### Step 1: Local Development Setup
For initial token acquisition, start a local server to handle the OAuth callback:

```python
# scripts/netsuite_oauth_setup.py
import http.server
import socketserver
import urllib.parse
import webbrowser
import secrets
import base64
import json
import requests

class OAuthCallbackHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/callback'):
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            
            if 'code' in params:
                auth_code = params['code'][0]
                print(f"✅ Authorization code received: {auth_code}")
                
                # Exchange for tokens
                tokens = exchange_code_for_tokens(auth_code)
                print(f"✅ Access token acquired")
                print(f"✅ Refresh token acquired")
                
                # Save tokens securely
                save_tokens(tokens)
                
                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(b"<h1>Authorization successful!</h1><p>You can close this window.</p>")
            else:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"<h1>Authorization failed</h1>")

def exchange_code_for_tokens(auth_code):
    """Exchange authorization code for access and refresh tokens"""
    token_url = "https://4708559.restlets.api.netsuite.com/rest/platform/v1/oauth/token"
    
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    
    data = {
        'grant_type': 'authorization_code',
        'code': auth_code,
        'redirect_uri': 'http://localhost:8080/callback',
        'client_id': os.environ['NETSUITE_CLIENT_ID'],
        'client_secret': os.environ['NETSUITE_CLIENT_SECRET']
    }
    
    response = requests.post(token_url, headers=headers, data=data)
    return response.json()

# Start local server
PORT = 8080
with socketserver.TCPServer(("", PORT), OAuthCallbackHandler) as httpd:
    print(f"Server running at http://localhost:{PORT}/")
    httpd.serve_forever()
```

### Step 2: Generate Authorization URL
```python
def generate_auth_url(client_id, state=None):
    """Generate the NetSuite authorization URL"""
    if not state:
        state = secrets.token_urlsafe(32)
    
    params = {
        'response_type': 'code',
        'client_id': client_id,
        'scope': 'rest_webservices',
        'redirect_uri': 'http://localhost:8080/callback',
        'state': state
    }
    
    auth_url = "https://4708559.app.netsuite.com/app/login/oauth2/authorize.nl"
    return f"{auth_url}?{urllib.parse.urlencode(params)}"
```

### Step 3: User Authorization
1. User opens the generated URL in their browser
2. Logs into NetSuite
3. Authorizes the application
4. NetSuite redirects to `http://localhost:8080/callback` with authorization code

### Step 4: Token Exchange
Exchange the authorization code for access and refresh tokens:

```python
def exchange_authorization_code(code, client_id, client_secret):
    """Exchange authorization code for tokens"""
    token_url = "https://4708559.restlets.api.netsuite.com/rest/platform/v1/oauth/token"
    
    payload = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': 'http://localhost:8080/callback',
        'client_id': client_id,
        'client_secret': client_secret
    }
    
    response = requests.post(token_url, data=payload)
    tokens = response.json()
    
    return {
        'access_token': tokens['access_token'],
        'refresh_token': tokens['refresh_token'],
        'expires_in': tokens['expires_in'],
        'token_type': tokens['token_type']
    }
```

### Step 5: Token Refresh
Refresh tokens when they expire:

```python
def refresh_access_token(refresh_token, client_id, client_secret):
    """Refresh an expired access token"""
    token_url = "https://4708559.restlets.api.netsuite.com/rest/platform/v1/oauth/token"
    
    payload = {
        'grant_type': 'refresh_token',
        'refresh_token': refresh_token,
        'client_id': client_id,
        'client_secret': client_secret
    }
    
    response = requests.post(token_url, data=payload)
    tokens = response.json()
    
    return {
        'access_token': tokens['access_token'],
        'refresh_token': tokens.get('refresh_token', refresh_token),
        'expires_in': tokens['expires_in']
    }
```

## API Usage

### Request Headers
All API requests must include:
```http
Authorization: Bearer {access_token}
Content-Type: application/json
Accept: application/json
```

### Common Endpoints

#### Company Information
```http
GET https://4708559.suitetalk.api.netsuite.com/services/rest/config/v1/companyinformation
```

#### Subsidiaries
```http
GET https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/subsidiary
GET https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/subsidiary/{id}
POST https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/subsidiary
PATCH https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/subsidiary/{id}
DELETE https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/subsidiary/{id}
```

#### Customers
```http
GET https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/customer
GET https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/customer/{id}
POST https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/customer
PATCH https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/customer/{id}
DELETE https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/customer/{id}
```

#### Invoices
```http
GET https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/invoice
GET https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/invoice/{id}
POST https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/invoice
PATCH https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/invoice/{id}
```

#### Payments
```http
GET https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/customerPayment
GET https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/customerPayment/{id}
POST https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/customerPayment
```

#### Items (Products/Services)
```http
GET https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/serviceItem
GET https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/nonInventoryItem
POST https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/serviceItem
```

#### Journal Entries
```http
GET https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/journalEntry
POST https://4708559.suitetalk.api.netsuite.com/services/rest/record/v1/journalEntry
```

### Query Parameters
NetSuite supports various query parameters:
- `q`: Search query using NetSuite Query Language
- `limit`: Number of records to return (max 1000)
- `offset`: Starting position for pagination
- `expandSubResources`: Include related data
- `fields`: Specify fields to return

Example:
```http
GET /services/rest/record/v1/customer?q=companyName IS "ACME Corp"&limit=10
```

## Backend Integration Architecture

### Token Management Service
The backend maintains a token management service that:
1. Stores encrypted tokens in Redis/Database
2. Automatically refreshes tokens before expiration
3. Provides token abstraction to other services
4. Handles concurrent token refresh attempts

```typescript
// services/netsuite/token-manager.ts
export class NetSuiteTokenManager {
  private redis: RedisClient;
  private refreshLock: Map<string, Promise<Token>> = new Map();
  
  async getValidToken(): Promise<string> {
    const token = await this.redis.get('netsuite:token');
    
    if (!token || this.isExpiringSoon(token)) {
      return await this.refreshToken();
    }
    
    return token.access_token;
  }
  
  private async refreshToken(): Promise<string> {
    // Prevent concurrent refresh attempts
    if (this.refreshLock.has('main')) {
      return await this.refreshLock.get('main');
    }
    
    const refreshPromise = this.performRefresh();
    this.refreshLock.set('main', refreshPromise);
    
    try {
      const newToken = await refreshPromise;
      return newToken.access_token;
    } finally {
      this.refreshLock.delete('main');
    }
  }
  
  private async performRefresh(): Promise<Token> {
    const refreshToken = await this.redis.get('netsuite:refresh_token');
    const newTokens = await this.oauthClient.refresh(refreshToken);
    
    await this.redis.setex(
      'netsuite:token',
      newTokens.expires_in - 300, // Refresh 5 minutes early
      JSON.stringify(newTokens)
    );
    
    if (newTokens.refresh_token) {
      await this.redis.set('netsuite:refresh_token', newTokens.refresh_token);
    }
    
    return newTokens;
  }
}
```

### Data Synchronization

#### Customer Sync
Synchronize WARP customers with NetSuite:
```typescript
export class NetSuiteCustomerSync {
  async syncCustomer(warpCustomer: Customer): Promise<void> {
    const nsCustomer = this.mapToNetSuiteFormat(warpCustomer);
    
    if (warpCustomer.netsuite_id) {
      await this.updateCustomer(warpCustomer.netsuite_id, nsCustomer);
    } else {
      const created = await this.createCustomer(nsCustomer);
      await this.linkCustomer(warpCustomer.id, created.id);
    }
  }
  
  private mapToNetSuiteFormat(customer: Customer) {
    return {
      companyName: customer.company_name,
      email: customer.billing_email,
      phone: customer.phone,
      subsidiary: { id: NETSUITE_SUBSIDIARY_ID },
      terms: { id: NETSUITE_PAYMENT_TERMS_ID },
      customFields: {
        custentity_warp_customer_id: customer.id,
        custentity_warp_account_status: customer.status
      }
    };
  }
}
```

#### Invoice Sync
Create invoices in NetSuite from WARP billing data:
```typescript
export class NetSuiteInvoiceSync {
  async createInvoice(billing: BillingData): Promise<void> {
    const invoice = {
      entity: { id: billing.netsuite_customer_id },
      tranDate: billing.period_end,
      dueDate: billing.due_date,
      subsidiary: { id: NETSUITE_SUBSIDIARY_ID },
      items: this.mapBillingItems(billing.line_items),
      customFields: {
        custbody_warp_invoice_id: billing.invoice_id,
        custbody_warp_period: billing.period
      }
    };
    
    const created = await this.netsuiteClient.createInvoice(invoice);
    await this.updateInvoiceReference(billing.invoice_id, created.id);
  }
  
  private mapBillingItems(items: LineItem[]) {
    return items.map(item => ({
      item: { id: this.getNetSuiteItemId(item.type) },
      quantity: item.quantity,
      rate: item.rate,
      amount: item.amount,
      description: item.description
    }));
  }
}
```

## Security Considerations

### Token Storage
- Store tokens encrypted at rest using AES-256
- Use separate encryption keys for access and refresh tokens
- Implement key rotation policy
- Never log or expose tokens

### API Access Control
- Restrict NetSuite API access to backend services only
- Implement rate limiting to prevent abuse
- Use service accounts with minimal required permissions
- Audit all API access

### Environment Variables
```env
# NetSuite OAuth Configuration
NETSUITE_ACCOUNT_ID=4708559
NETSUITE_CLIENT_ID=<client_id>
NETSUITE_CLIENT_SECRET=<encrypted_secret>
NETSUITE_REDIRECT_URI=https://api.ringer.tel/v1/netsuite/callback

# NetSuite API Configuration
NETSUITE_BASE_URL=https://4708559.suitetalk.api.netsuite.com/services/rest
NETSUITE_AUTH_URL=https://4708559.app.netsuite.com/app/login/oauth2/authorize.nl
NETSUITE_TOKEN_URL=https://4708559.restlets.api.netsuite.com/rest/platform/v1/oauth/token

# NetSuite Entity IDs
NETSUITE_SUBSIDIARY_ID=1
NETSUITE_PAYMENT_TERMS_ID=5
NETSUITE_SERVICE_ITEM_ID=100
```

## Error Handling

### Common Error Codes
- `401 Unauthorized`: Token expired or invalid
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource doesn't exist
- `429 Too Many Requests`: Rate limit exceeded
- `503 Service Unavailable`: NetSuite maintenance

### Retry Strategy
```typescript
export class NetSuiteClient {
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (error.status === 401 && attempt < maxRetries) {
          await this.tokenManager.forceRefresh();
          continue;
        }
        
        if (error.status === 429 && attempt < maxRetries) {
          const retryAfter = error.headers['retry-after'] || 60;
          await this.delay(retryAfter * 1000);
          continue;
        }
        
        if (error.status >= 500 && attempt < maxRetries) {
          await this.delay(Math.pow(2, attempt) * 1000);
          continue;
        }
        
        throw error;
      }
    }
  }
}
```

## Testing

### Mock Server Setup
For development and testing, use a mock NetSuite server:
```typescript
// test/mocks/netsuite-mock-server.ts
export class NetSuiteMockServer {
  setupHandlers() {
    return [
      rest.post('*/oauth/token', (req, res, ctx) => {
        return res(
          ctx.json({
            access_token: 'mock_access_token',
            refresh_token: 'mock_refresh_token',
            expires_in: 3600,
            token_type: 'Bearer'
          })
        );
      }),
      
      rest.get('*/record/v1/customer', (req, res, ctx) => {
        return res(
          ctx.json({
            items: mockCustomers,
            count: mockCustomers.length
          })
        );
      })
    ];
  }
}
```

### Integration Tests
```typescript
describe('NetSuite Integration', () => {
  it('should refresh token when expired', async () => {
    const expiredToken = createExpiredToken();
    await redis.set('netsuite:token', expiredToken);
    
    const client = new NetSuiteClient();
    const customers = await client.getCustomers();
    
    expect(customers).toBeDefined();
    expect(mockRefreshEndpoint).toHaveBeenCalled();
  });
  
  it('should sync customer to NetSuite', async () => {
    const customer = createTestCustomer();
    const sync = new NetSuiteCustomerSync();
    
    await sync.syncCustomer(customer);
    
    const nsCustomer = await client.getCustomer(customer.netsuite_id);
    expect(nsCustomer.companyName).toBe(customer.company_name);
  });
});
```

## Monitoring & Alerts

### Key Metrics
- Token refresh success/failure rate
- API request latency
- Sync operation success rate
- Rate limit utilization

### Alert Conditions
- Token refresh failures > 3 consecutive
- API error rate > 5%
- Sync backlog > 100 records
- Rate limit usage > 80%

## Troubleshooting

### Token Refresh Issues
1. Verify client credentials are correct
2. Check if refresh token is still valid
3. Ensure redirect URI matches configuration
4. Verify NetSuite user has required permissions

### API Access Issues
1. Confirm account ID in URL is correct
2. Verify OAuth scope includes required permissions
3. Check if NetSuite user has role with API access
4. Ensure IP is not blocked by NetSuite

### Data Sync Issues
1. Verify field mappings are correct
2. Check for required fields in NetSuite
3. Ensure subsidiary and other references exist
4. Review NetSuite audit logs for details

## Migration Plan

### Phase 1: Initial Setup (Week 1)
- [ ] Configure OAuth application in NetSuite
- [ ] Implement token management service
- [ ] Create initial token acquisition script
- [ ] Test API connectivity

### Phase 2: Customer Sync (Week 2)
- [ ] Map WARP customer fields to NetSuite
- [ ] Implement bi-directional sync
- [ ] Handle conflict resolution
- [ ] Test with pilot customers

### Phase 3: Billing Integration (Week 3-4)
- [ ] Map billing items to NetSuite
- [ ] Implement invoice creation
- [ ] Sync payment records
- [ ] Reconciliation reports

### Phase 4: Production Deployment (Week 5)
- [ ] Deploy to staging environment
- [ ] Full data migration
- [ ] User acceptance testing
- [ ] Production rollout

## SuiteCloud SDK Integration

### Available Tools
The SuiteCloud SDK (located at `/docs/api_docs/netsuite-suitecloud-sdk-master/`) provides additional tools for NetSuite development:

1. **SuiteCloud CLI for Node.js**
   - Command-line interface for NetSuite development
   - Located in `/packages/node-cli/`
   - Useful for automating NetSuite operations

2. **Unit Testing Framework**
   - Located in `/packages/unit-testing/`
   - Provides stubs for testing NetSuite scripts locally
   - Includes mock implementations of NetSuite modules

3. **TypeScript Type Definitions**
   - Located in `/packages/uif-types/`
   - Provides type definitions for NetSuite UI Framework

### SDK Usage for WARP Integration

#### Using SDK Stubs for Testing
```javascript
// test/netsuite-integration.test.js
const recordStub = require('./netsuite-suitecloud-sdk-master/packages/unit-testing/stubs/record/record');
const searchStub = require('./netsuite-suitecloud-sdk-master/packages/unit-testing/stubs/search/search');

describe('NetSuite Customer Sync', () => {
  it('should map WARP customer to NetSuite format', () => {
    const mockCustomer = recordStub.create({
      type: recordStub.Type.CUSTOMER
    });
    
    // Test field mappings
    mockCustomer.setValue({
      fieldId: 'companyname',
      value: 'Test Company'
    });
    
    expect(mockCustomer.getValue('companyname')).toBe('Test Company');
  });
});
```

#### Using CLI for Automation
```bash
# Install SuiteCloud CLI
npm install -g @oracle/suitecloud-cli

# Authenticate with NetSuite
suitecloud account:setup

# Deploy custom scripts
suitecloud project:deploy

# Import objects from NetSuite
suitecloud object:import --type customer
```

### Custom Script Development

For advanced integrations, you may need to deploy custom scripts to NetSuite:

#### RESTlet for Custom Operations
```javascript
/**
 * @NApiVersion 2.x
 * @NScriptType RESTlet
 */
define(['N/record', 'N/search'], function(record, search) {
    
    function doGet(requestParams) {
        // Custom logic for WARP integration
        var customerId = requestParams.warp_customer_id;
        
        var customerSearch = search.create({
            type: search.Type.CUSTOMER,
            filters: [
                ['custentity_warp_customer_id', 'is', customerId]
            ]
        });
        
        var results = customerSearch.run().getRange({
            start: 0,
            end: 1
        });
        
        return results[0] || null;
    }
    
    function doPost(requestBody) {
        // Webhook handler for WARP events
        var eventType = requestBody.event;
        var payload = requestBody.data;
        
        switch(eventType) {
            case 'customer.created':
                return createCustomer(payload);
            case 'invoice.generated':
                return createInvoice(payload);
            default:
                return { error: 'Unknown event type' };
        }
    }
    
    return {
        get: doGet,
        post: doPost
    };
});
```

## Support & Resources

### Documentation
- [NetSuite REST API Documentation](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/book_1559132836.html)
- [OAuth 2.0 Setup Guide](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_157771733782.html)
- [SuiteCloud SDK Documentation](https://github.com/oracle/netsuite-suitecloud-sdk)
- [SuiteCloud SDK Release Notes](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_1558730192.html)

### SDK Resources
- **Local SDK Path**: `/docs/api_docs/netsuite-suitecloud-sdk-master/`
- **NPM Packages**:
  - `@oracle/suitecloud-cli` - CLI tools
  - `@oracle/suitecloud-unit-testing` - Testing framework
  - `@oracle/netsuite-uif-types` - TypeScript definitions

### Contacts
- NetSuite Support: support@netsuite.com
- Account Manager: [Contact Information]
- Technical Support Case Portal: https://4708559.app.netsuite.com

---
*Last Updated: January 2025*
