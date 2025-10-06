#!/bin/bash
set -e

# Consul server startup script for GCP VMs

# Variables from Terraform
CONSUL_VERSION="${consul_version}"
DATACENTER="${datacenter}"
SERVER_COUNT="${server_count}"
INSTANCE_INDEX="${instance_index}"
ENCRYPT_KEY="${encrypt_key}"
PROJECT_ID="${project_id}"
CONSUL_UI="${consul_ui}"

# Get instance metadata
INSTANCE_NAME=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/name)
INSTANCE_ZONE=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/zone | cut -d'/' -f4)
INTERNAL_IP=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/ip)

# Update system
apt-get update
apt-get upgrade -y

# Install dependencies
apt-get install -y \
    curl \
    gnupg \
    lsb-release \
    unzip \
    dnsutils \
    net-tools \
    jq

# Install Consul
curl -Lo /tmp/consul.zip "https://releases.hashicorp.com/consul/$${CONSUL_VERSION}/consul_$${CONSUL_VERSION}_linux_amd64.zip"
unzip /tmp/consul.zip -d /usr/local/bin/
chmod +x /usr/local/bin/consul

# Create Consul user and directories
useradd --system --home /etc/consul.d --shell /bin/false consul || true
mkdir -p /etc/consul.d /opt/consul
chown -R consul:consul /etc/consul.d /opt/consul

# Get other Consul servers for retry_join
CONSUL_SERVERS=$(gcloud compute instances list \
    --filter="tags.items=consul-server AND name!=$${INSTANCE_NAME}" \
    --format="value(networkInterfaces[0].networkIP)" \
    --project=$${PROJECT_ID} | paste -sd "," -)

# Configure Consul server
cat > /etc/consul.d/consul.hcl <<EOF
datacenter = "$${DATACENTER}"
data_dir = "/opt/consul"
log_level = "INFO"
node_name = "$${INSTANCE_NAME}"
server = true
bootstrap_expect = $${SERVER_COUNT}
encrypt = "$${ENCRYPT_KEY}"

bind_addr = "$${INTERNAL_IP}"
client_addr = "0.0.0.0"

ui_config {
  enabled = $${CONSUL_UI}
}

connect {
  enabled = true
}

ports {
  grpc = 8502
}

retry_join = [$$(echo "$${CONSUL_SERVERS}" | sed 's/,/","/g' | sed 's/^/"/;s/$/"/')]

acl = {
  enabled = false
  default_policy = "allow"
  enable_token_persistence = true
}

performance {
  raft_multiplier = 1
}

telemetry {
  prometheus_retention_time = "60s"
  disable_hostname = false
  metrics_prefix = "consul"
}

autopilot {
  cleanup_dead_servers = true
  last_contact_threshold = "200ms"
  max_trailing_logs = 250
  min_quorum = 3
  server_stabilization_time = "10s"
}
EOF

# Create systemd service for Consul
cat > /etc/systemd/system/consul.service <<EOF
[Unit]
Description=Consul
Documentation=https://www.consul.io/
Requires=network-online.target
After=network-online.target
ConditionFileNotEmpty=/etc/consul.d/consul.hcl

[Service]
Type=notify
User=consul
Group=consul
ExecStart=/usr/local/bin/consul agent -config-dir=/etc/consul.d/
ExecReload=/bin/kill -HUP \$MAINPID
KillMode=process
Restart=on-failure
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

# Configure backup script
cat > /usr/local/bin/consul-backup.sh <<'SCRIPT'
#!/bin/bash
BACKUP_DIR="/opt/consul-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Create snapshot
consul snapshot save "$BACKUP_DIR/consul-snapshot-$TIMESTAMP.snap"

# Upload to GCS
gsutil cp "$BACKUP_DIR/consul-snapshot-$TIMESTAMP.snap" \
    gs://${PROJECT_ID}-consul-backups/snapshots/

# Clean up old local backups (keep last 7 days)
find $BACKUP_DIR -name "*.snap" -mtime +7 -delete
SCRIPT
chmod +x /usr/local/bin/consul-backup.sh

# Set up daily backup cron job
echo "0 2 * * * /usr/local/bin/consul-backup.sh" | crontab -

# Install Google Cloud Ops Agent for monitoring
curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
bash add-google-cloud-ops-agent-repo.sh --also-install

# Configure Ops Agent for Consul metrics
cat > /etc/google-cloud-ops-agent/config.yaml <<EOF
metrics:
  receivers:
    consul:
      type: prometheus
      config:
        scrape_configs:
          - job_name: consul
            scrape_interval: 30s
            static_configs:
              - targets: ['localhost:8500']
            metrics_path: /v1/agent/metrics
            params:
              format: ['prometheus']
  service:
    pipelines:
      consul:
        receivers:
          - consul
logging:
  receivers:
    syslog:
      type: files
      include_paths:
        - /var/log/syslog
        - /opt/consul/*.log
  service:
    pipelines:
      default:
        receivers:
          - syslog
EOF

# Enable and start services
systemctl daemon-reload
systemctl enable consul
systemctl start consul

# Wait for Consul to be ready
sleep 10

# Restart Ops Agent to pick up new config
systemctl restart google-cloud-ops-agent

# Initialize Consul KV with cluster metadata
if [ "$${INSTANCE_INDEX}" == "1" ]; then
    sleep 20  # Extra wait for cluster formation
    consul kv put "cluster/name" "warp-consul"
    consul kv put "cluster/datacenter" "$${DATACENTER}"
    consul kv put "cluster/initialized" "$(date -Iseconds)"
fi

# Log successful startup
logger -t consul-startup "Consul server $${INSTANCE_NAME} successfully configured and started"
echo "Consul server startup complete for instance $${INSTANCE_NAME}" | tee /var/log/consul-startup.log