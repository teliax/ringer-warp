#!/bin/bash
# Configure kubectl for WARP v0.1 cluster

set -euo pipefail

PROJECT_ID="ringer-warp-v01"
CLUSTER_NAME="warp-kamailio-cluster"
REGION="us-central1"

echo "🔧 Configuring kubectl for WARP v0.1 cluster..."

# Get cluster credentials
if gcloud container clusters get-credentials "$CLUSTER_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID"; then
    echo "✅ Successfully configured kubectl"
    
    # Test connection
    echo ""
    echo "📊 Cluster info:"
    kubectl cluster-info
    
    echo ""
    echo "📦 Nodes:"
    kubectl get nodes
    
    echo ""
    echo "🏷️ Current context:"
    kubectl config current-context
else
    echo "❌ Failed to configure kubectl. Cluster may not be ready yet."
    exit 1
fi

# Create namespaces if they don't exist
echo ""
echo "📁 Creating namespaces..."
for ns in warp-core warp-api monitoring homer consul; do
    kubectl create namespace "$ns" --dry-run=client -o yaml | kubectl apply -f -
    echo "✅ Namespace: $ns"
done

echo ""
echo "🎯 kubectl is configured and ready to use!"