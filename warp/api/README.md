# WARP API Documentation

## Overview
This directory contains the OpenAPI 3.0.3 specification for the WARP SIP Trunking & Messaging platform API.

## Files
- `openapi.yaml` - Complete OpenAPI 3.0.3 specification
- `README.md` - This documentation file

## API Features

### Core Capabilities
- **Authentication**: JWT-based auth with refresh tokens and API keys
- **Customer Management**: Full CRUD operations for customer accounts
- **SIP Trunk Configuration**: Bidirectional IP whitelisting, codec selection, routing
- **Partition-Based Routing**: Route assignment and management per partition
- **Provider Management**: Downstream vendor configuration
- **LCR Engine**: Least Cost Routing with complex zone determination
- **Messaging Platform**: SMS, MMS, and RCS capabilities via SMSC
- **CDR Management**: Call detail records with export capabilities
- **Billing Integration**: Rate management and invoice generation
- **Monitoring**: Health checks and system metrics

### Security
- Bearer token authentication (JWT)
- API key authentication
- Role-based access control (RBAC)
- Rate limiting per endpoint
- IP whitelisting for trunk security

### Key Endpoints

#### Authentication
- `POST /auth/login` - User authentication
- `POST /auth/refresh` - Token refresh

#### Customer Management
- `GET /customers` - List customers
- `POST /customers` - Create customer
- `GET /customers/{id}` - Get customer details
- `PATCH /customers/{id}` - Update customer

#### SIP Trunks
- `GET /customers/{id}/trunks` - List customer trunks
- `POST /customers/{id}/trunks` - Create trunk
- `PATCH /customers/{id}/trunks/{trunk_id}` - Update trunk
- `POST /customers/{id}/trunks/{trunk_id}/ips` - Add IP whitelist

#### Partitions (Routing Groups)
- `GET /partitions` - List partitions
- `POST /partitions` - Create partition
- `GET /partitions/{id}/routes` - List partition routes
- `POST /partitions/{id}/routes` - Assign route to partition

#### Routing
- `POST /routing/calculate` - Calculate optimal route for call

#### Messaging
- `POST /messaging/sms` - Send SMS
- `POST /messaging/mms` - Send MMS
- `POST /messaging/rcs` - Send RCS message
- `GET /messaging/messages/{id}` - Get message status

#### CDRs and Billing
- `GET /cdrs` - List call detail records
- `POST /cdrs/export` - Export CDRs
- `GET /billing/rates` - List rate decks
- `POST /billing/rates` - Upload rate deck
- `GET /billing/invoices` - List invoices

#### Monitoring
- `GET /health` - System health check
- `GET /metrics` - System metrics

## Usage with Tools

### ReDoc
To generate interactive documentation with ReDoc:
```bash
npx @redocly/cli preview-docs openapi.yaml
```

### Swagger UI
To generate Swagger UI documentation:
```bash
docker run -p 8080:8080 -e SWAGGER_JSON=/api/openapi.yaml -v $(pwd):/api swaggerapi/swagger-ui
```

### Code Generation
To generate client SDKs or server stubs:
```bash
# TypeScript/JavaScript client
npx @openapitools/openapi-generator-cli generate \
  -i openapi.yaml \
  -g typescript-axios \
  -o ../sdk/typescript

# Python client
npx @openapitools/openapi-generator-cli generate \
  -i openapi.yaml \
  -g python \
  -o ../sdk/python

# Go server
npx @openapitools/openapi-generator-cli generate \
  -i openapi.yaml \
  -g go-gin-server \
  -o ../server/go
```

## Validation
To validate the OpenAPI specification:
```bash
npx @apidevtools/swagger-cli validate openapi.yaml
```

## Integration with Claude Flow/Hive-mind
This OpenAPI specification serves as the contract for the WARP platform implementation. Claude Flow can use this specification to:

1. **Generate Server Code**: Create API endpoints matching the specification
2. **Generate Client SDKs**: Build type-safe clients for various languages
3. **Create Tests**: Generate integration tests for all endpoints
4. **Build Documentation**: Generate interactive API documentation
5. **Implement Mocks**: Create mock servers for development/testing

## Webhook Events
The API supports webhook notifications for:
- Call events (started, answered, ended)
- Message events (sent, delivered, failed, received)

Configure webhook URLs per customer/trunk for real-time event notifications.

## Rate Limiting
Default rate limits:
- Authentication: 10 requests/minute
- API endpoints: 1000 requests/minute
- Bulk operations: 10 requests/minute

Custom rate limits available for enterprise customers.

## Support
For API support and questions, contact api-support@warp.io