# Infrastructure as Code

This directory contains all infrastructure definitions and configurations for the WARP platform.

## Structure

### terraform/
Infrastructure provisioning via Terraform:
- `environments/v01/` - Production environment
- `environments/dev/` - Development environment
- `modules/` - Reusable modules (networking, compute, gke, database, cache, consul)

**Backend**: GCS bucket `ringer-warp-v01-terraform-state`

### kubernetes/
Kubernetes manifests for all services:
- `warp/` - Kamailio, monitoring (Prometheus, Grafana), database jobs
- `jasmin/` - Jasmin SMSC deployments, services, configmaps
- `rabbitmq/` - Message broker
- `ssl/` - Certificate management (cert-manager)
- `base/` - Common resources (namespaces, RBAC)

### docker/
Docker image configurations:
- `kamailio/` - Kamailio SIP server (Dockerfile, config, scripts)

### database/
Database schemas and initialization:
- `schemas/` - PostgreSQL schema definitions
- `setup/` - Initialization scripts

### api-specs/
OpenAPI 3.0.3 specifications:
- `openapi.yaml` - Complete API specification

## Usage

### Terraform
```bash
cd infrastructure/terraform/environments/v01
~/.local/bin/terraform init
~/.local/bin/terraform plan
~/.local/bin/terraform apply
```

### Kubernetes
```bash
kubectl apply -f infrastructure/kubernetes/warp/kamailio/
kubectl apply -f infrastructure/kubernetes/jasmin/
```

### Build Docker Images
```bash
cd infrastructure/docker/kamailio
gcloud builds submit --config=cloudbuild-v1.3-redis.yaml .
```

## Deployed Resources

**GCP Project**: ringer-warp-v01
**Region**: us-central1

**Networks**:
- warp-vpc (10.0.0.0/8)
- warp-gke-subnet (10.0.0.0/24, pods: 10.1.0.0/16, services: 10.2.0.0/16)
- warp-rtpengine-subnet (10.0.1.0/24)
- warp-consul-subnet (10.0.2.0/24)

**Compute**:
- GKE Cluster: warp-kamailio-cluster
- RTPEngine VMs: warp-rtpengine-1/2/3 (10.0.1.11-13)
- Consul Servers: warp-consul-server-1/2/3

**Namespaces**:
- warp-core (Kamailio)
- messaging (Jasmin, Redis, RabbitMQ)
- monitoring (Prometheus, Grafana)
- homer (SIP capture)
