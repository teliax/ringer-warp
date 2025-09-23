#!/bin/bash
# Test script to verify environment variable substitution

# Create a test directory
TEST_DIR="/tmp/kamailio-test"
rm -rf $TEST_DIR
mkdir -p $TEST_DIR

# Copy the config file
cp kamailio.cfg $TEST_DIR/kamailio.cfg

# Set test values
export DB_HOST="test-db-host"
export DB_PORT="5432"
export DB_NAME="test-db"
export DB_USER="test-user"
export DB_PASS="test-pass"
export SIP_DOMAIN="test.domain.com"
export PUBLIC_IP="1.2.3.4"
export PRIVATE_IP="10.0.0.1"
export WEBSOCKET_PORT="8080"
export TLS_PORT="5061"
export RTPENGINE_LIST="udp:test-rtpengine:2223"
export LOG_LEVEL="2"
export ENABLE_DEBUG="0"

# Function from docker-entrypoint.sh
replace_vars() {
    local file=$1
    if [ -f "$file" ]; then
        sed -i "s|__DB_HOST__|${DB_HOST}|g" "$file"
        sed -i "s|__DB_PORT__|${DB_PORT}|g" "$file"
        sed -i "s|__DB_NAME__|${DB_NAME}|g" "$file"
        sed -i "s|__DB_USER__|${DB_USER}|g" "$file"
        sed -i "s|__DB_PASS__|${DB_PASS}|g" "$file"
        sed -i "s|__SIP_DOMAIN__|${SIP_DOMAIN}|g" "$file"
        sed -i "s|__PUBLIC_IP__|${PUBLIC_IP}|g" "$file"
        sed -i "s|__PRIVATE_IP__|${PRIVATE_IP}|g" "$file"
        sed -i "s|__WEBSOCKET_PORT__|${WEBSOCKET_PORT}|g" "$file"
        sed -i "s|__TLS_PORT__|${TLS_PORT}|g" "$file"
        sed -i "s|__RTPENGINE_LIST__|${RTPENGINE_LIST}|g" "$file"
        sed -i "s|__LOG_LEVEL__|${LOG_LEVEL}|g" "$file"
        sed -i "s|__ENABLE_DEBUG__|${ENABLE_DEBUG}|g" "$file"
    fi
}

# Replace variables
echo "Replacing variables in config file..."
replace_vars $TEST_DIR/kamailio.cfg

# Check the listen directives
echo ""
echo "Checking listen directives after substitution:"
echo "=============================================="
grep -n "^listen=" $TEST_DIR/kamailio.cfg | head -10

echo ""
echo "Checking if any placeholders remain:"
echo "===================================="
if grep -q "__.*__" $TEST_DIR/kamailio.cfg; then
    echo "WARNING: Found remaining placeholders:"
    grep -n "__.*__" $TEST_DIR/kamailio.cfg | head -10
else
    echo "✓ All placeholders have been replaced"
fi

# Test with empty PUBLIC_IP
echo ""
echo "Testing with empty PUBLIC_IP:"
echo "============================="
cp kamailio.cfg $TEST_DIR/kamailio-empty.cfg
export PUBLIC_IP=""
export PRIVATE_IP="10.0.0.1"
replace_vars $TEST_DIR/kamailio-empty.cfg
echo "Listen directives with empty PUBLIC_IP:"
grep -n "^listen=" $TEST_DIR/kamailio-empty.cfg | head -5

# Cleanup
rm -rf $TEST_DIR