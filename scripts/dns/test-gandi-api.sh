#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== Testing Gandi API Key ===${NC}"

# Get API key from Secret Manager
echo -e "\n${GREEN}1. Retrieving API key from Secret Manager...${NC}"
GANDI_API_KEY=$(gcloud secrets versions access latest --secret="gandi-api-key" --project="ringer-warp-v01" 2>/dev/null)

if [ -z "$GANDI_API_KEY" ]; then
    echo -e "${RED}Failed to retrieve API key from Secret Manager${NC}"
    exit 1
fi

echo "API Key retrieved (length: ${#GANDI_API_KEY} characters)"

# Test API endpoints
echo -e "\n${GREEN}2. Testing API endpoints...${NC}"

echo -e "\n${YELLOW}Testing /v5/organization${NC}"
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -H "Authorization: Apikey ${GANDI_API_KEY}" https://api.gandi.net/v5/organization)
http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d':' -f2)
body=$(echo "$response" | sed '/HTTP_CODE:/d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Organization endpoint works${NC}"
    echo "$body" | head -5
else
    echo -e "${RED}✗ Organization endpoint failed (HTTP $http_code)${NC}"
    echo "$body"
fi

echo -e "\n${YELLOW}Testing /v5/livedns/domains${NC}"
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -H "Authorization: Apikey ${GANDI_API_KEY}" https://api.gandi.net/v5/livedns/domains)
http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d':' -f2)
body=$(echo "$response" | sed '/HTTP_CODE:/d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ LiveDNS domains endpoint works${NC}"
    echo "$body"
else
    echo -e "${RED}✗ LiveDNS domains endpoint failed (HTTP $http_code)${NC}"
    echo "$body"
fi

echo -e "\n${YELLOW}Testing with Bearer format${NC}"
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -H "Authorization: Bearer ${GANDI_API_KEY}" https://api.gandi.net/v5/livedns/domains)
http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d':' -f2)
body=$(echo "$response" | sed '/HTTP_CODE:/d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Bearer format works${NC}"
    echo "$body"
else
    echo -e "${RED}✗ Bearer format failed (HTTP $http_code)${NC}"
fi

echo -e "\n${YELLOW}3. Checking API key format${NC}"
if [[ $GANDI_API_KEY =~ ^[a-zA-Z0-9]{24,}$ ]]; then
    echo -e "${GREEN}✓ API key format looks valid${NC}"
else
    echo -e "${RED}✗ API key format may be invalid${NC}"
    echo "Key starts with: ${GANDI_API_KEY:0:10}..."
fi

echo -e "\n${YELLOW}=== Summary ===${NC}"
echo "Please ensure your API key has the following permissions in Gandi:"
echo "- ✓ See and renew domain names"
echo "- ✓ Manage domain name technical configurations" 
echo "- ✓ Manage LiveDNS (REQUIRED)"