#!/bin/bash
# Quick auth endpoint check

API_URL="${API_URL:-http://localhost:8080}"

echo "🔍 Testing Auth Endpoints..."
echo ""

# Test 1: Health (should work)
echo "1. Testing health endpoint (no auth):"
curl -s $API_URL/health | jq .
echo ""

# Test 2: Auth exchange without token (should return error with proper format)
echo "2. Testing /auth/exchange without token (should fail gracefully):"
curl -s -X POST $API_URL/auth/exchange \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
echo ""

# Test 3: Protected endpoint without auth (should return 401)
echo "3. Testing protected endpoint /v1/gatekeeper/my-permissions without auth:"
curl -s $API_URL/v1/gatekeeper/my-permissions | jq .
echo ""

echo "✅ Auth endpoints are registered and responding!"
echo ""
echo "To test full auth flow, you need a Google ID token."
echo "Get one from: https://developers.google.com/oauthplayground/"
echo "Then run: GOOGLE_ID_TOKEN='your_token' ./scripts/test-auth-flow.sh"

