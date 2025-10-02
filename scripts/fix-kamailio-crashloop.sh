#!/bin/bash
# Fix Kamailio CrashLoopBackOff - Config syntax error on line 11
# Root cause: __LOG_LEVEL__ placeholder not being substituted

set -e

PROJECT_ID="ringer-warp-v01"
NAMESPACE="ringer-warp-v01"

echo "🔧 Fixing Kamailio CrashLoopBackOff Issue"
echo "=========================================="
echo ""

# Get current ConfigMap
echo "📋 Checking current Kamailio ConfigMap..."
if ! kubectl get configmap -n $NAMESPACE kamailio-config &>/dev/null; then
    echo "❌ ConfigMap kamailio-config not found in namespace $NAMESPACE"
    exit 1
fi

# The issue is in the Docker image - the entrypoint script needs to substitute __LOG_LEVEL__
# Let's check if there's a deployment using environment variables

echo ""
echo "🔍 Analyzing Kamailio deployment..."
kubectl get deployment -n $NAMESPACE | grep kamailio || echo "No kamailio deployment found"

echo ""
echo "💡 Root Cause:"
echo "   The kamailio.cfg file contains placeholder __LOG_LEVEL__ on line 11"
echo "   This placeholder is not being substituted by the entrypoint script"
echo ""

# Check if namespace warp-sip exists (from our repo config)
if kubectl get namespace warp-sip &>/dev/null; then
    echo "✅ Found warp-sip namespace (correct namespace from repo)"
    echo ""
    echo "🎯 Solution: The deployment in ringer-warp-v01 namespace appears to be incorrect"
    echo "   The correct deployment should be in 'warp-sip' namespace as per repo config"
    echo ""
    echo "Recommended actions:"
    echo "1. Delete old deployments in ringer-warp-v01 namespace"
    echo "2. Deploy using correct manifests from warp/k8s/kamailio/"
    echo ""
    read -p "Delete old Kamailio deployments in $NAMESPACE? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Deleting old Kamailio resources..."
        kubectl delete deployment -n $NAMESPACE -l app=kamailio --ignore-not-found=true
        kubectl delete configmap -n $NAMESPACE kamailio-config --ignore-not-found=true
        echo "✅ Old resources deleted"
    fi
else
    echo "⚠️  warp-sip namespace not found"
    echo "   Creating namespace and applying correct configuration..."
    kubectl create namespace warp-sip
fi

echo ""
echo "📝 Next steps:"
echo "1. Apply the correct Kamailio deployment from repo:"
echo "   kubectl apply -f warp/k8s/kamailio/deployment.yaml"
echo ""
echo "2. Verify pods are running:"
echo "   kubectl get pods -n warp-sip -l app=kamailio"
echo ""

echo "✅ Kamailio fix preparation complete"
