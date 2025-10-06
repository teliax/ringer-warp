#!/bin/bash

# Import Grafana Dashboards Script
# This script imports custom dashboards into Grafana

set -e

# Configuration
NAMESPACE="monitoring"
DASHBOARDS_DIR="/home/daldworth/repos/ringer-warp/warp/k8s/grafana"

echo "🎨 Importing Grafana Dashboards"

# Wait for Grafana to be ready
echo "Waiting for Grafana to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=grafana -n $NAMESPACE --timeout=300s

# Get Grafana admin password
GRAFANA_PASSWORD=$(kubectl get secret --namespace $NAMESPACE prometheus-operator-grafana -o jsonpath="{.data.admin-password}" | base64 --decode)

# Port forward to Grafana
echo "Setting up port forwarding to Grafana..."
kubectl port-forward -n $NAMESPACE svc/prometheus-operator-grafana 3000:80 &
PF_PID=$!
sleep 5

# Function to import a dashboard
import_dashboard() {
    local dashboard_file=$1
    local dashboard_name=$(basename $dashboard_file .json)
    
    echo "Importing dashboard: $dashboard_name"
    
    # Create dashboard import payload
    cat > /tmp/import-${dashboard_name}.json <<EOF
{
  "dashboard": $(cat $dashboard_file | jq '.dashboard'),
  "overwrite": true,
  "inputs": [
    {
      "name": "DS_PROMETHEUS",
      "type": "datasource",
      "pluginId": "prometheus",
      "value": "Prometheus"
    }
  ]
}
EOF
    
    # Import dashboard via API
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -u "admin:${GRAFANA_PASSWORD}" \
        -d @/tmp/import-${dashboard_name}.json \
        http://localhost:3000/api/dashboards/import
    
    rm /tmp/import-${dashboard_name}.json
    echo "✅ Dashboard $dashboard_name imported successfully"
}

# Import all dashboards
for dashboard in $DASHBOARDS_DIR/*.json; do
    if [[ -f "$dashboard" ]]; then
        import_dashboard "$dashboard"
    fi
done

# Create datasource if not exists
echo "Configuring Prometheus datasource..."
cat > /tmp/prometheus-datasource.json <<EOF
{
  "name": "Prometheus",
  "type": "prometheus",
  "url": "http://prometheus-operator-kube-p-prometheus:9090",
  "access": "proxy",
  "isDefault": true
}
EOF

curl -s -X POST \
    -H "Content-Type: application/json" \
    -u "admin:${GRAFANA_PASSWORD}" \
    -d @/tmp/prometheus-datasource.json \
    http://localhost:3000/api/datasources

rm /tmp/prometheus-datasource.json

# Clean up port forward
kill $PF_PID

echo "✅ All dashboards imported successfully!"
echo ""
echo "📊 Available Dashboards:"
echo "- SIP Infrastructure Monitoring"
echo "- RTP Media Monitoring"
echo "- Business Metrics Dashboard"
echo ""
echo "Access Grafana at: https://grafana.warp.io"