#!/bin/bash

# Prometheus Deployment Script for GKE
# This script deploys Prometheus Operator and monitoring stack

set -e

# Configuration
NAMESPACE="monitoring"
PROMETHEUS_OPERATOR_VERSION="v0.68.0"

echo "🚀 Deploying Prometheus Monitoring Stack"

# Check if GKE cluster is ready
echo "Checking GKE cluster status..."
if ! kubectl cluster-info &>/dev/null; then
    echo "❌ Error: Cannot connect to Kubernetes cluster"
    echo "Please ensure your kubeconfig is set up correctly"
    exit 1
fi

# Create namespace
echo "Creating monitoring namespace..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Add Prometheus Operator Helm repo
echo "Adding Prometheus Operator Helm repository..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install Prometheus Operator using Helm
echo "Installing Prometheus Operator..."
helm upgrade --install prometheus-operator prometheus-community/kube-prometheus-stack \
  --namespace $NAMESPACE \
  --version 51.3.0 \
  --set prometheus.prometheusSpec.retention=30d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=standard-rwo \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=100Gi \
  --set prometheus.prometheusSpec.resources.requests.memory=2Gi \
  --set prometheus.prometheusSpec.resources.requests.cpu=1 \
  --set prometheus.prometheusSpec.resources.limits.memory=4Gi \
  --set prometheus.prometheusSpec.resources.limits.cpu=2 \
  --set grafana.persistence.enabled=true \
  --set grafana.persistence.storageClassName=standard-rwo \
  --set grafana.persistence.size=10Gi \
  --set alertmanager.alertmanagerSpec.retention=168h \
  --set alertmanager.alertmanagerSpec.storage.volumeClaimTemplate.spec.storageClassName=standard-rwo \
  --set alertmanager.alertmanagerSpec.storage.volumeClaimTemplate.spec.resources.requests.storage=10Gi \
  --wait

echo "✅ Prometheus Operator installed successfully"

# Create ServiceMonitors for Kamailio
echo "Creating ServiceMonitor for Kamailio..."
cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: kamailio-metrics
  namespace: $NAMESPACE
  labels:
    release: prometheus-operator
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

# Create ServiceMonitor for RTPEngine
echo "Creating ServiceMonitor for RTPEngine..."
cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: rtpengine-metrics
  namespace: $NAMESPACE
  labels:
    release: prometheus-operator
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

# Create ServiceMonitor for API Services
echo "Creating ServiceMonitor for API services..."
cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: warp-api-metrics
  namespace: $NAMESPACE
  labels:
    release: prometheus-operator
spec:
  namespaceSelector:
    matchNames:
    - warp-api
  selector:
    matchLabels:
      metrics: "true"
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
    relabelings:
    - sourceLabels: [__meta_kubernetes_service_name]
      targetLabel: service
    - sourceLabels: [__meta_kubernetes_namespace]
      targetLabel: namespace
EOF

# Create ServiceMonitor for Business Metrics
echo "Creating ServiceMonitor for business metrics..."
cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: business-metrics
  namespace: $NAMESPACE
  labels:
    release: prometheus-operator
spec:
  namespaceSelector:
    matchNames:
    - warp-api
  selector:
    matchLabels:
      app: business-metrics-exporter
  endpoints:
  - port: metrics
    interval: 60s
    path: /metrics
    relabelings:
    - sourceLabels: [__meta_kubernetes_service_name]
      targetLabel: service
EOF

# Create ServiceMonitor for Homer
echo "Creating ServiceMonitor for Homer..."
cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: homer-metrics
  namespace: $NAMESPACE
  labels:
    release: prometheus-operator
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

# Create ServiceMonitor for Consul
echo "Creating ServiceMonitor for Consul..."
cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: consul-metrics
  namespace: $NAMESPACE
  labels:
    release: prometheus-operator
spec:
  namespaceSelector:
    matchNames:
    - consul
  selector:
    matchLabels:
      app: consul
  endpoints:
  - port: metrics
    interval: 30s
    path: /v1/agent/metrics
    params:
      format: ["prometheus"]
EOF

# Create Prometheus Ingress
echo "Creating Prometheus Ingress..."
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: prometheus-ingress
  namespace: $NAMESPACE
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/auth-type: basic
    nginx.ingress.kubernetes.io/auth-secret: prometheus-auth
    nginx.ingress.kubernetes.io/auth-realm: 'Prometheus Authentication'
spec:
  tls:
  - hosts:
    - prometheus.warp.io
    secretName: prometheus-tls
  rules:
  - host: prometheus.warp.io
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

# Create Grafana Ingress
echo "Creating Grafana Ingress..."
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: grafana-ingress
  namespace: $NAMESPACE
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - grafana.warp.io
    secretName: grafana-tls
  rules:
  - host: grafana.warp.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: prometheus-operator-grafana
            port:
              number: 80
EOF

# Create basic auth for Prometheus
echo "Creating basic authentication for Prometheus..."
PROMETHEUS_PASSWORD=$(openssl rand -base64 32)
htpasswd -bc auth admin $PROMETHEUS_PASSWORD
kubectl create secret generic prometheus-auth --from-file=auth -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
rm auth

# Get Grafana admin password
echo "Getting Grafana admin password..."
GRAFANA_PASSWORD=$(kubectl get secret --namespace $NAMESPACE prometheus-operator-grafana -o jsonpath="{.data.admin-password}" | base64 --decode)

echo "✅ Monitoring stack deployment complete!"
echo ""
echo "📝 Access Information:"
echo "====================="
echo "Prometheus: https://prometheus.warp.io"
echo "  Username: admin"
echo "  Password: $PROMETHEUS_PASSWORD"
echo ""
echo "Grafana: https://grafana.warp.io"
echo "  Username: admin"
echo "  Password: $GRAFANA_PASSWORD"
echo ""
echo "AlertManager: kubectl port-forward -n $NAMESPACE svc/prometheus-operator-kube-p-alertmanager 9093:9093"
echo ""
echo "⚠️  Please save these credentials securely!"