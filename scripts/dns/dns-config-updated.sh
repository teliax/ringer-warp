#!/bin/bash

# DNS Configuration for Ringer Platform (Updated with current LoadBalancer IPs)
# This file contains all DNS-related configuration

# Service LoadBalancer IPs - Updated from cluster
declare -A SERVICE_IPS=(
    ["kamailio-tcp-v01"]="34.72.244.248"   # ringer-warp-v01 namespace
    ["kamailio-udp-v01"]="35.188.57.164"   # ringer-warp-v01 namespace
    ["kamailio-tcp-core"]="34.41.176.225"  # warp-core namespace
    ["kamailio-udp-core"]="34.61.253.247"  # warp-core namespace
    # Placeholders for other services - need to be discovered
    ["api"]=""                              # API Gateway
    ["prometheus"]=""                       # Monitoring
    ["grafana"]=""                          # Monitoring
    ["homer"]=""                            # SIP monitoring
)

# DNS Settings
DOMAIN_PROD="ringer.tel"
DOMAIN_STAGING="ringer.net"  # If available
TTL_DYNAMIC=300   # 5 minutes for services that might change
TTL_STABLE=3600   # 1 hour for stable services

# Subdomain mappings
declare -A SUBDOMAINS=(
    ["kamailio-tcp-v01"]="sip-tcp-v01"
    ["kamailio-udp-v01"]="sip-udp-v01"
    ["kamailio-tcp-core"]="sip-tcp"
    ["kamailio-udp-core"]="sip-udp"
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