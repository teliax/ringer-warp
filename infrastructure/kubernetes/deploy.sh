#!/bin/bash
# Deployment script for WARP telecom services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="${ENVIRONMENT:-dev}"
PROJECT_ID="ringer-warp-v01"
REGION="us-central1"
CLUSTER_NAME="warp-cluster"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -p|--project)
            PROJECT_ID="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -c|--cluster)
            CLUSTER_NAME="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  -e, --environment ENV    Deployment environment (dev|prod) [default: dev]"
            echo "  -p, --project PROJECT    GCP Project ID [default: ringer-warp-v01]"
            echo "  -r, --region REGION      GCP Region [default: us-central1]"
            echo "  -c, --cluster CLUSTER    GKE Cluster name [default: warp-cluster]"
            echo "  -h, --help               Display this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

echo -e "${GREEN}WARP Telecom Services Deployment${NC}"
echo "=================================="
echo "Environment: $ENVIRONMENT"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Cluster: $CLUSTER_NAME"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}kubectl is not installed. Installing...${NC}"
    gcloud components install kubectl
fi

# Check if kustomize is installed
if ! command -v kustomize &> /dev/null; then
    echo -e "${YELLOW}kustomize is not installed. Using kubectl's built-in kustomize...${NC}"
    KUSTOMIZE_CMD="kubectl kustomize"
else
    KUSTOMIZE_CMD="kustomize build"
fi

# Check if cluster exists
echo -e "${YELLOW}Checking for GKE cluster...${NC}"
if gcloud container clusters describe $CLUSTER_NAME --region=$REGION --project=$PROJECT_ID &> /dev/null; then
    echo -e "${GREEN}Cluster found. Configuring kubectl...${NC}"
    gcloud container clusters get-credentials $CLUSTER_NAME --region=$REGION --project=$PROJECT_ID
else
    echo -e "${RED}Cluster $CLUSTER_NAME not found in project $PROJECT_ID${NC}"
    echo "Please ensure the infrastructure has been deployed first."
    exit 1
fi

# Check for required secrets
echo -e "${YELLOW}Checking for secret files...${NC}"
SECRETS_DIR="overlays/$ENVIRONMENT/secrets"
REQUIRED_SECRETS=("postgres.env" "jasmin.env" "sinch.env" "rabbitmq.env")

for secret in "${REQUIRED_SECRETS[@]}"; do
    if [ ! -f "$SECRETS_DIR/$secret" ]; then
        echo -e "${RED}Missing secret file: $SECRETS_DIR/$secret${NC}"
        echo "Creating from example..."
        cp "$SECRETS_DIR/$secret.example" "$SECRETS_DIR/$secret"
        echo -e "${YELLOW}Please edit $SECRETS_DIR/$secret with actual values${NC}"
    fi
done

# Verify all secrets are configured
SECRETS_CONFIGURED=true
for secret in "${REQUIRED_SECRETS[@]}"; do
    if grep -q "CHANGE_ME" "$SECRETS_DIR/$secret"; then
        echo -e "${RED}Secret file $SECRETS_DIR/$secret contains placeholder values${NC}"
        SECRETS_CONFIGURED=false
    fi
done

if [ "$SECRETS_CONFIGURED" = false ]; then
    echo -e "${RED}Please configure all secret files before deploying${NC}"
    exit 1
fi

# Deploy services
echo -e "${GREEN}Deploying telecom services...${NC}"

# Create namespaces first
kubectl apply -f base/namespace.yaml

# Wait for namespaces to be ready
kubectl wait --for=condition=Active namespace/telecom --timeout=30s
kubectl wait --for=condition=Active namespace/messaging --timeout=30s

# Deploy using kustomize
echo -e "${YELLOW}Building and applying Kubernetes manifests...${NC}"
$KUSTOMIZE_CMD overlays/$ENVIRONMENT | kubectl apply -f -

# Wait for deployments to be ready
echo -e "${YELLOW}Waiting for deployments to be ready...${NC}"

kubectl rollout status deployment/kamailio -n telecom --timeout=5m
kubectl rollout status deployment/jasmin-smsc -n messaging --timeout=5m
kubectl rollout status statefulset/rabbitmq -n messaging --timeout=5m

# Get service endpoints
echo -e "${GREEN}Deployment complete!${NC}"
echo ""
echo "Service Endpoints:"
echo "=================="

# Get LoadBalancer IPs
KAMAILIO_IP=$(kubectl get svc kamailio-sip -n telecom -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
JASMIN_IP=$(kubectl get svc jasmin-smpp -n messaging -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

if [ -z "$KAMAILIO_IP" ]; then
    echo -e "${YELLOW}Kamailio SIP: Waiting for LoadBalancer IP...${NC}"
    echo "  Run: kubectl get svc kamailio-sip -n telecom"
else
    echo -e "Kamailio SIP: ${GREEN}$KAMAILIO_IP:5060${NC} (UDP/TCP)"
    echo -e "Kamailio TLS: ${GREEN}$KAMAILIO_IP:5061${NC} (TCP)"
fi

if [ -z "$JASMIN_IP" ]; then
    echo -e "${YELLOW}Jasmin SMPP: Waiting for LoadBalancer IP...${NC}"
    echo "  Run: kubectl get svc jasmin-smpp -n messaging"
else
    echo -e "Jasmin SMPP: ${GREEN}$JASMIN_IP:2775${NC} (TCP)"
    echo -e "Jasmin SMPP-TLS: ${GREEN}$JASMIN_IP:2776${NC} (TCP)"
fi

echo ""
echo "Internal Services:"
echo "=================="
echo "Jasmin HTTP API: http://jasmin-api.messaging.svc.cluster.local:8080"
echo "RabbitMQ Management: http://rabbitmq-service.messaging.svc.cluster.local:15672"
echo ""
echo "Next Steps:"
echo "==========="
echo "1. Configure RTPEngine instances (handled by Terraform)"
echo "2. Update DNS records with the LoadBalancer IPs"
echo "3. Configure Sinch SMPP connection in Jasmin"
echo "4. Test SIP connectivity: sipsak -s sip:test@$KAMAILIO_IP"
echo "5. Monitor services: kubectl get pods -n telecom -w"
echo ""
echo "To access Jasmin CLI:"
echo "kubectl exec -it deployment/jasmin-smsc -n messaging -- telnet localhost 8990"
echo ""
echo -e "${GREEN}Deployment script completed!${NC}"