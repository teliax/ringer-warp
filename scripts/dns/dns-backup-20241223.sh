#!/bin/bash

# DNS Configuration Backup - December 23, 2024
# This file contains the LoadBalancer IPs before migration to NGINX Ingress

# IMPORTANT: These are the original LoadBalancer IPs before migration
# Keep this file for rollback purposes

# Service LoadBalancer IPs (BEFORE MIGRATION)
declare -A OLD_SERVICE_IPS=(
    ["kamailio"]="35.188.144.139"
    ["api"]="34.41.135.92"
    ["prometheus"]="35.224.246.74"    # Old LoadBalancer IP
    ["grafana"]="35.224.100.108"      # Old LoadBalancer IP
    ["homer"]="35.223.187.94"         # Old LoadBalancer IP
)

# NGINX Ingress Controller IP
NGINX_INGRESS_IP="34.72.20.183"

# Services to migrate to NGINX Ingress
declare -A SERVICES_TO_MIGRATE=(
    ["grafana"]="35.224.100.108"      # grafana.ringer.tel
    ["prometheus"]="35.224.246.74"    # prometheus.ringer.tel
    ["homer"]="35.223.187.94"         # homer.ringer.tel
)

echo "=== DNS Migration Backup ==="
echo "Date: $(date)"
echo ""
echo "Services to migrate to NGINX Ingress (${NGINX_INGRESS_IP}):"
echo "  grafana.ringer.tel: ${SERVICES_TO_MIGRATE[grafana]} -> ${NGINX_INGRESS_IP}"
echo "  prometheus.ringer.tel: ${SERVICES_TO_MIGRATE[prometheus]} -> ${NGINX_INGRESS_IP}"
echo "  homer.ringer.tel: ${SERVICES_TO_MIGRATE[homer]} -> ${NGINX_INGRESS_IP}"
echo ""
echo "Services remaining on LoadBalancers:"
echo "  sip.ringer.tel: ${OLD_SERVICE_IPS[kamailio]}"
echo "  api-v2.ringer.tel: ${OLD_SERVICE_IPS[api]}"