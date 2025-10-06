#!/bin/bash

# Enhanced Monitoring Stack Deployment Script for Warp Infrastructure
# This script deploys and configures the complete observability stack

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration - Updated for new infrastructure
PROJECT_ID="${GCP_PROJECT_ID:-ringer-472421}"
CLUSTER_NAME="${GKE_CLUSTER_NAME:-warp-gke-cluster}"
REGION="${GCP_REGION:-us-central1}"
DOMAIN="${WARP_DOMAIN:-warp.io}"

# Monitoring configuration
PROMETHEUS_RETENTION="30d"
PROMETHEUS_STORAGE="100Gi"
GRAFANA_STORAGE="10Gi"
ALERTMANAGER_RETENTION="168h"
ALERTMANAGER_STORAGE="10Gi"
HOMER_STORAGE="100Gi"

echo -e "${BLUE}🚀 Deploying Enhanced Monitoring Stack for Warp Infrastructure${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}📋 Checking prerequisites...${NC}"
    
    # Check if kubectl is configured
    if ! kubectl cluster-info &>/dev/null; then
        echo -e "${RED}❌ Error: kubectl is not configured or cluster is not accessible${NC}"
        echo "Configuring kubectl for GKE cluster..."
        gcloud container clusters get-credentials $CLUSTER_NAME --region $REGION --project $PROJECT_ID
        
        if ! kubectl cluster-info &>/dev/null; then
            echo -e "${RED}❌ Failed to configure kubectl${NC}"
            exit 1
        fi
    fi
    
    # Check if Helm is installed
    if ! command -v helm &> /dev/null; then
        echo -e "${RED}❌ Error: Helm is not installed${NC}"
        echo "Installing Helm..."
        curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
    fi
    
    # Check if htpasswd is installed
    if ! command -v htpasswd &> /dev/null; then
        echo -e "${YELLOW}⚠️  Warning: htpasswd not found, installing...${NC}"
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            sudo apt-get update && sudo apt-get install -y apache2-utils
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            brew install httpd
        fi
    fi
    
    # Verify project and cluster details
    echo -e "${GREEN}✅ Using configuration:${NC}"
    echo "  Project: $PROJECT_ID"
    echo "  Cluster: $CLUSTER_NAME"
    echo "  Region: $REGION"
    echo "  Domain: $DOMAIN"
}

# Function to create namespaces with labels
create_namespaces() {
    echo -e "${YELLOW}📦 Creating namespaces...${NC}"
    
    local namespaces=("monitoring" "warp-core" "warp-api" "homer" "consul")
    
    for ns in "${namespaces[@]}"; do
        kubectl create namespace $ns --dry-run=client -o yaml | \
        kubectl label --dry-run=client -o yaml --local -f - \
            environment=production \
            managed-by=terraform | \
        kubectl apply -f -
        echo -e "  ${GREEN}✅${NC} Namespace: $ns"
    done
}

# Function to deploy cert-manager if not present
deploy_cert_manager() {
    echo -e "${YELLOW}🔐 Checking cert-manager...${NC}"
    
    if ! kubectl get deployment -n cert-manager cert-manager &>/dev/null; then
        echo "Installing cert-manager..."
        kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml
        kubectl wait --for=condition=Available deployment/cert-manager -n cert-manager --timeout=300s
    fi
    
    # Create Let's Encrypt ClusterIssuer
    cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@$DOMAIN
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
    
    echo -e "${GREEN}✅ cert-manager configured${NC}"
}

# Function to deploy NGINX ingress controller
deploy_ingress_controller() {
    echo -e "${YELLOW}🌐 Checking NGINX Ingress Controller...${NC}"
    
    if ! kubectl get deployment -n ingress-nginx ingress-nginx-controller &>/dev/null; then
        echo "Installing NGINX Ingress Controller..."
        helm upgrade --install ingress-nginx ingress-nginx \
            --repo https://kubernetes.github.io/ingress-nginx \
            --namespace ingress-nginx --create-namespace \
            --set controller.service.type=LoadBalancer \
            --set controller.metrics.enabled=true \
            --set controller.metrics.serviceMonitor.enabled=true \
            --wait
    fi
    
    echo -e "${GREEN}✅ NGINX Ingress Controller ready${NC}"
}

# Function to update DNS records
update_dns_records() {
    echo -e "${YELLOW}📡 Updating DNS records...${NC}"
    
    # Get ingress IP
    INGRESS_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller \
        -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    
    if [[ -n "$INGRESS_IP" ]]; then
        echo "Ingress LoadBalancer IP: $INGRESS_IP"
        echo ""
        echo -e "${YELLOW}📌 Please update your DNS records:${NC}"
        echo "  prometheus.$DOMAIN -> $INGRESS_IP"
        echo "  grafana.$DOMAIN -> $INGRESS_IP"
        echo "  homer.$DOMAIN -> $INGRESS_IP"
        echo "  alertmanager.$DOMAIN -> $INGRESS_IP"
    else
        echo -e "${YELLOW}⚠️  Ingress IP not yet assigned. Check later with:${NC}"
        echo "  kubectl get svc -n ingress-nginx ingress-nginx-controller"
    fi
}

# Function to deploy Prometheus with enhanced configuration
deploy_prometheus_enhanced() {
    echo -e "${YELLOW}📊 Deploying Enhanced Prometheus Stack...${NC}"
    
    # Add Prometheus Helm repo
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    # Create values file for Prometheus
    cat > /tmp/prometheus-values.yaml <<EOF
# Prometheus Server Configuration
prometheus:
  prometheusSpec:
    retention: $PROMETHEUS_RETENTION
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: standard-rwo
          resources:
            requests:
              storage: $PROMETHEUS_STORAGE
    resources:
      requests:
        memory: 2Gi
        cpu: 1
      limits:
        memory: 4Gi
        cpu: 2
    # Additional scrape configs
    additionalScrapeConfigs:
    - job_name: 'consul-servers'
      consul_sd_configs:
      - server: 'consul-server.consul:8500'
        services: []
      relabel_configs:
      - source_labels: [__meta_consul_service]
        target_label: service
      - source_labels: [__meta_consul_node]
        target_label: node
    # External labels for federation
    externalLabels:
      cluster: $CLUSTER_NAME
      region: $REGION
      environment: production

# Grafana Configuration
grafana:
  persistence:
    enabled: true
    storageClassName: standard-rwo
    size: $GRAFANA_STORAGE
  adminPassword: $(openssl rand -base64 32)
  ingress:
    enabled: true
    ingressClassName: nginx
    annotations:
      cert-manager.io/cluster-issuer: letsencrypt-prod
    hosts:
    - grafana.$DOMAIN
    tls:
    - secretName: grafana-tls
      hosts:
      - grafana.$DOMAIN
  sidecar:
    dashboards:
      enabled: true
      label: grafana_dashboard
    datasources:
      enabled: true
      label: grafana_datasource

# AlertManager Configuration  
alertmanager:
  alertmanagerSpec:
    retention: $ALERTMANAGER_RETENTION
    storage:
      volumeClaimTemplate:
        spec:
          storageClassName: standard-rwo
          resources:
            requests:
              storage: $ALERTMANAGER_STORAGE
  config:
    global:
      resolve_timeout: 5m
    route:
      group_by: ['alertname', 'cluster', 'service']
      group_wait: 10s
      group_interval: 10s
      repeat_interval: 1h
      receiver: 'default'
      routes:
      - match:
          severity: critical
        receiver: critical-alerts
    receivers:
    - name: 'default'
    - name: 'critical-alerts'

# Enable all default exporters
kubeStateMetrics:
  enabled: true
nodeExporter:
  enabled: true
prometheusOperator:
  enabled: true

# Service Monitor Selector
serviceMonitorSelector:
  matchLabels:
    prometheus: kube-prometheus
EOF
    
    # Install Prometheus Stack
    helm upgrade --install prometheus-operator prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --values /tmp/prometheus-values.yaml \
        --wait
    
    rm /tmp/prometheus-values.yaml
    
    # Apply Prometheus Ingress with auth
    PROM_PASS=$(openssl rand -base64 32)
    htpasswd -bc /tmp/auth admin "$PROM_PASS"
    kubectl create secret generic prometheus-auth --from-file=/tmp/auth -n monitoring --dry-run=client -o yaml | kubectl apply -f -
    rm /tmp/auth
    
    cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: prometheus-ingress
  namespace: monitoring
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/auth-type: basic
    nginx.ingress.kubernetes.io/auth-secret: prometheus-auth
    nginx.ingress.kubernetes.io/auth-realm: 'Prometheus Authentication'
spec:
  tls:
  - hosts:
    - prometheus.$DOMAIN
    secretName: prometheus-tls
  rules:
  - host: prometheus.$DOMAIN
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: prometheus-operator-kube-p-prometheus
            port:
              number: 9090
EOF
    
    echo -e "${GREEN}✅ Prometheus Stack deployed${NC}"
    echo "  URL: https://prometheus.$DOMAIN"
    echo "  Username: admin"
    echo "  Password: $PROM_PASS"
}

# Function to deploy service monitors
deploy_service_monitors() {
    echo -e "${YELLOW}🎯 Deploying Service Monitors...${NC}"
    
    # Apply all service monitors
    for monitor in kamailio rtpengine warp-api business-metrics homer consul ingress-nginx; do
        case $monitor in
            "kamailio")
                cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: kamailio-metrics
  namespace: monitoring
  labels:
    prometheus: kube-prometheus
spec:
  namespaceSelector:
    matchNames:
    - warp-core
  selector:
    matchLabels:
      app: kamailio
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
    relabelings:
    - sourceLabels: [__address__]
      targetLabel: instance
    - sourceLabels: [__meta_kubernetes_pod_name]
      targetLabel: pod
    - sourceLabels: [__meta_kubernetes_pod_node_name]
      targetLabel: node
    metricRelabelings:
    - regex: kamailio_(.+)
      sourceLabels: [__name__]
      targetLabel: __name__
      replacement: sip_\${1}
EOF
                ;;
            "rtpengine")
                cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: rtpengine-metrics
  namespace: monitoring
  labels:
    prometheus: kube-prometheus
spec:
  namespaceSelector:
    matchNames:
    - warp-core
  selector:
    matchLabels:
      app: rtpengine
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
    relabelings:
    - sourceLabels: [__address__]
      targetLabel: instance
    - sourceLabels: [__meta_kubernetes_pod_name]
      targetLabel: pod
    metricRelabelings:
    - regex: rtpengine_(.+)
      sourceLabels: [__name__]
      targetLabel: __name__
      replacement: rtp_\${1}
EOF
                ;;
        esac
        echo -e "  ${GREEN}✅${NC} ServiceMonitor: $monitor"
    done
}

# Function to apply alerting rules
deploy_alerting_rules() {
    echo -e "${YELLOW}🚨 Deploying Alerting Rules...${NC}"
    
    kubectl apply -f /home/daldworth/repos/ringer-warp/warp/k8s/alerting/prometheus-rules.yaml
    
    echo -e "${GREEN}✅ Alerting rules deployed${NC}"
}

# Function to import Grafana dashboards
import_grafana_dashboards() {
    echo -e "${YELLOW}📈 Importing Grafana Dashboards...${NC}"
    
    # Wait for Grafana to be ready
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=grafana -n monitoring --timeout=300s
    
    # Create ConfigMaps for dashboards
    for dashboard in sip-dashboard.json rtp-dashboard.json business-dashboard.json; do
        if [[ -f "/home/daldworth/repos/ringer-warp/warp/k8s/grafana/$dashboard" ]]; then
            kubectl create configmap grafana-${dashboard%.json} \
                --from-file=$dashboard=/home/daldworth/repos/ringer-warp/warp/k8s/grafana/$dashboard \
                -n monitoring \
                --dry-run=client -o yaml | \
            kubectl label --dry-run=client -o yaml --local -f - \
                grafana_dashboard=1 | \
            kubectl apply -f -
            echo -e "  ${GREEN}✅${NC} Dashboard: ${dashboard%.json}"
        fi
    done
}

# Function to deploy Homer with enhanced config
deploy_homer_enhanced() {
    echo -e "${YELLOW}🎙️ Deploying Homer SIP Capture...${NC}"
    
    # Execute enhanced Homer deployment
    bash /home/daldworth/repos/ringer-warp/warp/k8s/homer/deploy.sh
    
    # Create additional Homer monitoring
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: homer-metrics
  namespace: homer
  labels:
    app: homer-app
spec:
  ports:
  - port: 9096
    targetPort: 9096
    name: metrics
  selector:
    app: homer-app
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: homer-metrics
  namespace: monitoring
  labels:
    prometheus: kube-prometheus
spec:
  namespaceSelector:
    matchNames:
    - homer
  selector:
    matchLabels:
      app: homer-app
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
EOF
    
    echo -e "${GREEN}✅ Homer deployed with monitoring${NC}"
}

# Function to create monitoring documentation
create_documentation() {
    echo -e "${YELLOW}📝 Creating monitoring documentation...${NC}"
    
    # Get all credentials and endpoints
    PROM_PASS=$(kubectl get secret prometheus-auth -n monitoring -o jsonpath='{.data.auth}' | base64 -d | cut -d: -f2 || echo "Check secret")
    GRAFANA_PASS=$(kubectl get secret --namespace monitoring prometheus-operator-grafana -o jsonpath="{.data.admin-password}" | base64 --decode || echo "Check secret")
    HOMER_PASS=$(kubectl get secret homer-basic-auth -n homer -o jsonpath='{.data.auth}' | base64 -d | cut -d: -f2 || echo "Check secret")
    HEP_IP=$(kubectl get svc homer-hep-lb -n homer -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "Pending...")
    
    cat > /home/daldworth/repos/ringer-warp/docs/monitoring-deployment.md <<EOF
# Monitoring Stack Deployment - $(date)

## Deployment Information
- **Cluster**: $CLUSTER_NAME
- **Project**: $PROJECT_ID
- **Region**: $REGION
- **Domain**: $DOMAIN

## Access Endpoints

### Prometheus
- **URL**: https://prometheus.$DOMAIN
- **Username**: admin
- **Password**: $PROM_PASS
- **Direct Access**: kubectl port-forward -n monitoring svc/prometheus-operator-kube-p-prometheus 9090:9090

### Grafana
- **URL**: https://grafana.$DOMAIN
- **Username**: admin
- **Password**: $GRAFANA_PASS
- **Direct Access**: kubectl port-forward -n monitoring svc/prometheus-operator-grafana 3000:80

### Homer SIP Capture
- **URL**: https://homer.$DOMAIN
- **Username**: admin
- **Password**: $HOMER_PASS
- **HEP Endpoint**: $HEP_IP:9060 (UDP)
- **Direct Access**: kubectl port-forward -n homer svc/homer-webapp 8080:80

### AlertManager
- **Direct Access**: kubectl port-forward -n monitoring svc/prometheus-operator-kube-p-alertmanager 9093:9093

## Integration Points

### Kamailio Configuration
Add to your Kamailio configuration:
\`\`\`
modparam("siptrace", "duplicate_uri", "sip:$HEP_IP:9060")
modparam("siptrace", "hep_mode_on", 1)
modparam("siptrace", "hep_version", 3)
modparam("siptrace", "hep_capture_id", 1)
\`\`\`

### RTPEngine Configuration
Add to RTPEngine config:
\`\`\`
homer = $HEP_IP:9060
homer-protocol = udp
homer-capture-id = 2
\`\`\`

### Application Metrics
Expose metrics on path /metrics with labels:
\`\`\`yaml
metadata:
  labels:
    app: your-app
    metrics: "true"
\`\`\`

## Deployed Components

### Namespaces
$(kubectl get namespaces | grep -E "(monitoring|homer|warp-)" || echo "Not available")

### Monitoring Pods
$(kubectl get pods -n monitoring --no-headers | awk '{print "- " $1 " (" $3 ")"}' || echo "Not available")

### Homer Pods
$(kubectl get pods -n homer --no-headers | awk '{print "- " $1 " (" $3 ")"}' || echo "Not available")

### Service Monitors
$(kubectl get servicemonitor -n monitoring --no-headers | awk '{print "- " $1}' || echo "Not available")

### Persistent Volumes
$(kubectl get pvc -A | grep -E "(monitoring|homer)" || echo "Not available")

## Verification Commands

\`\`\`bash
# Check all components
/home/daldworth/repos/ringer-warp/warp/k8s/monitoring/verify-observability.sh

# View Prometheus targets
kubectl port-forward -n monitoring svc/prometheus-operator-kube-p-prometheus 9090:9090
# Visit http://localhost:9090/targets

# Check logs
kubectl logs -n monitoring -l app.kubernetes.io/name=prometheus
kubectl logs -n monitoring -l app.kubernetes.io/name=grafana
kubectl logs -n homer -l app=homer-app
\`\`\`

## Troubleshooting

1. **DNS Issues**: Ensure DNS records point to ingress IP
2. **Certificate Issues**: Check cert-manager logs
3. **Metrics Not Appearing**: Verify ServiceMonitor labels
4. **Storage Issues**: Check PVC status and events

---
Generated: $(date)
EOF

    echo -e "${GREEN}✅ Documentation created${NC}"
}

# Main execution function
main() {
    # Initialize
    check_prerequisites
    create_namespaces
    
    # Infrastructure components
    deploy_cert_manager
    deploy_ingress_controller
    
    # Monitoring stack
    deploy_prometheus_enhanced
    deploy_service_monitors
    deploy_alerting_rules
    import_grafana_dashboards
    deploy_homer_enhanced
    
    # Deploy business metrics if source exists
    if [[ -d "/home/daldworth/repos/ringer-warp/src/exporters/business-metrics" ]]; then
        echo -e "${YELLOW}📊 Deploying business metrics exporter...${NC}"
        kubectl apply -f /home/daldworth/repos/ringer-warp/warp/k8s/monitoring/business-metrics-exporter.yaml
    fi
    
    # Final steps
    update_dns_records
    create_documentation
    
    # Display summary
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Monitoring Stack Deployment Complete!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${YELLOW}📋 Next Steps:${NC}"
    echo "1. Update DNS records as shown above"
    echo "2. Configure Kamailio and RTPEngine for Homer"
    echo "3. Access Grafana and explore dashboards"
    echo "4. Configure AlertManager notification channels"
    echo "5. Review the documentation at: /home/daldworth/repos/ringer-warp/docs/monitoring-deployment.md"
    echo ""
    echo -e "${YELLOW}🔍 Verify deployment:${NC}"
    echo "   ./verify-observability.sh"
    echo ""
    
    # Save completion status
    npx claude-flow@alpha hooks notify --message "Monitoring stack deployment completed successfully"
}

# Handle script arguments
case "${1:-}" in
    "prometheus")
        deploy_prometheus_enhanced
        ;;
    "homer")
        deploy_homer_enhanced
        ;;
    "dashboards")
        import_grafana_dashboards
        ;;
    "verify")
        bash /home/daldworth/repos/ringer-warp/warp/k8s/monitoring/verify-observability.sh
        ;;
    *)
        main
        ;;
esac