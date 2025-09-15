#!/bin/bash

# Homer Deployment Script for GKE
# This script deploys Homer SIP capture platform on Google Kubernetes Engine

set -e

# Configuration
NAMESPACE="homer"
HOMER_VERSION="7.10"
POSTGRES_PASSWORD=$(openssl rand -base64 32)
HOMER_API_PASSWORD=$(openssl rand -base64 32)

echo "🚀 Deploying Homer SIP Capture Platform"

# Create namespace
echo "Creating namespace..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Create secrets
echo "Creating secrets..."
kubectl create secret generic homer-secrets \
  --from-literal=db-password=$POSTGRES_PASSWORD \
  --from-literal=api-password=$HOMER_API_PASSWORD \
  --namespace=$NAMESPACE \
  --dry-run=client -o yaml | kubectl apply -f -

# Deploy PostgreSQL with TimescaleDB
echo "Deploying PostgreSQL with TimescaleDB..."
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: homer-postgres
  namespace: $NAMESPACE
spec:
  ports:
  - port: 5432
    targetPort: 5432
  selector:
    app: homer-postgres
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: homer-postgres
  namespace: $NAMESPACE
spec:
  serviceName: homer-postgres
  replicas: 1
  selector:
    matchLabels:
      app: homer-postgres
  template:
    metadata:
      labels:
        app: homer-postgres
    spec:
      containers:
      - name: postgres
        image: timescale/timescaledb:2.11.0-pg15
        env:
        - name: POSTGRES_DB
          value: homer
        - name: POSTGRES_USER
          value: homer
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: homer-secrets
              key: db-password
        - name: TS_TUNE_MAX_CONNS
          value: "200"
        - name: TS_TUNE_MAX_BG_WORKERS
          value: "8"
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        - name: init-scripts
          mountPath: /docker-entrypoint-initdb.d
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
      volumes:
      - name: init-scripts
        configMap:
          name: homer-db-init
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: standard-rwo
      resources:
        requests:
          storage: 100Gi
EOF

# Create database initialization script
echo "Creating database initialization..."
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: homer-db-init
  namespace: homer
data:
  01-init.sql: |
    CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE EXTENSION IF NOT EXISTS btree_gin;
    CREATE EXTENSION IF NOT EXISTS btree_gist;
EOF

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=ready pod -l app=homer-postgres -n $NAMESPACE --timeout=300s

# Deploy Homer App
echo "Deploying Homer application..."
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: homer-app
  namespace: $NAMESPACE
spec:
  type: ClusterIP
  ports:
  - name: api
    port: 9080
    targetPort: 9080
  - name: hep
    port: 9060
    targetPort: 9060
    protocol: UDP
  selector:
    app: homer-app
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: homer-app
  namespace: $NAMESPACE
spec:
  replicas: 3
  selector:
    matchLabels:
      app: homer-app
  template:
    metadata:
      labels:
        app: homer-app
    spec:
      containers:
      - name: homer-app
        image: sipcapture/homer-app:$HOMER_VERSION
        env:
        - name: DB_HOST
          value: homer-postgres
        - name: DB_USER
          value: homer
        - name: DB_PASS
          valueFrom:
            secretKeyRef:
              name: homer-secrets
              key: db-password
        - name: HOMER_LOGLEVEL
          value: info
        - name: HOMER_TSDB
          value: "true"
        ports:
        - containerPort: 9080
          name: api
        - containerPort: 9060
          name: hep
          protocol: UDP
        - containerPort: 9096
          name: metrics
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1"
        livenessProbe:
          httpGet:
            path: /api/v3/health
            port: 9080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/v3/ready
            port: 9080
          initialDelaySeconds: 10
          periodSeconds: 5
EOF

# Deploy Homer Web UI
echo "Deploying Homer Web UI..."
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: homer-webapp
  namespace: $NAMESPACE
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 80
  selector:
    app: homer-webapp
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: homer-webapp
  namespace: $NAMESPACE
spec:
  replicas: 2
  selector:
    matchLabels:
      app: homer-webapp
  template:
    metadata:
      labels:
        app: homer-webapp
    spec:
      containers:
      - name: homer-webapp
        image: sipcapture/homer-webapp:$HOMER_VERSION
        env:
        - name: HOMER_API_URL
          value: "http://homer-app:9080"
        ports:
        - containerPort: 80
          name: http
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
EOF

# Create HEP LoadBalancer for receiving SIP captures
echo "Creating HEP LoadBalancer..."
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: homer-hep-lb
  namespace: $NAMESPACE
  annotations:
    cloud.google.com/neg: '{"ingress": false}'
spec:
  type: LoadBalancer
  loadBalancerSourceRanges:
  - 10.0.0.0/8  # Internal only - adjust as needed
  ports:
  - name: hep
    port: 9060
    targetPort: 9060
    protocol: UDP
  selector:
    app: homer-app
EOF

# Create Ingress for Web UI
echo "Creating Ingress for Web UI..."
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: homer-ingress
  namespace: $NAMESPACE
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/auth-type: basic
    nginx.ingress.kubernetes.io/auth-secret: homer-basic-auth
    nginx.ingress.kubernetes.io/auth-realm: 'Homer Authentication'
spec:
  tls:
  - hosts:
    - homer.warp.io
    secretName: homer-tls
  rules:
  - host: homer.warp.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: homer-webapp
            port:
              number: 80
EOF

# Create basic auth for web UI
echo "Creating basic authentication..."
htpasswd -bc auth admin $HOMER_API_PASSWORD
kubectl create secret generic homer-basic-auth --from-file=auth -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
rm auth

# Create ServiceMonitor for Prometheus
echo "Creating ServiceMonitor for Prometheus..."
cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: homer-metrics
  namespace: $NAMESPACE
spec:
  selector:
    matchLabels:
      app: homer-app
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
EOF

# Wait for deployments
echo "Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/homer-app -n $NAMESPACE
kubectl wait --for=condition=available --timeout=300s deployment/homer-webapp -n $NAMESPACE

# Get HEP LoadBalancer IP
echo "Getting HEP endpoint..."
HEP_IP=$(kubectl get svc homer-hep-lb -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

echo "✅ Homer deployment complete!"
echo ""
echo "📝 Important Information:"
echo "========================="
echo "Homer Web UI: https://homer.warp.io"
echo "Username: admin"
echo "Password: $HOMER_API_PASSWORD"
echo ""
echo "HEP Endpoint: $HEP_IP:9060 (UDP)"
echo ""
echo "Database Password: $POSTGRES_PASSWORD"
echo ""
echo "⚠️  Please save these credentials securely!"
echo ""
echo "📖 Next Steps:"
echo "1. Update Kamailio configuration to send HEP to: $HEP_IP:9060"
echo "2. Update RTPEngine configuration to send RTCP to: $HEP_IP:9060"
echo "3. Access Homer Web UI at: https://homer.warp.io"
echo ""
echo "For Kamailio, add to your config:"
echo "  modparam(\"siptrace\", \"duplicate_uri\", \"sip:$HEP_IP:9060\")"
echo "  modparam(\"siptrace\", \"hep_mode_on\", 1)"
echo "  modparam(\"siptrace\", \"hep_version\", 3)"