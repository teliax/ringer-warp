#!/bin/bash
# Deploy monitoring stack for WARP v0.1

set -euo pipefail

# Add helm to PATH
export PATH=$PATH:~/bin

echo "📊 Deploying monitoring stack for WARP v0.1..."

# Install Prometheus Operator using Helm
echo "📦 Installing Prometheus Operator..."

# Add helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack
helm install prometheus-operator prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=standard \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=10Gi \
  --set alertmanager.alertmanagerSpec.storage.volumeClaimTemplate.spec.storageClassName=standard \
  --set alertmanager.alertmanagerSpec.storage.volumeClaimTemplate.spec.resources.requests.storage=5Gi \
  --set grafana.persistence.enabled=true \
  --set grafana.persistence.storageClassName=standard \
  --set grafana.persistence.size=5Gi \
  --set grafana.adminPassword=warp-grafana-2024 \
  --wait

echo "✅ Prometheus Operator installed"

# Create ServiceMonitors for our services
echo "📈 Creating ServiceMonitors..."

cat << 'EOF' | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: kamailio-metrics
  namespace: monitoring
  labels:
    app: kamailio
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
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: warp-api-metrics
  namespace: monitoring
  labels:
    app: warp-api
    prometheus: kube-prometheus
spec:
  namespaceSelector:
    matchNames:
    - warp-api
  selector:
    matchLabels:
      app: warp-api
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
EOF

# Expose Grafana
echo "🎨 Exposing Grafana..."
kubectl patch svc prometheus-operator-grafana -n monitoring -p '{"spec": {"type": "LoadBalancer"}}'

# Wait for LoadBalancer
echo "⏳ Waiting for Grafana LoadBalancer IP..."
for i in {1..30}; do
    GRAFANA_IP=$(kubectl get svc prometheus-operator-grafana -n monitoring -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
    if [[ -n "$GRAFANA_IP" ]]; then
        echo "✅ Grafana accessible at: http://$GRAFANA_IP"
        echo "   Username: admin"
        echo "   Password: warp-grafana-2024"
        break
    fi
    echo -n "."
    sleep 2
done

# Port forwards for local access
echo ""
echo "📡 Setting up local access (keep this terminal open):"
echo ""
echo "Prometheus: kubectl port-forward -n monitoring svc/prometheus-operator-kube-p-prometheus 9090:9090"
echo "Grafana: kubectl port-forward -n monitoring svc/prometheus-operator-grafana 3000:80"
echo "AlertManager: kubectl port-forward -n monitoring svc/prometheus-operator-kube-p-alertmanager 9093:9093"

echo ""
echo "✅ Monitoring stack deployed!"