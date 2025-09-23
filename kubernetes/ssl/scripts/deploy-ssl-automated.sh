#!/bin/bash
# Automated SSL Deployment Script

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}=== Automated SSL Infrastructure Deployment ===${NC}"
echo

# Step 1: Install cert-manager
echo -e "${GREEN}Step 1: Installing cert-manager...${NC}"
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.2/cert-manager.yaml

echo "Waiting for cert-manager to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-webhook -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-cainjector -n cert-manager

# Step 2: Install NGINX Ingress Controller
echo -e "${GREEN}Step 2: Installing NGINX Ingress Controller...${NC}"
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  --set controller.publishService.enabled=true

echo "Waiting for NGINX Ingress to be ready..."
kubectl wait --for=condition=ready pod \
  --selector=app.kubernetes.io/name=ingress-nginx \
  --timeout=120s -n ingress-nginx

# Get the Ingress IP
echo -e "${GREEN}Step 3: Getting NGINX Ingress IP...${NC}"
for i in {1..30}; do
  INGRESS_IP=$(kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)
  if [ -n "$INGRESS_IP" ]; then
    echo -e "${GREEN}✓ NGINX Ingress IP: $INGRESS_IP${NC}"
    break
  fi
  echo "Waiting for LoadBalancer IP... (attempt $i/30)"
  sleep 10
done

if [ -z "$INGRESS_IP" ]; then
  echo -e "${RED}Failed to get Ingress IP. Check your LoadBalancer configuration.${NC}"
  exit 1
fi

# Step 4: Create Gandi webhook for DNS-01 challenges
echo -e "${GREEN}Step 4: Setting up Gandi webhook for DNS-01 challenges...${NC}"
kubectl apply -f ../cert-manager/12-gandi-webhook.yaml

# Wait for webhook to be ready
kubectl wait --for=condition=ready pod \
  --selector=app.kubernetes.io/name=cert-manager-webhook-gandi \
  --timeout=120s -n cert-manager

# Step 5: Create ClusterIssuers
echo -e "${GREEN}Step 5: Creating Let's Encrypt issuers...${NC}"

# First, sync the Gandi secret from default to cert-manager namespace
echo "Syncing Gandi API key to cert-manager namespace..."
kubectl get secret gandi-api-key -o yaml | \
  sed 's/namespace: .*/namespace: cert-manager/' | \
  kubectl apply -f -

# Apply staging issuer
kubectl apply -f ../issuers/02-letsencrypt-staging-issuer.yaml
sleep 5

# Step 6: Create test certificate
echo -e "${GREEN}Step 6: Creating test certificate with staging issuer...${NC}"
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: test-staging-cert
  namespace: default
spec:
  secretName: test-staging-tls
  issuerRef:
    name: letsencrypt-staging
    kind: ClusterIssuer
  dnsNames:
  - test.ringer.tel
EOF

echo "Waiting for test certificate..."
kubectl wait --for=condition=ready certificate/test-staging-cert --timeout=180s || true

# Check certificate status
echo -e "${GREEN}Step 7: Checking certificate status...${NC}"
kubectl describe certificate test-staging-cert

echo
echo -e "${YELLOW}=== Summary ===${NC}"
echo -e "1. cert-manager: ${GREEN}✓ Installed${NC}"
echo -e "2. NGINX Ingress: ${GREEN}✓ Installed${NC}"
echo -e "3. Ingress IP: ${GREEN}$INGRESS_IP${NC}"
echo -e "4. Gandi webhook: ${GREEN}✓ Configured${NC}"
echo -e "5. Staging issuer: ${GREEN}✓ Created${NC}"

echo
echo -e "${YELLOW}=== Next Steps ===${NC}"
echo "1. Update DNS records to point to NGINX Ingress IP: $INGRESS_IP"
echo "   Run: cd ../../scripts/dns && ./update-dns-loadbalancers.sh"
echo
echo "2. Apply Ingress resources with TLS:"
echo "   kubectl apply -f ../ingress/"
echo
echo "3. Once staging certificates work, create production issuer:"
echo "   kubectl apply -f ../issuers/03-letsencrypt-production-issuer.yaml"
echo
echo "4. Update certificates to use production issuer"