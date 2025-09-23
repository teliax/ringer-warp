#!/bin/bash

# DNS Configuration for Ringer Platform
# This file contains all DNS-related configuration

# Service LoadBalancer IPs
declare -A SERVICE_IPS=(
    ["kamailio"]="35.188.144.139"
    ["api"]="34.41.135.92"
    ["prometheus"]="35.224.246.74"
    ["grafana"]="35.224.100.108"
    ["homer"]="35.223.187.94"
)

# DNS Settings
DOMAIN_PROD="ringer.tel"
DOMAIN_STAGING="ringer.net"  # If available
TTL_DYNAMIC=300   # 5 minutes for services that might change
TTL_STABLE=3600   # 1 hour for stable services

# Subdomain mappings
declare -A SUBDOMAINS=(
    ["kamailio"]="sip"
    ["api"]="api-v2"
    ["prometheus"]="prometheus"
    ["grafana"]="grafana"
    ["homer"]="homer"
)

# SIP SRV Records configuration
SRV_PRIORITY=10
SRV_WEIGHT=100
SRV_PORT_UDP=5060
SRV_PORT_TCP=5060
SRV_PORT_TLS=5061

# Environment detection
detect_environment() {
    # Check if we're in staging or production based on context
    if [[ "${ENVIRONMENT:-}" == "staging" ]]; then
        echo "staging"
    else
        echo "production"
    fi
}

# Get domain based on environment
get_domain() {
    local env=$(detect_environment)
    if [[ "$env" == "staging" ]] && [[ -n "$DOMAIN_STAGING" ]]; then
        echo "$DOMAIN_STAGING"
    else
        echo "$DOMAIN_PROD"
    fi
}

# Export functions and variables for use in other scripts
export SERVICE_IPS
export SUBDOMAINS
export TTL_DYNAMIC
export TTL_STABLE
export SRV_PRIORITY
export SRV_WEIGHT
export SRV_PORT_UDP
export SRV_PORT_TCP
export SRV_PORT_TLS