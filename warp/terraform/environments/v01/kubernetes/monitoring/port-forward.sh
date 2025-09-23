#!/bin/bash
# Port forwarding script for WARP monitoring services

echo "Starting port-forwarding for WARP monitoring services..."
echo ""
echo "Access URLs:"
echo "- Grafana: http://localhost:3000 (admin/ChangeThisPassword123!)"
echo "- Prometheus: http://localhost:9090"
echo "- AlertManager: http://localhost:9093"
echo ""
echo "Press Ctrl+C to stop port-forwarding"

# Start port-forwarding in background
kubectl port-forward -n monitoring svc/warp-monitoring-grafana 3000:80 &
GRAFANA_PID=$!

kubectl port-forward -n monitoring svc/warp-monitoring-prometheus 9090:9090 &
PROMETHEUS_PID=$!

kubectl port-forward -n monitoring svc/warp-monitoring-alertmanager 9093:9093 &
ALERTMANAGER_PID=$!

# Wait for Ctrl+C
wait

# Clean up
kill $GRAFANA_PID $PROMETHEUS_PID $ALERTMANAGER_PID 2>/dev/null