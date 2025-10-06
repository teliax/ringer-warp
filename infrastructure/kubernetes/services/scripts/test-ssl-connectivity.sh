#!/bin/bash

LOADBALANCER_IP="34.72.20.183"

echo "SSL/TLS Connectivity Test"
echo "========================="
echo ""
echo "LoadBalancer IP: $LOADBALANCER_IP"
echo ""

# Function to test SSL connection
test_ssl() {
    local domain=$1
    local ip=$2
    
    echo "Testing $domain..."
    echo "-----------------"
    
    # Test HTTPS connectivity
    if curl -k -I https://$ip -H "Host: $domain" --connect-timeout 5 -s | head -1 | grep -q "HTTP"; then
        echo "✓ HTTPS connection successful"
        
        # Get certificate details
        cert_info=$(echo | openssl s_client -servername $domain -connect $ip:443 2>/dev/null | openssl x509 -noout -issuer -subject -dates 2>/dev/null)
        
        if [ $? -eq 0 ]; then
            echo "$cert_info" | grep "issuer=" | sed 's/issuer=/  Issuer: /'
            echo "$cert_info" | grep "subject=" | sed 's/subject=/  Subject: /'
            echo "$cert_info" | grep "notBefore=" | sed 's/notBefore=/  Valid from: /'
            echo "$cert_info" | grep "notAfter=" | sed 's/notAfter=/  Valid until: /'
            
            # Check if it's staging or production
            if echo "$cert_info" | grep -q "STAGING"; then
                echo "  ⚠️  Using STAGING certificate"
            else
                echo "  ✓ Using PRODUCTION certificate"
            fi
        else
            echo "  ⚠️  Could not retrieve certificate details"
        fi
        
        # Test HTTP to HTTPS redirect
        redirect_test=$(curl -I http://$ip -H "Host: $domain" --connect-timeout 5 -s 2>/dev/null | head -1)
        if echo "$redirect_test" | grep -q "301\|302\|308"; then
            echo "  ✓ HTTP → HTTPS redirect working"
        else
            echo "  ⚠️  HTTP → HTTPS redirect not configured"
        fi
    else
        echo "✗ HTTPS connection failed"
    fi
    
    echo ""
}

# Test each domain
for domain in grafana.ringer.tel prometheus.ringer.tel api-v2.ringer.tel; do
    test_ssl $domain $LOADBALANCER_IP
done

echo "DNS Status:"
echo "-----------"
for domain in grafana.ringer.tel prometheus.ringer.tel api-v2.ringer.tel; do
    current_ip=$(nslookup $domain 2>/dev/null | grep -A1 "Name:" | grep "Address:" | awk '{print $2}')
    if [ "$current_ip" == "$LOADBALANCER_IP" ]; then
        echo "✓ $domain → $current_ip (correct)"
    else
        echo "✗ $domain → $current_ip (should be $LOADBALANCER_IP)"
    fi
done