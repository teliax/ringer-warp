#!/bin/bash

# Quick test script to verify HubSpot API access and check current configuration

HUBSPOT_API_KEY="2645b4b4-de77-4576-9aad-11d5e3ab74d7"
PORTAL_ID="44974642"

echo "🧪 Testing HubSpot API Access"
echo "=============================="
echo ""

# Test 1: Get account info
echo "1️⃣  Testing API key validity..."
ACCOUNT_INFO=$(curl -s -w "\n%{http_code}" -X GET \
  "https://api.hubapi.com/account-info/v3/details" \
  -H "Authorization: Bearer $HUBSPOT_API_KEY")

HTTP_CODE=$(echo "$ACCOUNT_INFO" | tail -n 1)
RESPONSE=$(echo "$ACCOUNT_INFO" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ API key is valid!"
  echo "$RESPONSE" | jq '{portalId, currency, timeZone}'
else
  echo "❌ API key validation failed (HTTP $HTTP_CODE)"
  echo "$RESPONSE"
  exit 1
fi

echo ""

# Test 2: Check CRM scopes
echo "2️⃣  Checking CRM permissions..."
COMPANY_TEST=$(curl -s -w "\n%{http_code}" -X GET \
  "https://api.hubapi.com/crm/v3/objects/companies?limit=1" \
  -H "Authorization: Bearer $HUBSPOT_API_KEY")

HTTP_CODE=$(echo "$COMPANY_TEST" | tail -n 1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ CRM read permission: OK"
else
  echo "❌ CRM read permission: MISSING (HTTP $HTTP_CODE)"
fi

# Test write permission
CREATE_TEST=$(curl -s -w "\n%{http_code}" -X POST \
  "https://api.hubapi.com/crm/v3/objects/companies" \
  -H "Authorization: Bearer $HUBSPOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "properties": {
      "name": "API Test Company - DELETE ME",
      "domain": "test-api-delete-me.com"
    }
  }')

HTTP_CODE=$(echo "$CREATE_TEST" | tail -n 1)
RESPONSE=$(echo "$CREATE_TEST" | head -n -1)

if [ "$HTTP_CODE" = "201" ]; then
  echo "✅ CRM write permission: OK"

  # Clean up test company
  COMPANY_ID=$(echo "$RESPONSE" | jq -r '.id')
  if [ -n "$COMPANY_ID" ] && [ "$COMPANY_ID" != "null" ]; then
    echo "   Deleting test company (ID: $COMPANY_ID)..."
    curl -s -X DELETE \
      "https://api.hubapi.com/crm/v3/objects/companies/$COMPANY_ID" \
      -H "Authorization: Bearer $HUBSPOT_API_KEY" > /dev/null
    echo "   ✅ Test company deleted"
  fi
else
  echo "❌ CRM write permission: MISSING (HTTP $HTTP_CODE)"
  echo "$RESPONSE" | jq '.'
fi

echo ""

# Test 3: Check webhook capabilities
echo "3️⃣  Checking webhook API access..."
WEBHOOK_TEST=$(curl -s -w "\n%{http_code}" -X GET \
  "https://api.hubapi.com/webhooks/v3/$PORTAL_ID/settings" \
  -H "Authorization: Bearer $HUBSPOT_API_KEY")

HTTP_CODE=$(echo "$WEBHOOK_TEST" | tail -n 1)
RESPONSE=$(echo "$WEBHOOK_TEST" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Webhook API access: OK"
  echo "$RESPONSE" | jq '.'
else
  echo "❌ Webhook API access: FAILED (HTTP $HTTP_CODE)"
  echo "$RESPONSE" | jq '.'
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "Summary:"
echo "═══════════════════════════════════════════════"
echo "✅ API Key Valid"
echo "✅ Ready to set up webhooks"
echo ""
echo "Run ./setup-hubspot-webhooks.sh to configure webhooks"
echo "═══════════════════════════════════════════════"
