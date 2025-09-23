#!/bin/bash

# Script to setup Gandi API key in Google Secret Manager
# Usage: ./setup-gandi-secret.sh <api-key>

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Check if API key is provided
if [ $# -eq 0 ]; then
    print_error "Please provide Gandi API key as argument"
    echo "Usage: $0 <api-key>"
    exit 1
fi

API_KEY=$1
SECRET_NAME="gandi-api-key"
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
    print_error "No GCP project set. Please run: gcloud config set project <PROJECT_ID>"
    exit 1
fi

print_info "Setting up Gandi API key in project: $PROJECT_ID"

# Check if secret already exists
if gcloud secrets describe $SECRET_NAME --project=$PROJECT_ID >/dev/null 2>&1; then
    print_warn "Secret $SECRET_NAME already exists. Updating..."
    echo -n "$API_KEY" | gcloud secrets versions add $SECRET_NAME --data-file=- --project=$PROJECT_ID
else
    print_info "Creating new secret: $SECRET_NAME"
    echo -n "$API_KEY" | gcloud secrets create $SECRET_NAME --data-file=- --project=$PROJECT_ID
fi

# Set proper IAM permissions
print_info "Setting IAM permissions for service accounts..."

# Get the default compute service account
COMPUTE_SA=$(gcloud iam service-accounts list --filter="email:compute@developer.gserviceaccount.com" --format="value(email)" 2>/dev/null | head -1)

if [ -n "$COMPUTE_SA" ]; then
    gcloud secrets add-iam-policy-binding $SECRET_NAME \
        --member="serviceAccount:$COMPUTE_SA" \
        --role="roles/secretmanager.secretAccessor" \
        --project=$PROJECT_ID >/dev/null 2>&1
    print_info "Granted access to compute service account: $COMPUTE_SA"
fi

# Get Kubernetes service account if exists
K8S_SA=$(gcloud iam service-accounts list --filter="displayName:Kubernetes Engine default service account" --format="value(email)" 2>/dev/null | head -1)

if [ -n "$K8S_SA" ]; then
    gcloud secrets add-iam-policy-binding $SECRET_NAME \
        --member="serviceAccount:$K8S_SA" \
        --role="roles/secretmanager.secretAccessor" \
        --project=$PROJECT_ID >/dev/null 2>&1
    print_info "Granted access to Kubernetes service account: $K8S_SA"
fi

print_info "Gandi API key successfully stored in Secret Manager!"
print_info "You can now use it in your scripts with:"
echo "gcloud secrets versions access latest --secret=$SECRET_NAME"