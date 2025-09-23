#!/bin/bash
# Deploy Kubernetes services for WARP v0.1

set -euo pipefail

echo "🚀 Deploying Kubernetes services for WARP v0.1..."

# Check kubectl is configured
if ! kubectl cluster-info &>/dev/null; then
    echo "❌ kubectl not configured. Run configure-kubectl-v01.sh first"
    exit 1
fi

echo "📦 Current cluster: $(kubectl config current-context)"

# Deploy ConfigMaps and Secrets
echo ""
echo "🔐 Creating secrets..."

# Database secret
kubectl create secret generic warp-db-credentials \
    --from-literal=username=warp \
    --from-literal=password=')T]!sXUi>SE+DeWt6a8Wmy*Q)A4q6R:}' \
    --from-literal=host=34.42.208.57 \
    --from-literal=port=5432 \
    --from-literal=database=warp \
    -n warp-core --dry-run=client -o yaml | kubectl apply -f -

# Redis secret
kubectl create secret generic warp-redis-credentials \
    --from-literal=host=10.206.200.36 \
    --from-literal=port=6379 \
    -n warp-core --dry-run=client -o yaml | kubectl apply -f -

# Deploy base services
echo ""
echo "📡 Deploying SIP services..."

# Create a basic Kamailio deployment for now
cat << 'EOF' | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: kamailio-sip
  namespace: warp-core
  labels:
    app: kamailio
spec:
  type: LoadBalancer
  ports:
  - name: sip-udp
    port: 5060
    protocol: UDP
    targetPort: 5060
  - name: sip-tcp
    port: 5060
    protocol: TCP
    targetPort: 5060
  - name: sip-tls
    port: 5061
    protocol: TCP
    targetPort: 5061
  - name: ws
    port: 8080
    protocol: TCP
    targetPort: 8080
  - name: wss
    port: 8443
    protocol: TCP
    targetPort: 8443
  selector:
    app: kamailio
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kamailio
  namespace: warp-core
  labels:
    app: kamailio
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kamailio
  template:
    metadata:
      labels:
        app: kamailio
    spec:
      containers:
      - name: kamailio
        image: kamailio/kamailio:5.7.1-alpine
        ports:
        - containerPort: 5060
          name: sip
          protocol: UDP
        - containerPort: 5060
          name: sip-tcp
          protocol: TCP
        - containerPort: 5061
          name: sip-tls
          protocol: TCP
        - containerPort: 8080
          name: ws
          protocol: TCP
        - containerPort: 8443
          name: wss
          protocol: TCP
        env:
        - name: KAM_SIP_DOMAIN
          value: "warp.io"
        - name: KAM_LISTEN
          value: "udp:0.0.0.0:5060 tcp:0.0.0.0:5060"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          exec:
            command:
            - kamctl
            - ping
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - kamctl
            - ping
          initialDelaySeconds: 10
          periodSeconds: 5
EOF

# Deploy API services
echo ""
echo "🌐 Deploying API services..."

cat << 'EOF' | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: warp-api
  namespace: warp-api
  labels:
    app: warp-api
spec:
  type: ClusterIP
  ports:
  - name: http
    port: 8080
    targetPort: 8080
  selector:
    app: warp-api
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: warp-api
  namespace: warp-api
  labels:
    app: warp-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: warp-api
  template:
    metadata:
      labels:
        app: warp-api
    spec:
      containers:
      - name: api
        image: nginx:alpine  # Placeholder - replace with actual API image
        ports:
        - containerPort: 8080
          name: http
        env:
        - name: DATABASE_HOST
          valueFrom:
            secretKeyRef:
              name: warp-db-credentials
              key: host
        - name: DATABASE_USER
          valueFrom:
            secretKeyRef:
              name: warp-db-credentials
              key: username
        - name: DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: warp-db-credentials
              key: password
        - name: REDIS_HOST
          valueFrom:
            secretKeyRef:
              name: warp-redis-credentials
              key: host
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
EOF

# Deploy Ingress
echo ""
echo "🔀 Deploying Ingress..."

cat << 'EOF' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: warp-ingress
  namespace: warp-api
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  rules:
  - host: api.warp.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: warp-api
            port:
              number: 8080
  tls:
  - hosts:
    - api.warp.io
    secretName: api-warp-io-tls
EOF

# Check deployments
echo ""
echo "📊 Checking deployment status..."
kubectl get deployments -n warp-core
kubectl get deployments -n warp-api

echo ""
echo "🔍 Services status:"
kubectl get svc -n warp-core
kubectl get svc -n warp-api

echo ""
echo "✅ Kubernetes services deployment initiated!"
echo ""
echo "📝 Next steps:"
echo "1. Wait for LoadBalancer IPs to be assigned"
echo "2. Update DNS records with the LoadBalancer IPs"
echo "3. Deploy the monitoring stack"
echo "4. Configure Homer for SIP capture"

# Get LoadBalancer IP (might take a minute)
echo ""
echo "⏳ Waiting for LoadBalancer IP..."
for i in {1..30}; do
    LB_IP=$(kubectl get svc kamailio-sip -n warp-core -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
    if [[ -n "$LB_IP" ]]; then
        echo "✅ LoadBalancer IP assigned: $LB_IP"
        echo "   Update your DNS records to point to this IP"
        break
    fi
    echo -n "."
    sleep 2
done

echo ""
echo "🎉 Deployment script complete!"