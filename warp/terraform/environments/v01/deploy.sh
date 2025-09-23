#!/bin/bash
# WARP v0.1 - Terraform Deployment Script

set -e

echo "🚀 WARP Platform v0.1 - Infrastructure Deployment"
echo "================================================"

# Run Terraform
terraform init
terraform plan -out=tfplan
terraform apply tfplan

# Get outputs
echo ""
echo "📋 Deployment Outputs:"
echo "====================="
terraform output

echo ""
echo "✅ Infrastructure deployment complete!"
echo ""
echo "Next steps:"
echo "1. Configure kubectl: gcloud container clusters get-credentials warp-cluster --region=us-central1"
echo "2. Initialize database: cd ../../../database/setup && ./00-master-setup.sh"
echo "3. Deploy services: cd ../../../../kubernetes && ./deploy.sh"