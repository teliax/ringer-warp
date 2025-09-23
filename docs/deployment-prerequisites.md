# WARP Platform Deployment Prerequisites

## 🔧 Required Tools Installation Guide

### 1. **Google Cloud SDK Components**

```bash
# Update gcloud components
gcloud components update

# Install kubectl (Kubernetes CLI)
gcloud components install kubectl

# Install additional components if needed
gcloud components install gke-gcloud-auth-plugin
```

### 2. **Terraform Installation**

```bash
# Download Terraform
wget https://releases.hashicorp.com/terraform/1.5.7/terraform_1.5.7_linux_amd64.zip

# Unzip and install
unzip terraform_1.5.7_linux_amd64.zip
sudo mv terraform /usr/local/bin/
terraform --version
```

### 3. **Additional Tools**

```bash
# Install kustomize
curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
sudo mv kustomize /usr/local/bin/

# Install jq (JSON processor)
sudo apt-get update && sudo apt-get install -y jq

# Install yq (YAML processor)
wget https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64
sudo mv yq_linux_amd64 /usr/local/bin/yq
sudo chmod +x /usr/local/bin/yq

# Install sipsak (SIP testing tool)
sudo apt-get install -y sipsak

# Install postgresql-client for database testing
sudo apt-get install -y postgresql-client
```

## 🔑 Required Credentials

### 1. **Google Cloud Platform**
- Project ID: `ringer-warp-v01`
- Service Account with roles:
  - Kubernetes Engine Admin
  - Cloud SQL Admin
  - Secret Manager Admin
  - Compute Admin
  - Service Networking Admin

### 2. **Database Credentials**
Create these in Google Secret Manager:
```bash
# Create database password
gcloud secrets create warp-db-password --data-file=- << EOF
[STRONG_PASSWORD_HERE]
EOF

# Create other required secrets
gcloud secrets create warp-jasmin-admin --data-file=- << EOF
[JASMIN_ADMIN_PASSWORD]
EOF

gcloud secrets create warp-rabbitmq-password --data-file=- << EOF
[RABBITMQ_PASSWORD]
EOF
```

### 3. **External Service Credentials**

#### Sinch SMPP Configuration
```bash
# Store in Secret Manager
gcloud secrets create warp-sinch-credentials --data-file=- << EOF
{
  "host": "smpp1.sinch.com",
  "port": 2775,
  "username": "YOUR_SINCH_USERNAME",
  "password": "YOUR_SINCH_PASSWORD",
  "systemType": "SMPP",
  "interfaceVersion": "34"
}
EOF
```

#### Telique API Credentials
```bash
gcloud secrets create warp-telique-api --data-file=- << EOF
{
  "apiKey": "YOUR_TELIQUE_API_KEY",
  "apiSecret": "YOUR_TELIQUE_SECRET",
  "baseUrl": "https://api.teliqon.com"
}
EOF
```

#### NetSuite Integration
```bash
gcloud secrets create warp-netsuite-config --data-file=- << EOF
{
  "accountId": "YOUR_NETSUITE_ACCOUNT",
  "consumerKey": "YOUR_CONSUMER_KEY",
  "consumerSecret": "YOUR_CONSUMER_SECRET",
  "tokenId": "YOUR_TOKEN_ID",
  "tokenSecret": "YOUR_TOKEN_SECRET"
}
EOF
```

## 📁 Required Files Setup

### 1. **Kubernetes Secrets Configuration**

```bash
cd kubernetes/overlays/dev/secrets

# PostgreSQL Configuration
cat > postgres.env << EOF
host=10.x.x.x  # Get from Cloud SQL private IP
port=5432
database=warp
username=warp
password=$(gcloud secrets versions access latest --secret="warp-db-password")
EOF

# Jasmin Configuration
cat > jasmin.env << EOF
admin-password=$(gcloud secrets versions access latest --secret="warp-jasmin-admin")
EOF

# Sinch Configuration
SINCH_CREDS=$(gcloud secrets versions access latest --secret="warp-sinch-credentials")
cat > sinch.env << EOF
host=$(echo $SINCH_CREDS | jq -r .host)
port=$(echo $SINCH_CREDS | jq -r .port)
username=$(echo $SINCH_CREDS | jq -r .username)
password=$(echo $SINCH_CREDS | jq -r .password)
EOF

# RabbitMQ Configuration
cat > rabbitmq.env << EOF
default-user=admin
default-pass=$(gcloud secrets versions access latest --secret="warp-rabbitmq-password")
EOF
```

### 2. **Environment Variables**

Create a `.env.deployment` file:
```bash
cat > .env.deployment << 'EOF'
# GCP Configuration
export PROJECT_ID="ringer-warp-v01"
export REGION="us-central1"
export ZONE="us-central1-a"
export CLUSTER_NAME="warp-kamailio-cluster"

# Database Configuration
export DB_INSTANCE="warp-db"
export DB_NAME="warp"
export DB_USER="warp"

# Networking
export VPC_NAME="warp-vpc"
export SUBNET_NAME="warp-gke-subnet"

# Artifact Registry
export ARTIFACT_REGISTRY="us-central1-docker.pkg.dev/ringer-warp-v01/warp-images"

# BigQuery
export BQ_DATASET_CDR="warp_cdr"
export BQ_DATASET_MDR="warp_mdr"
export BQ_DATASET_ANALYTICS="warp_analytics"

# Load balancing
export RTPENGINE_IP1="34.45.176.142"
export RTPENGINE_IP2="130.211.233.219"
EOF

# Source the environment
source .env.deployment
```

## 🔒 Security Configuration

### 1. **Service Accounts**

```bash
# Create service accounts
gcloud iam service-accounts create warp-k8s-workload \
    --display-name="WARP Kubernetes Workload Identity"

gcloud iam service-accounts create warp-bigquery-streamer \
    --display-name="WARP BigQuery Streamer"

# Assign roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:warp-k8s-workload@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:warp-bigquery-streamer@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/bigquery.dataEditor"
```

### 2. **Workload Identity Binding**

```bash
# Bind Kubernetes service accounts to GCP service accounts
kubectl annotate serviceaccount kamailio \
    -n warp \
    iam.gke.io/gcp-service-account=warp-k8s-workload@$PROJECT_ID.iam.gserviceaccount.com

gcloud iam service-accounts add-iam-policy-binding \
    warp-k8s-workload@$PROJECT_ID.iam.gserviceaccount.com \
    --role roles/iam.workloadIdentityUser \
    --member "serviceAccount:$PROJECT_ID.svc.id.goog[warp/kamailio]"
```

## 🌐 DNS Prerequisites

### Required DNS Records

| Record | Type | Value | Purpose |
|--------|------|-------|---------|
| sip.warp.ringer.tel | A | LoadBalancer IP | SIP traffic |
| api.warp.ringer.tel | A | LoadBalancer IP | REST API |
| console.ringer.tel | CNAME | vercel.app | Admin console |
| admin.ringer.tel | CNAME | vercel.app | Customer portal |

## 🔍 Pre-deployment Verification Script

Create `verify-prerequisites.sh`:

```bash
#!/bin/bash
# WARP Prerequisites Verification Script

set -e

echo "🔍 Verifying WARP Deployment Prerequisites"
echo "=========================================="

# Check tools
TOOLS=("gcloud" "kubectl" "terraform" "kustomize" "jq" "yq")
for tool in "${TOOLS[@]}"; do
    if command -v $tool &> /dev/null; then
        echo "✅ $tool is installed"
    else
        echo "❌ $tool is NOT installed"
        exit 1
    fi
done

# Check GCP configuration
CURRENT_PROJECT=$(gcloud config get-value project)
if [ "$CURRENT_PROJECT" = "ringer-warp-v01" ]; then
    echo "✅ Correct GCP project configured"
else
    echo "❌ Wrong project: $CURRENT_PROJECT"
    exit 1
fi

# Check secrets
SECRETS=("warp-db-password" "warp-jasmin-admin" "warp-rabbitmq-password")
for secret in "${SECRETS[@]}"; do
    if gcloud secrets describe $secret &> /dev/null; then
        echo "✅ Secret exists: $secret"
    else
        echo "❌ Secret missing: $secret"
    fi
done

# Check GKE cluster
if gcloud container clusters describe warp-kamailio-cluster --region=us-central1 &> /dev/null; then
    echo "✅ GKE cluster exists"
else
    echo "❌ GKE cluster not found"
fi

echo ""
echo "✅ Prerequisites check complete!"
```

Make it executable:
```bash
chmod +x verify-prerequisites.sh
./verify-prerequisites.sh
```

## 📚 Additional Resources

- [GKE Best Practices](https://cloud.google.com/kubernetes-engine/docs/best-practices)
- [Kamailio Documentation](https://www.kamailio.org/docs/)
- [Jasmin SMS Gateway](https://docs.jasminsms.com/)
- [Consul Service Discovery](https://www.consul.io/docs)

---

Once all prerequisites are met, proceed with `./deploy-warp-platform.sh`