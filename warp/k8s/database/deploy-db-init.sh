#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

NAMESPACE="warp-core"
SCHEMA_DIR="/home/daldworth/repos/ringer-warp/warp/database/schema"

echo -e "${GREEN}=== WARP Database Initialization ===${NC}"

# Check if namespace exists
if ! kubectl get namespace $NAMESPACE &> /dev/null; then
    echo -e "${YELLOW}Creating namespace $NAMESPACE...${NC}"
    kubectl create namespace $NAMESPACE
else
    echo -e "${GREEN}Namespace $NAMESPACE already exists${NC}"
fi

# Create or update the database credentials secret
echo -e "${YELLOW}Creating database credentials secret...${NC}"
kubectl apply -f db-credentials-secret.yaml

# Create ConfigMap from schema files
echo -e "${YELLOW}Creating ConfigMap from schema files...${NC}"
./create-schema-configmap.sh

# Check if a previous job exists and delete it
if kubectl get job warp-db-init -n $NAMESPACE &> /dev/null; then
    echo -e "${YELLOW}Deleting existing job...${NC}"
    kubectl delete job warp-db-init -n $NAMESPACE
    sleep 2
fi

# Create the initialization job
echo -e "${YELLOW}Creating database initialization job...${NC}"
kubectl apply -f db-init-job-with-secret.yaml

# Wait for job to complete
echo -e "${YELLOW}Waiting for job to complete...${NC}"
kubectl wait --for=condition=complete --timeout=300s job/warp-db-init -n $NAMESPACE

# Check job status
JOB_STATUS=$(kubectl get job warp-db-init -n $NAMESPACE -o jsonpath='{.status.conditions[?(@.type=="Complete")].status}')

if [ "$JOB_STATUS" == "True" ]; then
    echo -e "${GREEN}✓ Database initialization completed successfully!${NC}"
    
    # Display logs
    echo -e "\n${GREEN}=== Job Logs ===${NC}"
    kubectl logs -n $NAMESPACE job/warp-db-init
    
    echo -e "\n${GREEN}=== Summary ===${NC}"
    echo "Database Host: 10.126.0.3"
    echo "Database Name: warp"
    echo "Database User: warp"
    echo "Namespace: $NAMESPACE"
    echo -e "\n${GREEN}The WARP database has been initialized with all schemas and tables.${NC}"
else
    echo -e "${RED}✗ Database initialization failed!${NC}"
    echo -e "${RED}Check the logs for details:${NC}"
    kubectl logs -n $NAMESPACE job/warp-db-init
    exit 1
fi