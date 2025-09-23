#!/bin/bash
# Deploy Kamailio v1.2 to Kubernetes

set -e

echo "Deploying Kamailio v1.2 to WARP platform..."
echo "=========================================="

# Check kubectl context
echo "Current Kubernetes context:"
kubectl config current-context

# Check current deployment
echo ""
echo "Current Kamailio deployment status:"
kubectl get deployment kamailio -n warp -o wide

echo ""
echo "Current Kamailio pods:"
kubectl get pods -n warp -l app=kamailio -o wide

# Update the deployment
echo ""
echo "Updating Kamailio deployment to v1.2..."
kubectl set image deployment/kamailio kamailio=us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/kamailio:v1.2 -n warp

# Monitor the rollout
echo ""
echo "Monitoring rollout status..."
kubectl rollout status deployment/kamailio -n warp --timeout=5m

# Show final status
echo ""
echo "Deployment complete! Final status:"
kubectl get deployment kamailio -n warp -o wide

echo ""
echo "Updated pods:"
kubectl get pods -n warp -l app=kamailio -o wide

# Check logs from new pods
echo ""
echo "Checking logs from a new pod (last 20 lines):"
NEW_POD=$(kubectl get pods -n warp -l app=kamailio -o jsonpath='{.items[0].metadata.name}')
kubectl logs $NEW_POD -n warp --tail=20

echo ""
echo "Deployment complete! Kamailio v1.2 is now running."