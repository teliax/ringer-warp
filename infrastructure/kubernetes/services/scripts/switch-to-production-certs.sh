#!/bin/bash

echo "Switching ingresses to production Let's Encrypt certificates..."

# Update Grafana ingress
echo "Updating Grafana ingress..."
kubectl patch ingress grafana-ingress -n monitoring --type='json' -p='[
  {"op": "replace", "path": "/metadata/annotations/cert-manager.io~1cluster-issuer", "value": "letsencrypt-production-http01"}
]'

# Update Prometheus ingress
echo "Updating Prometheus ingress..."
kubectl patch ingress prometheus-ingress -n monitoring --type='json' -p='[
  {"op": "replace", "path": "/metadata/annotations/cert-manager.io~1cluster-issuer", "value": "letsencrypt-production-http01"}
]'

# Update API Gateway ingress
echo "Updating API Gateway ingress..."
kubectl patch ingress api-gateway-ingress -n default --type='json' -p='[
  {"op": "replace", "path": "/metadata/annotations/cert-manager.io~1cluster-issuer", "value": "letsencrypt-production-http01"}
]'

echo ""
echo "Certificates will be reissued. Monitor with:"
echo "kubectl get certificates -A -w"
echo ""
echo "Note: DNS must point to 34.72.20.183 for certificate validation to work!"