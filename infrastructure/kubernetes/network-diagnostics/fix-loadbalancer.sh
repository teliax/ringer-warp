#!/bin/bash
# Fix LoadBalancer IP allocation issues in GKE

echo "=== Fixing LoadBalancer IP Allocation ==="
echo ""

# Function to recreate a service
recreate_service() {
    local namespace=$1
    local service=$2
    
    echo "Processing $namespace/$service..."
    
    # Export the service definition
    kubectl get svc $service -n $namespace -o yaml > /tmp/${service}-backup.yaml
    
    # Delete the service
    echo "  - Deleting service..."
    kubectl delete svc $service -n $namespace
    
    # Wait a bit for cleanup
    sleep 5
    
    # Recreate the service
    echo "  - Recreating service..."
    kubectl apply -f /tmp/${service}-backup.yaml
    
    echo "  - Done"
    echo ""
}

# Check if we need to enable specific APIs
echo "1. Checking required APIs..."
gcloud services list --enabled --filter="name:(compute.googleapis.com OR container.googleapis.com)" --project=ringer-warp-v01
echo ""

# Check and update firewall rules if needed
echo "2. Ensuring firewall rules for LoadBalancers..."
# GKE automatically creates firewall rules for LoadBalancer services, but let's verify

# Get the service tags
CLUSTER_NAME="warp-kamailio-cluster"
NODE_TAG="gke-${CLUSTER_NAME}-de471df2-node"

# Check if LoadBalancer firewall rule exists
echo "Checking for LoadBalancer firewall rules..."
gcloud compute firewall-rules list --filter="targetTags:${NODE_TAG} AND sourceRanges:(130.211.0.0/22 OR 35.191.0.0/16)" --project=ringer-warp-v01
echo ""

# Recreate stuck LoadBalancer services
echo "3. Recreating stuck LoadBalancer services..."
echo ""

# Get all pending LoadBalancer services
PENDING_SERVICES=$(kubectl get svc -A | grep LoadBalancer | grep '<pending>' | awk '{print $1":"$2}')

if [ -z "$PENDING_SERVICES" ]; then
    echo "No pending LoadBalancer services found."
else
    for svc in $PENDING_SERVICES; do
        namespace=$(echo $svc | cut -d: -f1)
        service=$(echo $svc | cut -d: -f2)
        recreate_service $namespace $service
    done
fi

# Wait and check status
echo "4. Waiting for LoadBalancer IPs to be assigned..."
sleep 20

echo ""
echo "5. Current LoadBalancer status:"
kubectl get svc -A | grep LoadBalancer

echo ""
echo "6. Checking for any errors:"
kubectl get events -A --sort-by=.metadata.creationTimestamp | grep -i "loadbalancer\|error\|failed" | tail -10