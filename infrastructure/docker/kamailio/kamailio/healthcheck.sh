#!/bin/bash
# Kamailio Health Check Script

# Check if Kamailio process is running
if ! pgrep -x "kamailio" > /dev/null; then
    echo "Kamailio process not found"
    exit 1
fi

# Check SIP OPTIONS response (basic SIP health check)
# Using kamcmd to check internal status
if command -v kamcmd &> /dev/null; then
    if ! kamcmd core.uptime > /dev/null 2>&1; then
        echo "Kamailio RPC interface not responding"
        exit 1
    fi
fi

# Check if we can connect to the database
if [ -n "$DB_HOST" ] && [ -n "$DB_PASS" ]; then
    if ! PGPASSWORD=$DB_PASS psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
        echo "Database connection failed"
        exit 1
    fi
fi

# Check if listening on SIP port
if ! netstat -ln | grep -q ":5060"; then
    echo "Not listening on SIP port 5060"
    exit 1
fi

echo "Kamailio is healthy"
exit 0