# WARP Infrastructure Deployment Summary

> ⚠️ **DEPRECATION NOTICE**
> 
> This document describes the legacy development environment infrastructure with "dev" prefixed resources.
> 
> **For the current production infrastructure, please refer to:**
> - `/warp/terraform/environments/v01/` - New v01 production environment
> - Resources in v01 use "v01" prefix instead of "dev"
> - The new environment follows the same architecture but with updated naming conventions
> 
> This document is preserved for historical reference and migration purposes only.
> 
> **Last Updated**: Before v01 migration
> **Status**: DEPRECATED - Do not use for new deployments

---

## Project Details
- **Project ID**: ringer-472421
- **Region**: us-central1
- **Environment**: dev

## Deployed Resources

### Networking
- **VPC**: warp-dev-vpc
- **Subnets**:
  - GKE: 10.0.0.0/24
  - RTPEngine: 10.0.1.0/24
  - Consul: 10.0.2.0/24
  - GKE Pods: 10.1.0.0/16
  - GKE Services: 10.2.0.0/16
- **Cloud NAT**: Configured for outbound traffic

### Kubernetes (GKE)
- **Cluster Name**: warp-dev-kamailio-cluster
- **Node Pool**: 
  - Initial nodes: 2
  - Machine type: n2-standard-4
  - Auto-scaling: 2-5 nodes
  - Preemptible nodes enabled (cost savings)

### Service Discovery
- **Consul Cluster**: 3 server nodes deployed
- **Zones**: us-central1-a, us-central1-b, us-central1-c
- **Machine Type**: n2-standard-2

### Media Processing
- **RTPEngine Instances**: 2 deployed
- **External IPs**: 
  - 34.45.176.142
  - 130.211.233.219
- **RTP Port Range**: 10000-20000

### Data Layer
- **Cloud SQL (PostgreSQL)**: warp-dev-db
  - Version: PostgreSQL 15
  - Tier: db-f1-micro
  - Private IP only (VPC peering)
  
- **Redis**: warp-dev-redis
  - Tier: STANDARD_HA (5GB)
  - Version: Redis 7.0

### Container Registry
- **Artifact Registry**: us-central1-docker.pkg.dev/ringer-472421/warp-dev-images
- **Format**: Docker
- **Cleanup Policies**: 
  - Keep 10 most recent versions
  - Delete untagged images after 7 days

### Security & IAM
- **Service Accounts Created**:
  - warp-dev-kamailio-node-sa@ringer-472421.iam.gserviceaccount.com
  - warp-dev-kamailio-workload@ringer-472421.iam.gserviceaccount.com
  - warp-dev-rtpengine-sa@ringer-472421.iam.gserviceaccount.com
  - warp-dev-consul-sa@ringer-472421.iam.gserviceaccount.com

### Storage
- **Backup Bucket**: ringer-472421-warp-dev-backups (30-day retention)
- **Recordings Bucket**: ringer-472421-warp-dev-recordings (7-day retention)

## Next Steps for Other Agents

1. **Configure kubectl**:
   ```bash
   gcloud container clusters get-credentials warp-dev-kamailio-cluster --region us-central1 --project ringer-472421
   ```

2. **Configure Docker for Artifact Registry**:
   ```bash
   gcloud auth configure-docker us-central1-docker.pkg.dev
   ```

3. **Build and deploy containers** to the Artifact Registry
4. **Deploy Kamailio** and other services to GKE
5. **Configure Consul** for service discovery
6. **Set up monitoring** and alerting

## Important Notes
- All external API credentials are in Google Secret Manager
- Sinch SMPP uses IP-based authentication (no credentials needed)
- Development environment has open access (0.0.0.0/0) - restrict for production
- Terraform state is stored in: gs://warp-terraform-state-dev