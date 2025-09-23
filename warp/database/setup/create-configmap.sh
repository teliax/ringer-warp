#!/bin/bash
set -e

# Script to create ConfigMap from schema files
SCHEMA_DIR="${SCHEMA_DIR:-../schema}"
CONFIGMAP_NAME="warp-db-schema"
NAMESPACE="warp-core"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Creating ConfigMap from schema files...${NC}"

# Check if schema directory exists
if [ ! -d "$SCHEMA_DIR" ]; then
    echo -e "${RED}Schema directory not found: $SCHEMA_DIR${NC}"
    exit 1
fi

# Check if namespace exists
if ! kubectl get namespace $NAMESPACE &> /dev/null; then
    echo -e "${YELLOW}Creating namespace $NAMESPACE...${NC}"
    kubectl create namespace $NAMESPACE
fi

# Delete existing ConfigMap if it exists
if kubectl get configmap $CONFIGMAP_NAME -n $NAMESPACE &> /dev/null; then
    echo -e "${YELLOW}Deleting existing ConfigMap...${NC}"
    kubectl delete configmap $CONFIGMAP_NAME -n $NAMESPACE
fi

# Create ConfigMap from all SQL files
echo -e "${YELLOW}Creating ConfigMap from SQL files in $SCHEMA_DIR...${NC}"
kubectl create configmap $CONFIGMAP_NAME \
    --from-file="$SCHEMA_DIR" \
    -n $NAMESPACE

# Verify ConfigMap
echo -e "${GREEN}ConfigMap created successfully!${NC}"
echo -e "${GREEN}Contents:${NC}"
kubectl get configmap $CONFIGMAP_NAME -n $NAMESPACE -o jsonpath='{.data}' | jq 'keys'