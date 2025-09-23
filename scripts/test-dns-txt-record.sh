#!/bin/bash

# Test creating TXT record for ACME challenge

GANDI_API_KEY=$(gcloud secrets versions access latest --secret="gandi-api-key" --project="ringer-warp-v01")

echo "Creating test TXT record..."
curl -X PUT "https://api.gandi.net/v5/livedns/domains/ringer.tel/records/_acme-challenge/TXT" \
  -H "Authorization: Bearer ${GANDI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"rrset_ttl": 300, "rrset_values": ["test-acme-challenge"]}'

echo -e "\n\nChecking if record was created..."
curl -s -H "Authorization: Bearer ${GANDI_API_KEY}" \
  "https://api.gandi.net/v5/livedns/domains/ringer.tel/records/_acme-challenge/TXT"

echo -e "\n\nDeleting test record..."
curl -X DELETE "https://api.gandi.net/v5/livedns/domains/ringer.tel/records/_acme-challenge/TXT" \
  -H "Authorization: Bearer ${GANDI_API_KEY}"