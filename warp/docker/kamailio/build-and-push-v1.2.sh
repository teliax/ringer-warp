#!/bin/bash
# Build and push Kamailio v1.2 Docker image

set -e

echo "Building Kamailio v1.2 Docker image..."
echo "========================================"

# Check if we're in the right directory
if [ ! -f "Dockerfile" ]; then
    echo "Error: Dockerfile not found. Please run this script from the kamailio docker directory."
    exit 1
fi

# Ensure we're authenticated with Google Cloud
echo "Checking Google Cloud authentication..."
if ! gcloud auth list --filter=status:ACTIVE --format="get(account)" | grep -q .; then
    echo "Error: Not authenticated with Google Cloud. Please run 'gcloud auth login'"
    exit 1
fi

# Set the project
PROJECT_ID="ringer-warp-v01"
echo "Setting project to: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Submit the build
echo ""
echo "Submitting Cloud Build job..."
echo "This will build and push:"
echo "  - us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/kamailio:v1.2"
echo "  - us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/kamailio:latest"
echo ""

gcloud builds submit \
    --config=cloudbuild-v1.2.yaml \
    --project=$PROJECT_ID \
    .

echo ""
echo "Build complete! The v1.2 image has been pushed to the registry."
echo ""
echo "To deploy this image, update your Kubernetes deployment:"
echo "  kubectl set image deployment/kamailio kamailio=us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/kamailio:v1.2"
echo ""