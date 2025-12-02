# TinComply EIN/Tax ID Verification Integration

**Date**: 2025-12-02
**Status**: ✅ Production Ready
**API Provider**: [TinComply](https://www.tincomply.com)

---

## Overview

This guide documents the integration of TinComply's EIN/Tax ID verification service into WARP's API Gateway. TinComply provides IRS-verified business information lookup, enabling automatic validation and auto-fill of company details during brand registration.

### Key Features

- ✅ **EIN Lookup**: Retrieve company information from IRS records
- ✅ **TIN-Name Matching**: Verify that a Tax ID matches a company name
- ✅ **Auto-Fill**: Automatically populate brand registration forms
- ✅ **Validation**: Client-side and server-side EIN format validation
- ✅ **Security**: API key stored in Kubernetes secrets, never exposed to frontend

---

## Architecture

### Request Flow

```
Frontend (Customer Portal)
    ↓
    | 1. User enters EIN and clicks "Verify EIN"
    ↓
WARP API Gateway (/v1/tincomply/lookup-ein)
    ↓
    | 2. Validates EIN format
    | 3. Calls TinComply API with API key
    ↓
TinComply API (validate/company-name-lookup-by-ein)
    ↓
    | 4. Queries IRS database
    | 5. Returns company information
    ↓
WARP API Gateway
    ↓
    | 6. Returns normalized response
    ↓
Frontend
    ↓
    | 7. Auto-fills form fields
    | 8. Displays verification status
```

### Security Model

- **API Key Storage**: Kubernetes Secret (`TINCOMPLY_API_KEY`)
- **Frontend Access**: NO direct access to TinComply API
- **Backend Proxy**: All requests proxied through WARP API Gateway
- **Authentication**: JWT + Gatekeeper middleware on all endpoints

---

## API Endpoints

### 1. Lookup Company by EIN

**Endpoint**: `GET /v1/tincomply/lookup-ein`

**Description**: Retrieve company information from IRS records using EIN.

**Query Parameters**:
- `ein` (string, required): 9-digit EIN with or without hyphen (e.g., "123456789" or "12-3456789")

**Response**:
```json
{
  "success": true,
  "data": {
    "request_id": "req_abc123",
    "service_type": "company-name-lookup-by-ein",
    "status": "completed",
    "completed_at": "2025-12-02T10:30:00Z",
    "result": {
      "ein": "123456789",
      "company_name": "ACME Corp",
      "legal_name": "ACME Corporation",
      "verified": true,
      "match_score": 98.5,
      "entity_type": "Corporation",
      "incorporated_at": "2020-01-15",
      "state": "NY",
      "status": "Active"
    }
  }
}
```

**Error Response** (400 Bad Request):
```json
{
  "success": false,
  "error": "EIN_REQUIRED",
  "message": "EIN parameter is required"
}
```

**cURL Example**:
```bash
curl -X GET "https://api.rns.ringer.tel/v1/tincomply/lookup-ein?ein=123456789" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 2. Verify TIN and Company Name

**Endpoint**: `POST /v1/tincomply/verify-tin-name`

**Description**: Verify that a Tax ID matches the provided company name using IRS TIN-Name matching.

**Request Body**:
```json
{
  "tin": "123456789",
  "company_name": "ACME Corporation"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "request_id": "req_xyz789",
    "service_type": "irs-tin-name-matching",
    "status": "completed",
    "completed_at": "2025-12-02T10:35:00Z",
    "result": {
      "tin": "123456789",
      "company_name": "ACME Corporation",
      "matched": true,
      "match_score": 95.0,
      "irs_verified": true,
      "exact_match": true,
      "fuzzy_match": false,
      "confidence": "high",
      "match_details": "Exact match found in IRS records"
    }
  }
}
```

**cURL Example**:
```bash
curl -X POST "https://api.rns.ringer.tel/v1/tincomply/verify-tin-name" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tin": "123456789",
    "company_name": "ACME Corporation"
  }'
```

---

### 3. Lookup Company Details

**Endpoint**: `POST /v1/tincomply/lookup-company-details`

**Description**: Retrieve detailed company information using company name and optional address.

**Request Body**:
```json
{
  "company_name": "ACME Corporation",
  "street": "123 Main St",
  "city": "New York",
  "state": "NY",
  "zip_code": "10001"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "request_id": "req_def456",
    "service_type": "company-details-lookup",
    "status": "completed",
    "result": {
      "company_name": "ACME Corporation",
      "legal_name": "ACME Corp LLC",
      "ein": "123456789",
      "entity_type": "LLC",
      "status": "Active",
      "street": "123 Main Street",
      "city": "New York",
      "state": "NY",
      "zip_code": "10001",
      "phone": "+15551234567",
      "website": "https://acme.com",
      "industry": "Technology",
      "match_score": 92.0
    }
  }
}
```

---

### 4. Validate EIN Format

**Endpoint**: `GET /v1/tincomply/validate-ein-format`

**Description**: Client-side EIN format validation without calling external API.

**Query Parameters**:
- `ein` (string, required): EIN to validate

**Response**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "formatted": "12-3456789",
    "message": "EIN format is valid"
  }
}
```

**cURL Example**:
```bash
curl -X GET "https://api.rns.ringer.tel/v1/tincomply/validate-ein-format?ein=123456789" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Frontend Integration

### React Hook: `useTinComply()`

**Location**: `apps/customer-portal/src/hooks/useTinComply.ts`

**Usage Example**:
```typescript
import { useTinComply } from "@/hooks/useTinComply";

function BrandForm() {
  const { lookupEIN, loading, error } = useTinComply();

  const handleVerify = async () => {
    try {
      const result = await lookupEIN("123456789");

      if (result.result?.verified) {
        // Auto-fill form fields
        setLegalName(result.result.legal_name);
        setCompanyName(result.result.company_name);
        setState(result.result.state);
      }
    } catch (err) {
      console.error("EIN verification failed", err);
    }
  };

  return (
    <Button onClick={handleVerify} disabled={loading}>
      {loading ? "Verifying..." : "Verify EIN"}
    </Button>
  );
}
```

### Available Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `lookupEIN()` | Lookup company by EIN | `ein: string` |
| `verifyTINName()` | Verify TIN matches company name | `tin: string, companyName: string` |
| `validateEINFormat()` | Validate EIN format (no API call) | `ein: string` |
| `formatEIN()` | Format EIN to XX-XXXXXXX | `ein: string` |

---

## Backend Implementation

### File Structure

```
services/api-gateway/internal/tincomply/
├── client.go          # HTTP client with retry logic
├── types.go           # Request/response types
├── ein.go             # EIN-specific operations
└── README.md          # Internal documentation

services/api-gateway/internal/handlers/
└── tincomply.go       # API route handlers

services/api-gateway/cmd/server/main.go
└── TinComply initialization and route registration
```

### Client Initialization

```go
// Initialize TinComply client
tincomplyAPIKey := os.Getenv("TINCOMPLY_API_KEY")

if tincomplyAPIKey != "" {
    tincomplyClient := tincomply.NewClient(tincomply.Config{
        APIKey: tincomplyAPIKey,
    })

    tincomplyHandler := handlers.NewTinComplyHandler(tincomplyClient, logger)
    log.Println("✅ TinComply client initialized")
}
```

### Error Handling

The client implements automatic retry logic with exponential backoff:
- **Max Retries**: 3 attempts
- **Backoff**: 1s, 2s, 4s
- **Timeout**: 30 seconds
- **Retry on**: Network errors, 5xx server errors
- **No retry on**: 4xx client errors

---

## Configuration

### Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `TINCOMPLY_API_KEY` | TinComply API key | Yes | `ZEwbt...EN4l` |

### Kubernetes Secrets

**File**: `services/api-gateway/deployments/kubernetes/secrets.yaml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: api-gateway-secrets
  namespace: warp-api
type: Opaque
stringData:
  TINCOMPLY_API_KEY: "ZEwbtopQVG9czM0QYOx84tddlkOlz6PaCtBBOb7Ilb8BFuUSwavXC1MXGSi9EN4l"
```

**Apply Secrets**:
```bash
kubectl apply -f services/api-gateway/deployments/kubernetes/secrets.yaml
```

---

## Deployment

### 1. Build and Deploy Backend

```bash
cd services/api-gateway

# Build Docker image
docker build --platform linux/amd64 \
  -t us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:v1.3.0 \
  -t us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:latest .

# Push to Artifact Registry
docker push us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:v1.3.0
docker push us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:latest

# Apply Kubernetes resources
kubectl apply -f deployments/kubernetes/secrets.yaml
kubectl apply -f deployments/kubernetes/deployment.yaml

# Verify deployment
kubectl rollout status deployment/api-gateway -n warp-api
kubectl logs -n warp-api -l app=api-gateway --tail=50
```

### 2. Deploy Frontend

```bash
cd apps/customer-portal

# Install dependencies
npm install

# Build for production
npm run build

# Deploy to hosting (replace with your hosting command)
# e.g., Vercel, Netlify, or GCP Cloud Storage
```

---

## Testing

### Manual Testing with cURL

**1. Validate EIN Format**:
```bash
curl -X GET "http://localhost:8080/v1/tincomply/validate-ein-format?ein=123456789" \
  -H "Authorization: Bearer YOUR_JWT"
```

**2. Lookup EIN**:
```bash
curl -X GET "http://localhost:8080/v1/tincomply/lookup-ein?ein=123456789" \
  -H "Authorization: Bearer YOUR_JWT"
```

**3. Verify TIN and Name**:
```bash
curl -X POST "http://localhost:8080/v1/tincomply/verify-tin-name" \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "tin": "123456789",
    "company_name": "ACME Corporation"
  }'
```

### Frontend Testing

1. **Start Development Server**:
   ```bash
   cd apps/customer-portal
   npm run dev
   ```

2. **Navigate to Brand Registration**:
   - Login with Google OAuth
   - Go to `/messaging` page
   - Click "Register Brand" button

3. **Test EIN Verification**:
   - Enter EIN: `123456789`
   - Click "Verify EIN" button
   - Observe auto-fill of company information
   - Check toast notifications for verification status

---

## Rate Limits & Quotas

TinComply does not specify rate limits in their public documentation. Monitor usage via:
- API Gateway logs: `kubectl logs -n warp-api -l app=api-gateway | grep tincomply`
- TinComply dashboard: https://www.tincomply.com/dashboard

---

## Cost Considerations

- **Pricing**: Contact TinComply for current pricing
- **Usage Pattern**: Called only on user-initiated "Verify EIN" action
- **Caching**: Consider implementing Redis cache for frequently looked-up EINs
- **Optimization**: Debounce verification button to prevent accidental double-clicks

---

## Troubleshooting

### Error: "TINCOMPLY_API_KEY not set"

**Cause**: API key not configured in Kubernetes secrets

**Fix**:
```bash
# Ensure secret is applied
kubectl apply -f services/api-gateway/deployments/kubernetes/secrets.yaml

# Restart pods to pick up new secret
kubectl rollout restart deployment/api-gateway -n warp-api
```

### Error: "Failed to lookup EIN"

**Possible Causes**:
1. Invalid EIN format (must be 9 digits)
2. TinComply API is down
3. Network connectivity issues
4. API key is invalid or expired

**Debugging**:
```bash
# Check API Gateway logs
kubectl logs -n warp-api -l app=api-gateway --tail=100 | grep -i tincomply

# Verify API key is loaded
kubectl exec -n warp-api deployment/api-gateway -- env | grep TINCOMPLY
```

### Error: "EIN found but not verified"

**Cause**: TinComply found a match but couldn't verify with IRS records

**Resolution**: User should manually verify company information. This is normal for:
- Recently registered businesses (< 30 days)
- Inactive or dissolved companies
- Government entities with special status

---

## Future Enhancements

### Phase 1 (Completed)
- ✅ Basic EIN lookup integration
- ✅ Auto-fill brand registration form
- ✅ Client-side EIN validation
- ✅ Error handling and user feedback

### Phase 2 (Planned)
- [ ] Redis caching for frequently verified EINs (TTL: 7 days)
- [ ] Batch EIN verification for admin bulk imports
- [ ] TIN-Name matching during form submission
- [ ] Confidence score display with color coding
- [ ] Integration with TCR trust score calculation

### Phase 3 (Future)
- [ ] Historical lookup tracking per customer
- [ ] Verification status dashboard
- [ ] Automatic re-verification (quarterly) for expired data
- [ ] Alternative business ID lookups (DUNS, GIIN, LEI)

---

## Security Best Practices

### API Key Management

- ✅ **Never commit** API keys to Git
- ✅ **Rotate keys** quarterly or if compromised
- ✅ **Use secrets manager** (Kubernetes Secrets, GCP Secret Manager)
- ✅ **Restrict access** to secrets with RBAC policies

### Data Privacy

- ✅ **Customer scoping**: Users can only verify EINs for their own brands
- ✅ **Audit logging**: All verification requests logged with user ID
- ✅ **Data retention**: Do not store TinComply responses in database (GDPR)
- ✅ **PII protection**: EINs are sensitive business identifiers

---

## References

- **TinComply API Docs**: https://www.tincomply.com/help-center/api
- **TinComply Dashboard**: https://www.tincomply.com/dashboard
- **TCR Integration Guide**: `/docs/archive/completed-tasks-2025/tcr-integration/TCR_INTEGRATION_COMPLETE.md`
- **Brand Registration Form**: `apps/customer-portal/src/components/forms/BrandRegistrationForm.tsx`
- **TinComply Client**: `services/api-gateway/internal/tincomply/client.go`

---

## Changelog

### v1.0.0 (2025-12-02)

**Initial Release**:
- ✅ TinComply client library with retry logic
- ✅ 4 API endpoints (lookup, verify, validate, details)
- ✅ React hook for frontend integration
- ✅ Brand Registration Form "Verify EIN" button
- ✅ Auto-fill company information on verification
- ✅ Toast notifications for user feedback
- ✅ Kubernetes secrets configuration
- ✅ Production deployment ready

**Files Created**:
- `services/api-gateway/internal/tincomply/client.go`
- `services/api-gateway/internal/tincomply/types.go`
- `services/api-gateway/internal/tincomply/ein.go`
- `services/api-gateway/internal/handlers/tincomply.go`
- `apps/customer-portal/src/hooks/useTinComply.ts`

**Files Modified**:
- `services/api-gateway/cmd/server/main.go`
- `services/api-gateway/deployments/kubernetes/secrets.yaml`
- `services/api-gateway/deployments/kubernetes/deployment.yaml`
- `apps/customer-portal/src/components/forms/BrandRegistrationForm.tsx`

---

**Documentation Author**: Claude Code
**Last Updated**: 2025-12-02
**Status**: ✅ Production Ready
