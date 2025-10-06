#!/bin/bash

# Test Cloud SQL connectivity and initialize database
set -e

echo "=== Cloud SQL Database Test and Initialization ==="
echo

# Test all users
echo "1. Testing warp_app user..."
kubectl run test-app-user --image=postgres:15 --rm -it --restart=Never -- \
  psql "postgresql://warp_app:WarpApp2024@10.126.0.3:5432/warp" \
  -c "SELECT 'warp_app connected successfully' as status, current_user;"

echo
echo "2. Testing warp user..."
kubectl run test-warp-user --image=postgres:15 --rm -it --restart=Never -- \
  psql "postgresql://warp:Warp2024@10.126.0.3:5432/warp" \
  -c "SELECT 'warp user connected successfully' as status, current_user;"

echo
echo "3. Testing with secrets..."
cat > /tmp/test-with-secret.yaml << EOF
apiVersion: v1
kind: Pod
metadata:
  name: test-secret-connection
spec:
  restartPolicy: Never
  containers:
  - name: postgres
    image: postgres:15
    envFrom:
    - secretRef:
        name: cloudsql-db-credentials
    env:
    - name: PGPASSWORD
      valueFrom:
        secretKeyRef:
          name: cloudsql-db-credentials
          key: password
    command: ["psql"]
    args: ["-h", "$(host)", "-U", "$(username)", "-d", "$(database)", "-c", "SELECT 'Secret-based connection successful' as status;"]
EOF

kubectl delete pod test-secret-connection 2>/dev/null || true
kubectl apply -f /tmp/test-with-secret.yaml
kubectl wait --for=condition=Completed pod/test-secret-connection --timeout=30s || true
kubectl logs test-secret-connection

# Grant permissions to users
echo
echo "4. Setting up database permissions..."
kubectl run setup-permissions --image=postgres:15 --rm -it --restart=Never -- \
  psql "postgresql://warp:Warp2024@10.126.0.3:5432/warp" << 'EOF'
-- Grant schema permissions
GRANT ALL PRIVILEGES ON DATABASE warp TO warp_app;
GRANT USAGE ON SCHEMA public TO warp_app;
GRANT CREATE ON SCHEMA public TO warp_app;

-- Grant permissions for read-only user
GRANT CONNECT ON DATABASE warp TO warp_readonly;
GRANT USAGE ON SCHEMA public TO warp_readonly;

-- Show current users and permissions
\du
EOF

echo
echo "=== Database is ready for schema initialization ==="
echo
echo "Connection Details:"
echo "- Host: 10.126.0.3"
echo "- Port: 5432"
echo "- Database: warp"
echo
echo "Working Users:"
echo "- warp_app / WarpApp2024 (application user)"
echo "- warp / Warp2024 (schema owner)"
echo "- warp_readonly / ReadOnly2024 (monitoring)"
echo
echo "Kubernetes Secrets:"
echo "- cloudsql-db-credentials (main app credentials)"
echo "- cloudsql-warp-credentials (warp user)"
echo "- cloudsql-readonly-credentials (read-only)"
echo
echo "Next step: Run database schema initialization"
echo "kubectl apply -f k8s-init-job.yaml"