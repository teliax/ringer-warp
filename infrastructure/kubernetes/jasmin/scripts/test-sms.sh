#!/bin/bash
# Test SMS sending through Jasmin HTTP API

set -e

# Default values
API_URL="${SMS_API_URL:-http://localhost:8080}"
API_USER="${SMS_API_USER:-api-user}"
API_PASS="${SMS_API_PASS:-api-password}"

# Function to send SMS
send_sms() {
    local to="$1"
    local from="${2:-12345}"
    local message="$3"
    
    echo "Sending SMS:"
    echo "  From: $from"
    echo "  To: $to"
    echo "  Message: $message"
    echo
    
    # Send via HTTP API
    response=$(curl -s -w "\n%{http_code}" -X POST \
        -u "$API_USER:$API_PASS" \
        --data-urlencode "to=$to" \
        --data-urlencode "from=$from" \
        --data-urlencode "content=$message" \
        "$API_URL/send")
    
    # Extract response body and status code
    body=$(echo "$response" | sed '$d')
    status=$(echo "$response" | tail -n1)
    
    echo "Response (HTTP $status):"
    echo "$body"
    echo
    
    if [ "$status" -eq 200 ]; then
        echo "✓ SMS sent successfully"
        
        # Extract message ID if present
        message_id=$(echo "$body" | grep -oP '"message_id"\s*:\s*"\K[^"]+' || true)
        if [ -n "$message_id" ]; then
            echo "  Message ID: $message_id"
        fi
    else
        echo "✗ Failed to send SMS"
        exit 1
    fi
}

# Function to check message status
check_status() {
    local message_id="$1"
    
    echo "Checking status for message: $message_id"
    
    response=$(curl -s -w "\n%{http_code}" -X GET \
        -u "$API_USER:$API_PASS" \
        "$API_URL/status/$message_id")
    
    body=$(echo "$response" | sed '$d')
    status=$(echo "$response" | tail -n1)
    
    echo "Response (HTTP $status):"
    echo "$body"
    echo
}

# Function to check balance
check_balance() {
    echo "Checking account balance..."
    
    response=$(curl -s -w "\n%{http_code}" -X GET \
        -u "$API_USER:$API_PASS" \
        "$API_URL/balance")
    
    body=$(echo "$response" | sed '$d')
    status=$(echo "$response" | tail -n1)
    
    echo "Response (HTTP $status):"
    echo "$body"
    echo
}

# Main script
case "${1:-help}" in
    send)
        if [ $# -lt 3 ]; then
            echo "Usage: $0 send <to> <message> [from]"
            exit 1
        fi
        send_sms "$2" "${4:-12345}" "$3"
        ;;
        
    status)
        if [ $# -lt 2 ]; then
            echo "Usage: $0 status <message_id>"
            exit 1
        fi
        check_status "$2"
        ;;
        
    balance)
        check_balance
        ;;
        
    test)
        # Send a test message
        to="${2:-+1234567890}"
        message="${3:-Test message from Jasmin SMSC at $(date)}"
        send_sms "$to" "12345" "$message"
        ;;
        
    bulk)
        # Send bulk test messages
        count="${2:-10}"
        to="${3:-+1234567890}"
        
        echo "Sending $count test messages to $to"
        for i in $(seq 1 "$count"); do
            message="Bulk test message $i of $count at $(date +%H:%M:%S)"
            send_sms "$to" "12345" "$message"
            sleep 1
        done
        ;;
        
    help|*)
        echo "Jasmin SMS Testing Script"
        echo
        echo "Usage:"
        echo "  $0 send <to> <message> [from]    - Send an SMS"
        echo "  $0 status <message_id>            - Check message status"
        echo "  $0 balance                        - Check account balance"
        echo "  $0 test [to] [message]            - Send a test message"
        echo "  $0 bulk [count] [to]              - Send bulk test messages"
        echo
        echo "Environment variables:"
        echo "  SMS_API_URL   - Jasmin HTTP API URL (default: http://localhost:8080)"
        echo "  SMS_API_USER  - API username (default: api-user)"
        echo "  SMS_API_PASS  - API password (default: api-password)"
        echo
        echo "Examples:"
        echo "  $0 send +1234567890 'Hello from Jasmin'"
        echo "  $0 send +1234567890 'Hello' 54321"
        echo "  $0 status abc123def456"
        echo "  $0 test"
        echo "  $0 bulk 5 +1234567890"
        ;;
esac