# WARP Platform API Endpoints

## Base URL
**Production**: `https://api.ringer.tel/v1`
**Staging**: `https://staging-api.ringer.tel/v1`
**Development**: `http://localhost:8080/v1`

## Authentication Methods by Endpoint

- **Portal Endpoints** (`/auth/*`, `/account/*`): Google Identity Platform OAuth2
- **Management APIs** (`/customers/*`, `/trunks/*`, `/billing/*`): JWT with Redis cache
- **Telco Data APIs** (`/telco/*`, `/lrn/*`, `/lerg/*`): API Keys via Cloud Armor
- **Internal** (`/health/*`, `/metrics/*`): No auth (internal only)

## API Documentation
- **OpenAPI Spec**: `/warp/api/openapi.yaml`
- **Interactive Docs**: `https://api.ringer.tel/docs`
- **Swagger UI**: `https://api.ringer.tel/swagger`

## Authentication
All API requests require Bearer token authentication:
```
Authorization: Bearer <token>
```

## Core Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout user
- `GET /auth/profile` - Get user profile

### Customers
- `GET /customers` - List all customers
- `POST /customers` - Create new customer
- `GET /customers/{id}` - Get customer details
- `PUT /customers/{id}` - Update customer
- `DELETE /customers/{id}` - Delete customer

### SIP Trunks
- `GET /customers/{id}/trunks` - List customer trunks
- `POST /customers/{id}/trunks` - Create new trunk
- `GET /trunks/{id}` - Get trunk details
- `PUT /trunks/{id}` - Update trunk configuration
- `DELETE /trunks/{id}` - Delete trunk
- `POST /trunks/{id}/test` - Test trunk connectivity

### Phone Numbers
- `GET /numbers/available` - Search available numbers
- `POST /numbers/order` - Order new numbers
- `GET /numbers` - List owned numbers
- `PUT /numbers/{number}` - Update number settings
- `DELETE /numbers/{number}` - Release number
- `POST /numbers/port` - Initiate number port

### Routing
- `GET /partitions` - List routing partitions
- `POST /partitions` - Create partition
- `PUT /partitions/{id}` - Update partition
- `POST /routing/simulate` - Simulate call routing
- `GET /routing/lcr` - Get LCR results

### CDRs (Call Detail Records)
- `GET /cdrs` - List CDRs with filters
- `GET /cdrs/{id}` - Get specific CDR
- `GET /cdrs/export` - Export CDRs to CSV

### Messaging (SMS/MMS/RCS)
- `POST /messages/sms` - Send SMS
- `POST /messages/mms` - Send MMS
- `POST /messages/rcs` - Send RCS message
- `POST /messages/bulk` - Bulk messaging
- `GET /messages/{id}` - Get message status

### Billing
- `GET /usage` - Get current usage
- `GET /invoices` - List invoices
- `GET /invoices/{id}` - Get invoice details
- `GET /rates` - Get rate deck
- `POST /payments` - Make payment

### Webhooks
- `GET /webhooks` - List webhook subscriptions
- `POST /webhooks` - Create webhook subscription
- `PUT /webhooks/{id}` - Update webhook
- `DELETE /webhooks/{id}` - Delete webhook

### NetSuite Integration
- `GET /netsuite/auth/status` - Check OAuth token status
- `POST /netsuite/auth/init` - Initialize OAuth flow (admin only)
- `GET /netsuite/callback` - OAuth callback handler
- `POST /netsuite/sync/trigger` - Manually trigger sync
- `GET /netsuite/sync/status` - Get sync job status
- `GET /netsuite/sync/history` - Get sync history
- `POST /netsuite/customers/sync` - Sync specific customer
- `POST /netsuite/invoices/sync` - Sync specific invoice
- `GET /netsuite/mappings` - Get field mappings
- `PUT /netsuite/mappings` - Update field mappings

### Toll-Free Management (Somos)
- `GET /numbers/tollfree/search` - Search available toll-free numbers
- `POST /numbers/tollfree/reserve` - Reserve toll-free numbers
- `POST /numbers/tollfree/provision` - Provision reserved numbers
- `PUT /numbers/tollfree/{tfn}/routing` - Update toll-free routing
- `POST /numbers/tollfree/{tfn}/sms/enable` - Enable SMS on toll-free
- `GET /numbers/tollfree/{tfn}/status` - Get toll-free number status
- `GET /resporg/entities` - List RespOrg entities
- `GET /resporg/entities/{id}/roids` - Get entity ROIDs
- `POST /resporg/transfer` - Initiate RespOrg transfer

## WebSocket Endpoints

### Real-time Events
- `wss://api.ringer.tel/v1/ws` - WebSocket connection for real-time events
  - Call events
  - Trunk status updates
  - Message delivery receipts

## Rate Limits
- **Standard**: 1000 requests/minute
- **Bulk Operations**: 100 requests/minute
- **WebSocket**: 10 connections per account

## Response Codes
- `200 OK` - Success
- `201 Created` - Resource created
- `204 No Content` - Success, no content
- `400 Bad Request` - Invalid request
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Access denied
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## SDKs & Libraries
Official SDKs will be available at:
- **JavaScript/TypeScript**: `npm install @ringer/warp-sdk`
- **Python**: `pip install ringer-warp`
- **Go**: `go get github.com/ringer/warp-go`
- **PHP**: `composer require ringer/warp-php`

## Support
- **Developer Portal**: https://developers.ringer.tel
- **API Status**: https://status.ringer.tel
- **Support Email**: api-support@ringer.tel

---
*Last Updated: January 2025*