#!/bin/bash
# Script to sync Gandi API token from Google Secret Manager to Kubernetes

set -e

PROJECT_ID="ringer-400401"
SECRET_NAME="gandi-api-token"
K8S_NAMESPACE="cert-manager"
K8S_SECRET_NAME="gandi-api-token"

echo "Fetching Gandi API token from Google Secret Manager..."

# Ensure cert-manager namespace exists
kubectl create namespace ${K8S_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# Get the secret from Google Secret Manager
GANDI_TOKEN=$(gcloud secrets versions access latest --secret="${SECRET_NAME}" --project="${PROJECT_ID}")

if [ -z "$GANDI_TOKEN" ]; then
    echo "Error: Failed to retrieve Gandi API token from GSM"
    exit 1
fi

# Create or update the Kubernetes secret
kubectl create secret generic ${K8S_SECRET_NAME} \
    --from-literal=api-token="${GANDI_TOKEN}" \
    --namespace=${K8S_NAMESPACE} \
    --dry-run=client -o yaml | kubectl apply -f -

echo "Successfully synced Gandi API token to Kubernetes secret ${K8S_SECRET_NAME} in namespace ${K8S_NAMESPACE}"

# Also create for external-dns if needed
kubectl create secret generic ${K8S_SECRET_NAME} \
    --from-literal=gandi-api-key="${GANDI_TOKEN}" \
    --namespace=external-dns \
    --dry-run=client -o yaml | kubectl apply -f - 2>/dev/null || true