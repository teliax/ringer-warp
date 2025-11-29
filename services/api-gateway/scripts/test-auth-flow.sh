#!/bin/bash
# Test the complete auth flow: Google OAuth → JWT exchange → Protected endpoint

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:8080}"
GOOGLE_ID_TOKEN="${GOOGLE_ID_TOKEN}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  WARP Auth System Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Check health endpoints (no auth required)
echo -e "${BLUE}Step 1: Testing health endpoints (no auth)${NC}"
echo "GET $API_URL/health"
HEALTH_RESPONSE=$(curl -s "$API_URL/health")
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Health check passed${NC}"
else
    echo -e "${RED}❌ Health check failed${NC}"
    echo "Response: $HEALTH_RESPONSE"
    exit 1
fi
echo ""

# Step 2: Exchange Google token for WARP JWT
if [ -z "$GOOGLE_ID_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  GOOGLE_ID_TOKEN not provided${NC}"
    echo ""
    echo "To get a Google ID token, you can:"
    echo "1. Use Google OAuth Playground: https://developers.google.com/oauthplayground/"
    echo "   - Select 'Google OAuth2 API v2' → 'https://www.googleapis.com/auth/userinfo.email'"
    echo "   - Click 'Authorize APIs'"
    echo "   - Exchange authorization code for tokens"
    echo "   - Copy the id_token"
    echo ""
    echo "2. Or use your frontend app's login and capture the ID token"
    echo ""
    echo "Then run: GOOGLE_ID_TOKEN='your_token_here' $0"
    exit 1
fi

echo -e "${BLUE}Step 2: Exchanging Google token for WARP JWT${NC}"
echo "POST $API_URL/auth/exchange"

EXCHANGE_RESPONSE=$(curl -s -X POST "$API_URL/auth/exchange" \
    -H "Content-Type: application/json" \
    -d "{\"id_token\": \"$GOOGLE_ID_TOKEN\"}")

# Check if exchange was successful
if echo "$EXCHANGE_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Token exchange successful${NC}"
    
    # Extract tokens
    ACCESS_TOKEN=$(echo "$EXCHANGE_RESPONSE" | jq -r '.data.access_token')
    REFRESH_TOKEN=$(echo "$EXCHANGE_RESPONSE" | jq -r '.data.refresh_token')
    
    echo "Access Token: ${ACCESS_TOKEN:0:50}..."
    echo "Refresh Token: ${REFRESH_TOKEN:0:50}..."
else
    echo -e "${RED}❌ Token exchange failed${NC}"
    echo "Response: $EXCHANGE_RESPONSE"
    exit 1
fi
echo ""

# Step 3: Validate token
echo -e "${BLUE}Step 3: Validating WARP token${NC}"
echo "GET $API_URL/auth/validate"

VALIDATE_RESPONSE=$(curl -s -X GET "$API_URL/auth/validate" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$VALIDATE_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Token validation successful${NC}"
    echo "User: $(echo "$VALIDATE_RESPONSE" | jq -r '.data.email')"
    echo "User Type: $(echo "$VALIDATE_RESPONSE" | jq -r '.data.user_type')"
else
    echo -e "${RED}❌ Token validation failed${NC}"
    echo "Response: $VALIDATE_RESPONSE"
    exit 1
fi
echo ""

# Step 4: Get user permissions
echo -e "${BLUE}Step 4: Getting user permissions${NC}"
echo "GET $API_URL/v1/gatekeeper/my-permissions"

PERMISSIONS_RESPONSE=$(curl -s -X GET "$API_URL/v1/gatekeeper/my-permissions" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$PERMISSIONS_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Permissions retrieved successfully${NC}"
    PERMISSION_COUNT=$(echo "$PERMISSIONS_RESPONSE" | jq -r '.data.permissions | length')
    echo "Permission count: $PERMISSION_COUNT"
    echo "First 5 permissions:"
    echo "$PERMISSIONS_RESPONSE" | jq -r '.data.permissions[:5][]'
else
    echo -e "${RED}❌ Failed to get permissions${NC}"
    echo "Response: $PERMISSIONS_RESPONSE"
fi
echo ""

# Step 5: Test protected endpoint
echo -e "${BLUE}Step 5: Testing protected endpoint${NC}"
echo "GET $API_URL/v1/admin/smpp-vendors"

VENDORS_RESPONSE=$(curl -s -X GET "$API_URL/v1/admin/smpp-vendors" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$VENDORS_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Protected endpoint access successful${NC}"
    VENDOR_COUNT=$(echo "$VENDORS_RESPONSE" | jq -r '.data | length')
    echo "Vendor count: $VENDOR_COUNT"
else
    echo -e "${RED}❌ Protected endpoint access failed${NC}"
    echo "Response: $VENDORS_RESPONSE"
fi
echo ""

# Step 6: Test without token (should fail)
echo -e "${BLUE}Step 6: Testing protected endpoint without token (should fail)${NC}"
echo "GET $API_URL/v1/admin/smpp-vendors"

UNAUTH_RESPONSE=$(curl -s -X GET "$API_URL/v1/admin/smpp-vendors")

if echo "$UNAUTH_RESPONSE" | jq -e '.success == false' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Correctly rejected unauthenticated request${NC}"
else
    echo -e "${RED}❌ Security issue: accepted request without token!${NC}"
    echo "Response: $UNAUTH_RESPONSE"
fi
echo ""

# Step 7: Test token refresh
echo -e "${BLUE}Step 7: Testing token refresh${NC}"
echo "POST $API_URL/auth/refresh"

REFRESH_RESPONSE=$(curl -s -X POST "$API_URL/auth/refresh" \
    -H "Content-Type: application/json" \
    -d "{\"refresh_token\": \"$REFRESH_TOKEN\"}")

if echo "$REFRESH_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Token refresh successful${NC}"
    NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.data.access_token')
    echo "New Access Token: ${NEW_ACCESS_TOKEN:0:50}..."
else
    echo -e "${RED}❌ Token refresh failed${NC}"
    echo "Response: $REFRESH_RESPONSE"
fi
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Auth system test complete!${NC}"
echo -e "${BLUE}========================================${NC}"

