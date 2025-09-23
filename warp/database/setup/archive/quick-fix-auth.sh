#!/bin/bash

# Quick fix for Cloud SQL authentication
# This creates a new user and tests it immediately

set -e

PROJECT_ID="ringer-warp-v01"
INSTANCE_NAME="warp-db"
DATABASE="warp"

echo "=== Quick Cloud SQL Auth Fix ==="

# Set project
gcloud config set project $PROJECT_ID

# Get private IP
PRIVATE_IP=$(gcloud sql instances describe $INSTANCE_NAME --format="get(ipAddresses[2].ipAddress)")
echo "Private IP: $PRIVATE_IP"

# Create a super simple user
echo
echo "Creating new test user..."
TEST_USER="testapp"
TEST_PASS="test123"

# Delete if exists
gcloud sql users delete $TEST_USER --instance=$INSTANCE_NAME --quiet 2>/dev/null || true

# Create user
gcloud sql users create $TEST_USER \
  --instance=$INSTANCE_NAME \
  --password="$TEST_PASS"

echo "User created: $TEST_USER / $TEST_PASS"

# Also reset warp user with simple password
echo
echo "Resetting warp user password..."
gcloud sql users set-password warp \
  --instance=$INSTANCE_NAME \
  --password="warp123"

echo "warp user password set to: warp123"

# Test from a simple pod
echo
echo "Creating test pod..."

kubectl delete pod psql-test 2>/dev/null || true

kubectl run psql-test --image=postgres:15 --rm -it --restart=Never -- \
  psql "postgresql://${TEST_USER}:${TEST_PASS}@${PRIVATE_IP}:5432/${DATABASE}" -c "SELECT current_database(), current_user, version();"