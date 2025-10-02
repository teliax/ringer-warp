#!/bin/bash
# Fix Jasmin SMSC RabbitMQ Authentication Issue
# Root cause: Missing RABBITMQ_USERNAME environment variable

set -e

NAMESPACE="messaging"

echo "🔧 Fixing Jasmin SMSC RabbitMQ Authentication"
echo "=============================================="
echo ""

# Check RabbitMQ users
echo "🐰 Checking RabbitMQ users..."
RABBITMQ_POD=$(kubectl get pod -n $NAMESPACE -l app=rabbitmq -o jsonpath='{.items[0].metadata.name}')

if [ -z "$RABBITMQ_POD" ]; then
    echo "❌ RabbitMQ pod not found"
    exit 1
fi

echo "✅ Found RabbitMQ pod: $RABBITMQ_POD"
echo ""

echo "📋 Current RabbitMQ users:"
kubectl exec -n $NAMESPACE $RABBITMQ_POD -- rabbitmqctl list_users

echo ""
echo "💡 Root Cause:"
echo "   Jasmin config uses RABBITMQ_PASSWORD but missing RABBITMQ_USERNAME"
echo "   RabbitMQ has user 'jasmin' but Jasmin isn't configured with username"
echo ""

# Check if jasmin-config ConfigMap exists
if ! kubectl get configmap -n $NAMESPACE jasmin-config &>/dev/null; then
    echo "❌ jasmin-config ConfigMap not found"
    echo "   Need to create it from kubernetes/jasmin/configmaps/"
    exit 1
fi

echo "🔍 Checking Jasmin deployment environment variables..."
kubectl get deployment -n $NAMESPACE jasmin-smsc -o yaml | grep -A 30 "env:" | grep -E "RABBITMQ|REDIS"

echo ""
echo "📝 Solution: Update Jasmin deployment to include RABBITMQ_USERNAME"
echo ""

# Create patch file
cat > /tmp/jasmin-rabbitmq-fix.yaml <<'EOF'
spec:
  template:
    spec:
      initContainers:
      - name: init-config
        env:
        - name: RABBITMQ_USERNAME
          value: "jasmin"
        - name: RABBITMQ_PASSWORD
          valueFrom:
            secretKeyRef:
              name: rabbitmq-credentials
              key: password
        - name: REDIS_HOST
          value: "redis-service"
        - name: REDIS_PORT
          value: "6379"
        - name: RABBITMQ_HOST
          value: "rabbitmq-service"
        - name: RABBITMQ_PORT
          value: "5672"
        - name: JASMIN_ADMIN_PASSWORD
          valueFrom:
            secretKeyRef:
              name: jasmin-credentials
              key: admin-password
        args:
        - |
          # Copy configuration files
          cp /config-template/jasmin.cfg /config/jasmin.cfg
          cp /config-template/interceptor.py /config/interceptor.py
          cp /config-template/routing-rules.py /config/routing-rules.py
          cp /config-template/init-jasmin.sh /config/init-jasmin.sh
          chmod +x /config/init-jasmin.sh

          # Substitute environment variables in jasmin.cfg
          sed -i "s|redis-service|$REDIS_HOST|g" /config/jasmin.cfg
          sed -i "s|6379|$REDIS_PORT|g" /config/jasmin.cfg
          sed -i "s|rabbitmq-service|$RABBITMQ_HOST|g" /config/jasmin.cfg
          sed -i "s|5672|$RABBITMQ_PORT|g" /config/jasmin.cfg
          # Fix: Add username substitution
          sed -i "s|jasmin|$RABBITMQ_USERNAME|g" /config/jasmin.cfg
          sed -i "s|jasmin-pass|$RABBITMQ_PASSWORD|g" /config/jasmin.cfg
          sed -i "s|jasmin-admin|$JASMIN_ADMIN_PASSWORD|g" /config/jasmin.cfg
EOF

echo "💾 Created patch file: /tmp/jasmin-rabbitmq-fix.yaml"
echo ""

read -p "Apply fix to Jasmin deployment? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔧 Applying fix..."

    # Better approach: Update the deployment YAML in repo and reapply
    echo "📝 Updating kubernetes/jasmin/deployments/jasmin.yaml..."
    echo "   (Manual edit required - adding RABBITMQ_USERNAME env var)"
    echo ""
    echo "After updating the file, apply with:"
    echo "   kubectl apply -f kubernetes/jasmin/deployments/jasmin.yaml"
    echo ""
    echo "Or restart pods to pick up any secret changes:"
    echo "   kubectl delete pod -n $NAMESPACE -l app=jasmin"
fi

echo ""
echo "📋 Verification steps:"
echo "1. Check RabbitMQ credentials secret has correct username:"
echo "   kubectl get secret -n $NAMESPACE rabbitmq-credentials -o jsonpath='{.data.username}' | base64 -d"
echo ""
echo "2. After applying fix, watch pods:"
echo "   kubectl get pods -n $NAMESPACE -l app=jasmin -w"
echo ""
echo "3. Check logs for successful connection:"
echo "   kubectl logs -n $NAMESPACE -l app=jasmin -f"
echo ""

echo "✅ Jasmin RabbitMQ fix preparation complete"
