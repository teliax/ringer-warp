#!/bin/bash
# Kamailio Docker Entrypoint Script

set -e

# Function to replace environment variables in config files
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

# Get public IP if not set
if [ -z "$PUBLIC_IP" ]; then
    echo "Attempting to get public IP from metadata service..."
    PUBLIC_IP=$(curl -s http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip -H "Metadata-Flavor: Google" 2>/dev/null || true)
    if [ -z "$PUBLIC_IP" ]; then
        echo "Failed to get public IP from metadata, using private IP as fallback"
        PUBLIC_IP=$(hostname -i | awk '{print $1}')
    fi
    echo "PUBLIC_IP set to: $PUBLIC_IP"
fi

# Get private IP if not set
if [ -z "$PRIVATE_IP" ]; then
    PRIVATE_IP=$(hostname -i | awk '{print $1}')
    echo "PRIVATE_IP set to: $PRIVATE_IP"
fi

# Validate IPs
if [ -z "$PUBLIC_IP" ] || [ -z "$PRIVATE_IP" ]; then
    echo "ERROR: Could not determine PUBLIC_IP or PRIVATE_IP"
    echo "PUBLIC_IP: $PUBLIC_IP"
    echo "PRIVATE_IP: $PRIVATE_IP"
    exit 1
fi

# Replace variables in configuration files
replace_vars /etc/kamailio/kamailio.cfg
replace_vars /etc/kamailio/kamctlrc
replace_vars /etc/kamailio/dispatcher.list

# Special handling for advertise directive when PUBLIC_IP equals PRIVATE_IP
# If they are the same, we don't need the advertise directive
if [ "$PUBLIC_IP" = "$PRIVATE_IP" ]; then
    echo "PUBLIC_IP and PRIVATE_IP are the same, removing advertise directives..."
    sed -i "s/ advertise ${PUBLIC_IP}:5060//g" /etc/kamailio/kamailio.cfg
    sed -i "s/ advertise ${PUBLIC_IP}:5061//g" /etc/kamailio/kamailio.cfg
fi

# Wait for database to be ready
echo "Waiting for PostgreSQL database..."
until PGPASSWORD=$DB_PASS psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; do
    echo "PostgreSQL is unavailable - sleeping"
    sleep 2
done
echo "PostgreSQL is ready"

# Initialize database tables if needed
if [ "$INIT_DB" = "true" ]; then
    echo "Initializing Kamailio database tables..."
    kamdbctl create || true
fi

# Test configuration
echo "Testing Kamailio configuration..."
echo "Configuration variables:"
echo "  PUBLIC_IP: $PUBLIC_IP"
echo "  PRIVATE_IP: $PRIVATE_IP"
echo "  SIP_DOMAIN: $SIP_DOMAIN"
echo "  DB_HOST: $DB_HOST"
echo "  DB_PORT: $DB_PORT"
echo "  DB_NAME: $DB_NAME"
echo "  RTPENGINE_LIST: $RTPENGINE_LIST"

# Check if the configuration file was properly processed
if grep -q "__PUBLIC_IP__" /etc/kamailio/kamailio.cfg; then
    echo "ERROR: Configuration variables were not replaced properly!"
    exit 1
fi

kamailio -c

# Start Kamailio
echo "Starting Kamailio..."
# For now, run as root to ensure it works
exec "$@"