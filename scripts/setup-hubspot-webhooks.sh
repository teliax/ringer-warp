#!/bin/bash

# HubSpot Webhook Setup Script
# Configures webhooks programmatically via HubSpot API v3

set -e

# Configuration
HUBSPOT_API_KEY="2645b4b4-de77-4576-9aad-11d5e3ab74d7"
PORTAL_ID="44974642"
WEBHOOK_URL="https://api.rns.ringer.tel/webhooks/hubspot/company"

echo "🔧 HubSpot Webhook Setup"
echo "======================="
echo "Portal ID: $PORTAL_ID"
echo "Webhook URL: $WEBHOOK_URL"
echo ""

# Step 1: Check current webhook settings
echo "📋 Step 1: Checking current webhook settings..."
SETTINGS=$(curl -s -X GET \
  "https://api.hubapi.com/webhooks/v3/$PORTAL_ID/settings" \
  -H "Authorization: Bearer $HUBSPOT_API_KEY")

echo "$SETTINGS" | jq '.'

# Extract target URL (this is the validation/signing secret)
TARGET_URL=$(echo "$SETTINGS" | jq -r '.targetUrl // empty')
echo ""
echo "✅ Webhook settings retrieved"
if [ -n "$TARGET_URL" ]; then
  echo "   Target URL configured: $TARGET_URL"
fi
echo ""

# Step 2: List current subscriptions
echo "📋 Step 2: Listing current webhook subscriptions..."
SUBSCRIPTIONS=$(curl -s -X GET \
  "https://api.hubapi.com/webhooks/v3/$PORTAL_ID/subscriptions" \
  -H "Authorization: Bearer $HUBSPOT_API_KEY")

echo "$SUBSCRIPTIONS" | jq '.results[] | {id, eventType, propertyName, active}'

EXISTING_COUNT=$(echo "$SUBSCRIPTIONS" | jq '.results | length')
echo ""
echo "✅ Found $EXISTING_COUNT existing subscription(s)"
echo ""

# Step 3: Check if our subscription already exists
EXISTING_SUB=$(echo "$SUBSCRIPTIONS" | jq -r ".results[] | select(.eventType == \"company.propertyChange\" and .propertyName == \"*\") | .id")

if [ -n "$EXISTING_SUB" ]; then
  echo "⚠️  Subscription already exists (ID: $EXISTING_SUB)"
  echo "   Skipping creation..."
else
  # Step 4: Create new webhook subscription
  echo "📝 Step 3: Creating webhook subscription for company.propertyChange..."

  SUBSCRIPTION=$(curl -s -X POST \
    "https://api.hubapi.com/webhooks/v3/$PORTAL_ID/subscriptions" \
    -H "Authorization: Bearer $HUBSPOT_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"eventType\": \"company.propertyChange\",
      \"propertyName\": \"*\",
      \"active\": true
    }")

  SUB_ID=$(echo "$SUBSCRIPTION" | jq -r '.id // empty')

  if [ -n "$SUB_ID" ]; then
    echo "✅ Webhook subscription created successfully!"
    echo "   Subscription ID: $SUB_ID"
    echo "$SUBSCRIPTION" | jq '.'
  else
    echo "❌ Failed to create subscription"
    echo "$SUBSCRIPTION" | jq '.'
    exit 1
  fi
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "✅ HubSpot Webhook Setup Complete!"
echo "═══════════════════════════════════════════════"
echo ""
echo "📌 Next Steps:"
echo ""
echo "1. Update Kubernetes secret with webhook validation URL:"
echo "   (This is used for signature validation)"
echo ""
if [ -n "$TARGET_URL" ]; then
  echo "   kubectl patch secret api-gateway-secrets -n warp-api \\"
  echo "     --type='json' \\"
  echo "     -p='[{\"op\": \"replace\", \"path\": \"/data/HUBSPOT_WEBHOOK_SECRET\", \"value\":\"'$(echo -n "$TARGET_URL" | base64)'\"}]'"
  echo ""
else
  echo "   ⚠️  Could not retrieve target URL from HubSpot"
  echo "   You may need to set the webhook target URL first:"
  echo ""
  echo "   curl -X PUT https://api.hubapi.com/webhooks/v3/$PORTAL_ID/settings \\"
  echo "     -H \"Authorization: Bearer $HUBSPOT_API_KEY\" \\"
  echo "     -H \"Content-Type: application/json\" \\"
  echo "     -d '{\"targetUrl\": \"$WEBHOOK_URL\"}'"
  echo ""
fi

echo "2. Restart API Gateway to pick up new secret:"
echo "   kubectl rollout restart deployment/api-gateway -n warp-api"
echo ""
echo "3. Test webhook by changing a company property in HubSpot"
echo ""
echo "4. Verify webhook received:"
echo "   kubectl logs -n warp-api deployment/api-gateway | grep 'Received HubSpot webhook'"
echo ""
echo "═══════════════════════════════════════════════"
