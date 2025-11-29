# Somos Toll-Free Registry Integration Guide

## Overview
This document provides the complete specification for integrating Somos toll-free number management with the WARP platform. Somos provides RespOrg services for toll-free number provisioning, routing control, and SMS enablement.

## Authentication Architecture

### OAuth Flow Overview
Unlike NetSuite's browser-based OAuth, Somos uses a **programmatic OAuth flow** that can be fully automated:

1. **Session Open**: Exchange username/password for OAuth credentials
2. **Token Exchange**: Use credentials to get access token
3. **API Calls**: Use bearer token for all API requests
4. **Auto-Refresh**: Refresh tokens before expiration

### No Manual Intervention Required
✅ **Fully Automated**: The entire authentication flow can be handled by the backend without human interaction.

## Authentication Configuration

### Environment URLs
```typescript
const SOMOS_CONFIG = {
  production: {
    base: 'https://api-tfnregistry.somos.com',
    sessionUrl: 'https://api-tfnregistry.somos.com/v3/ip/sec/session',
    tokenUrl: 'https://api-tfnregistry.somos.com/token'
  },
  sandbox: {
    base: 'https://sandbox-api-tfnregistry.somos.com',
    sessionUrl: 'https://sandbox-api-tfnregistry.somos.com/v3/ip/sec/session',
    tokenUrl: 'https://sandbox-api-tfnregistry.somos.com/token'
  }
};
```

### Required Credentials (Store in Google Secret Manager)
```yaml
somos-credentials:
  username: ${SOMOS_API_USERNAME}
  password: ${SOMOS_API_PASSWORD}
  environment: production  # or sandbox
```

## Authentication Implementation

### Step 1: Session Opening (Get Client Credentials)

```typescript
interface SessionOpenRequest {
  usrName: string;
  password: string;
  withPerm: boolean;
  forceFlag?: 'Y' | 'N';
  sessOverrideKey?: string;
}

interface SessionOpenResponse {
  clientKey: string;
  clientSecret: string;
  refreshToken: string;
  oauthToken: string;
  errList?: Array<{
    errCode: string;
    errMsg: string;
  }>;
  sessOverrideKey?: string;
}

async function openSession(): Promise<SessionOpenResponse> {
  const response = await fetch(`${SOMOS_BASE}/v3/ip/sec/session/open`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      usrName: username,
      password: password,
      withPerm: false
    })
  });

  const data = await response.json();
  
  // Handle already logged in error
  if (data.errList?.[0]?.errCode === '701003' && data.sessOverrideKey) {
    return reconnectSession(data.sessOverrideKey);
  }
  
  return data;
}
```

### Step 2: Get Access Token

```typescript
async function getAccessToken(
  clientKey: string,
  clientSecret: string,
  refreshToken: string
): Promise<TokenResponse> {
  const auth = Buffer.from(`${clientKey}:${clientSecret}`).toString('base64');
  
  const response = await fetch(`${SOMOS_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`
    },
    body: `grant_type=refresh_token&refresh_token=${refreshToken}`
  });
  
  return response.json();
}
```

### Step 3: Token Management Service

```typescript
export class SomosTokenManager {
  private clientKey: string | null = null;
  private clientSecret: string | null = null;
  private refreshToken: string | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private refreshLock: Promise<void> | null = null;

  async initialize(): Promise<void> {
    // Get credentials from Secret Manager
    const credentials = await secretManager.getSecret('somos-credentials');
    
    // Open session to get OAuth credentials
    const session = await this.openSessionWithRetry(
      credentials.username,
      credentials.password
    );
    
    this.clientKey = session.clientKey;
    this.clientSecret = session.clientSecret;
    this.refreshToken = session.refreshToken;
    
    // Get initial access token
    await this.refreshAccessToken();
  }

  async getValidToken(): Promise<string> {
    const now = Date.now() / 1000;
    const bufferTime = 300; // 5 minutes
    
    if (!this.accessToken || now > (this.tokenExpiry - bufferTime)) {
      await this.refreshAccessToken();
    }
    
    return this.accessToken!;
  }

  private async refreshAccessToken(): Promise<void> {
    // Prevent concurrent refresh attempts
    if (this.refreshLock) {
      await this.refreshLock;
      return;
    }

    this.refreshLock = this.performRefresh();
    try {
      await this.refreshLock;
    } finally {
      this.refreshLock = null;
    }
  }

  private async performRefresh(): Promise<void> {
    const tokens = await getAccessToken(
      this.clientKey!,
      this.clientSecret!,
      this.refreshToken!
    );
    
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token || this.refreshToken;
    this.tokenExpiry = Date.now() / 1000 + tokens.expires_in;
    
    // Store refresh token in Secret Manager for persistence
    await secretManager.updateSecret('somos-refresh-token', {
      refreshToken: this.refreshToken,
      clientKey: this.clientKey,
      clientSecret: this.clientSecret
    });
  }

  private async openSessionWithRetry(
    username: string,
    password: string
  ): Promise<SessionOpenResponse> {
    try {
      // First attempt
      return await openSession(username, password);
    } catch (error) {
      // Retry with force flag
      return await openSession(username, password, { forceFlag: 'Y' });
    }
  }
}
```

## Error Recovery Patterns

### 1. Already Logged In (Error 701003)
```typescript
if (error.code === '701003' && error.sessOverrideKey) {
  // Reconnect using the override key
  const session = await reconnectSession(error.sessOverrideKey);
  return session;
}
```

### 2. Authentication Failures
```typescript
async function authenticateWithRetry() {
  try {
    // Attempt normal authentication
    return await openSession(username, password);
  } catch (error) {
    // Force logout existing sessions
    await openSession(username, password, { forceFlag: 'Y' });
  }
}
```

### 3. Token Expiration
```typescript
// Automatic refresh 5 minutes before expiry
if (Date.now() / 1000 > (tokenExpiry - 300)) {
  await refreshAccessToken();
}
```

## API Client Implementation

### File: `warp/services/somos/somos-client.ts`
```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

export class SomosApiClient {
  private tokenManager: SomosTokenManager;
  private baseUrl: string;

  constructor(production: boolean = true) {
    this.baseUrl = production
      ? 'https://api-tfnregistry.somos.com'
      : 'https://sandbox-api-tfnregistry.somos.com';
    this.tokenManager = new SomosTokenManager();
  }

  async initialize(): Promise<void> {
    await this.tokenManager.initialize();
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.tokenManager.getValidToken();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new SomosApiError(response.status, await response.text());
    }

    return response.json();
  }

  // ==================== RespOrg Management ====================
  async getEntityROIDs(entityId: string): Promise<RespOrgInfo[]> {
    const response = await this.request<GetEntityResponse>(
      `/v3/ip/org/resporg/ent/${entityId}`
    );
    
    return response.associatedRespOrgs
      .filter(org => org.status === 'ACTIVE')
      .map(org => ({
        respOrgId: org.respOrgId,
        name: org.name,
        status: org.status
      }));
  }

  // ==================== Number Management ====================
  async searchNumbers(params: {
    npa?: string;
    pattern?: string;
    quantity: number;
    consecutive?: boolean;
  }): Promise<TollFreeNumber[]> {
    return this.request('/v3/ip/num/tfn/search', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async reserveNumber(tfn: string, respOrgId: string): Promise<ReservationResponse> {
    return this.request('/v3/ip/num/tfn/reserve', {
      method: 'POST',
      body: JSON.stringify({
        tfn,
        respOrgId,
        reserveDuration: 30 // days
      })
    });
  }

  async provisionNumber(
    tfn: string,
    respOrgId: string,
    routing: RoutingConfig
  ): Promise<ProvisionResponse> {
    return this.request('/v3/ip/num/tfn/provision', {
      method: 'POST',
      body: JSON.stringify({
        tfn,
        respOrgId,
        routingData: routing
      })
    });
  }

  async updateRouting(tfn: string, routing: RoutingConfig): Promise<void> {
    await this.request(`/v3/ip/num/tfn/${tfn}/routing`, {
      method: 'PUT',
      body: JSON.stringify(routing)
    });
  }

  // ==================== Text Enable ====================
  async enableSMS(tfn: string, options: SMSEnableOptions): Promise<void> {
    await this.request('/v3/ip/num/tfn/sms/enable', {
      method: 'POST',
      body: JSON.stringify({
        tfn,
        ...options
      })
    });
  }

  async getSMSStatus(tfn: string): Promise<SMSStatus> {
    return this.request(`/v3/ip/num/tfn/${tfn}/sms/status`);
  }

  // ==================== Bulk Operations ====================
  async bulkReserveNumbers(
    numbers: string[],
    respOrgId: string
  ): Promise<BulkReservationResponse> {
    return this.request('/v3/ip/num/tfn/bulk/reserve', {
      method: 'POST',
      body: JSON.stringify({
        tfns: numbers,
        respOrgId
      })
    });
  }

  async bulkProvisionNumbers(
    provisions: Array<{
      tfn: string;
      respOrgId: string;
      routing: RoutingConfig;
    }>
  ): Promise<BulkProvisionResponse> {
    return this.request('/v3/ip/num/tfn/bulk/provision', {
      method: 'POST',
      body: JSON.stringify({ provisions })
    });
  }

  // ==================== Session Management ====================
  async closeSession(): Promise<void> {
    const token = await this.tokenManager.getValidToken();
    
    await fetch(`${this.baseUrl}/v3/ip/sec/session/close`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({})
    });
  }
}

// Type definitions
interface RoutingConfig {
  primary: {
    type: 'sip' | 'pstn';
    destination: string;
  };
  disaster?: {
    type: 'sip' | 'pstn';
    destination: string;
  };
  timeOfDay?: Array<{
    startTime: string;
    endTime: string;
    destination: string;
  }>;
  percentageRouting?: Array<{
    percentage: number;
    destination: string;
  }>;
}

interface SMSEnableOptions {
  webhookUrl?: string;
  capabilities: {
    sms: boolean;
    mms: boolean;
  };
}

// Export singleton instance
export const somosClient = new SomosApiClient(
  process.env.NODE_ENV === 'production'
);
```

## Integration with WARP Platform

### Backend Service Implementation
```typescript
// warp/services/somos/somos-service.ts
export class SomosService {
  private client: SomosApiClient;
  private cache: NodeCache;

  constructor() {
    this.client = somosClient;
    this.cache = new NodeCache({ stdTTL: 300 }); // 5 min cache
  }

  async initialize(): Promise<void> {
    // Initialize on service startup
    await this.client.initialize();
    
    // Schedule token refresh check every minute
    setInterval(() => {
      this.client.tokenManager.ensureValidToken();
    }, 60000);
  }

  async searchTollFreeNumbers(criteria: SearchCriteria): Promise<TollFreeNumber[]> {
    const cacheKey = `search:${JSON.stringify(criteria)}`;
    
    // Check cache
    const cached = this.cache.get<TollFreeNumber[]>(cacheKey);
    if (cached) return cached;
    
    // Search for numbers
    const numbers = await this.client.searchNumbers({
      npa: criteria.areaCode,
      pattern: criteria.vanityPattern,
      quantity: criteria.quantity || 10,
      consecutive: criteria.consecutive
    });
    
    // Cache results
    this.cache.set(cacheKey, numbers);
    
    return numbers;
  }

  async provisionTollFreeNumber(
    tfn: string,
    customerId: string
  ): Promise<ProvisionResult> {
    // Get customer's RespOrg ID from database
    const customer = await this.db.customer.findUnique({
      where: { id: customerId }
    });
    
    if (!customer.respOrgId) {
      throw new Error('Customer does not have a RespOrg ID assigned');
    }
    
    // Reserve the number first
    await this.client.reserveNumber(tfn, customer.respOrgId);
    
    // Configure routing
    const routing: RoutingConfig = {
      primary: {
        type: 'sip',
        destination: `sip:${tfn}@trunks.warp.ringer.tel`
      },
      disaster: {
        type: 'pstn',
        destination: customer.disasterRecoveryNumber || '+13035551234'
      }
    };
    
    // Provision the number
    const result = await this.client.provisionNumber(
      tfn,
      customer.respOrgId,
      routing
    );
    
    // Enable SMS if requested
    if (customer.smsEnabled) {
      await this.client.enableSMS(tfn, {
        webhookUrl: `https://api.ringer.tel/v1/webhooks/somos/sms/${tfn}`,
        capabilities: {
          sms: true,
          mms: true
        }
      });
    }
    
    // Store in database
    await this.db.tollFreeNumber.create({
      data: {
        number: tfn,
        customerId,
        respOrgId: customer.respOrgId,
        status: 'active',
        smsEnabled: customer.smsEnabled,
        routingConfig: routing
      }
    });
    
    return result;
  }
}
```

## Hive-Mind Integration

### Agent 3 Responsibilities
Since Somos authentication is **fully programmatic**, Agent 3 can implement this without any manual setup:

```typescript
// No manual OAuth flow needed - Agent 3 can implement directly
class SomosIntegration implements ProviderModule {
  async setup(): Promise<void> {
    // 1. Read credentials from environment/secrets
    const creds = await this.getCredentials();
    
    // 2. Initialize client with automatic auth
    await somosClient.initialize();
    
    // 3. Test connection
    const testResult = await this.testConnection();
    
    // 4. Ready to use - no manual intervention needed!
    logger.info('Somos integration ready');
  }
}
```

### Key Differences from NetSuite
| Aspect | NetSuite | Somos |
|--------|----------|-------|
| Auth Type | Browser OAuth 2.0 | Programmatic OAuth |
| Manual Setup | Required (once) | Not Required |
| Token Refresh | Automatic | Automatic |
| Hive-Mind Ready | Needs pre-setup | Fully Automated |

## Environment Variables
```env
# Somos Configuration (for Google Secret Manager)
SOMOS_API_USERNAME=your_username
SOMOS_API_PASSWORD=your_password
SOMOS_ENVIRONMENT=production  # or sandbox

# RespOrg Configuration
DEFAULT_RESPORG_ID=WARP1  # Your assigned RespOrg ID
DISASTER_RECOVERY_NUMBER=+13035551234
```

## API Endpoints for WARP Platform

### Toll-Free Number Management
- `GET /api/v1/numbers/tollfree/search` - Search available toll-free numbers
- `POST /api/v1/numbers/tollfree/reserve` - Reserve toll-free numbers
- `POST /api/v1/numbers/tollfree/provision` - Provision reserved numbers
- `PUT /api/v1/numbers/tollfree/{tfn}/routing` - Update routing
- `POST /api/v1/numbers/tollfree/{tfn}/sms/enable` - Enable SMS
- `GET /api/v1/numbers/tollfree/{tfn}/status` - Get number status

### RespOrg Operations
- `GET /api/v1/resporg/entities` - List RespOrg entities
- `GET /api/v1/resporg/entities/{id}/roids` - Get entity ROIDs
- `POST /api/v1/resporg/transfer` - Initiate RespOrg transfer

## Testing Strategy

### Mock Implementation for Development
```typescript
class MockSomosClient implements SomosApiClient {
  async searchNumbers(params: any): Promise<TollFreeNumber[]> {
    // Return mock toll-free numbers for testing
    return [
      { tfn: '8332345678', status: 'available' },
      { tfn: '8443456789', status: 'available' },
      { tfn: '8554567890', status: 'available' }
    ];
  }
  
  async provisionNumber(tfn: string): Promise<any> {
    // Mock successful provisioning
    return {
      success: true,
      tfn,
      status: 'active',
      provisionedAt: new Date()
    };
  }
}

// Use mock in development
export const somosClient = process.env.USE_MOCK_SOMOS
  ? new MockSomosClient()
  : new SomosApiClient();
```

## Monitoring & Alerts

### Key Metrics
- Authentication success/failure rate
- Token refresh frequency
- API request latency
- Number provisioning success rate
- SMS enablement success rate

### Alert Conditions
- Authentication failures > 3 consecutive
- Token refresh failures
- API error rate > 5%
- Provisioning failures

## Troubleshooting

### Common Issues

1. **Session Already Active (701003)**
   - Solution: Use `forceFlag: 'Y'` or `sessOverrideKey`
   - Automatic retry logic handles this

2. **Token Expiration**
   - Solution: Automatic refresh 5 minutes before expiry
   - Token manager handles this transparently

3. **Rate Limiting**
   - Solution: Implement exponential backoff
   - Cache frequently accessed data

4. **Network Timeouts**
   - Solution: Retry with exponential backoff
   - Circuit breaker pattern for failures

## Migration from Existing System

If migrating from another RespOrg:
1. Initiate RespOrg change request via Somos
2. Customer authorization required (LOA)
3. 5-7 business day transfer process
4. Update routing after transfer completes
5. Enable SMS on transferred numbers

## Compliance Requirements

### RespOrg Certification
- FCC Form 499 Filer status required
- $5,000 security deposit
- 24x7 support capability
- Quarterly regulatory fee payments

### Text-Enable Advantages
- No TCR registration required (unlike 10DLC)
- Higher default throughput (3 msgs/second)
- Better deliverability rates
- National presence and trust

## Support & Resources

### Documentation
- [Somos API Documentation](https://somos.com/api/)
- [TSS User Guide](https://somos.com/tss-guide/)
- [RespOrg Handbook](https://somos.com/resporg/)

### Existing Implementation
- **Python Reference**: `/docs/api_docs/somos_api_example.py`
- Fully working implementation with error handling
- Can be used as reference for TypeScript port

### Support Contacts
- Somos API Support: api-support@somos.com
- RespOrg Support: resporg@somos.com
- Technical Issues: 1-844-HEY-SOMOS

---
*Last Updated: January 2025*
