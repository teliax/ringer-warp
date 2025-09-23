#!/bin/bash
# Quick Start Script for Let's Encrypt SSL Setup

set -e

echo "=== Let's Encrypt SSL Quick Start ==="
echo
echo "This script will set up cert-manager and NGINX Ingress for automatic SSL certificates."
echo "Make sure you have:"
echo "1. kubectl configured to access your cluster"
echo "2. helm installed (v3+)"
echo "3. DNS records ready to point to the Ingress IP"
echo
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Step 1: Install cert-manager
echo "Step 1: Installing cert-manager..."
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.2/cert-manager.yaml

echo "Waiting for cert-manager to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-webhook -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-cainjector -n cert-manager

# Step 2: Install NGINX Ingress
echo
echo "Step 2: Installing NGINX Ingress Controller..."
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm upgrade --install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.service.annotations."cloud\.google\.com/load-balancer-type"="External" \
  --set controller.metrics.enabled=true \
  --set tcp.5061="warp-core/kamailio-sip-tcp:5061" \
  --set udp.5060="warp-core/kamailio-sip-udp:5060"

echo "Waiting for Ingress Controller to get external IP..."
kubectl wait --for=condition=available --timeout=300s deployment/nginx-ingress-controller -n ingress-nginx

# Get external IP
INGRESS_IP=""
while [ -z "$INGRESS_IP" ]; do
    echo "Waiting for external IP..."
    INGRESS_IP=$(kubectl get svc -n ingress-nginx nginx-ingress-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    sleep 5
done

echo
echo "✓ Ingress Controller External IP: $INGRESS_IP"
echo

# Step 3: Install Gandi Webhook
echo "Step 3: Installing Gandi Webhook for DNS-01 challenges..."
helm repo add bwolf https://bwolf.github.io/cert-manager-webhook-gandi
helm repo update

helm upgrade --install cert-manager-webhook-gandi \
  --namespace cert-manager \
  --set features.apiPriorityAndFairness=true \
  --set logLevel=2 \
  bwolf/cert-manager-webhook-gandi

# Step 4: Sync Gandi Secret
echo
echo "Step 4: Syncing Gandi API token from Google Secret Manager..."
./sync-gandi-secret.sh

# Step 5: Apply configurations
echo
echo "Step 5: Applying SSL configurations..."

# Create staging issuer
kubectl apply -f ../issuers/02-letsencrypt-staging-issuer.yaml

echo
echo "=== Quick Start Complete ==="
echo
echo "Next steps:"
echo "1. Configure DNS records to point to: $INGRESS_IP"
echo "   - api-v2.ringer.tel"
echo "   - grafana.ringer.tel"
echo "   - prometheus.ringer.tel"
echo "   - homer.ringer.tel"
echo
echo "2. Apply certificate configurations:"
echo "   kubectl apply -f ../certificates/"
echo
echo "3. Apply ingress configurations:"
echo "   kubectl apply -f ../ingress/"
echo
echo "4. Test with staging certificates:"
echo "   ./test-ssl-setup.sh"
echo
echo "5. Once tested, switch to production:"
echo "   - Update yamls: s/letsencrypt-staging/letsencrypt-production/g"
echo "   - Reapply configurations"
echo
echo "Monitor progress with:"
echo "kubectl get certificate --all-namespaces -w"