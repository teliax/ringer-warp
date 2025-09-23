#!/bin/bash
# Build and deploy Kamailio Docker image

set -e

# Configuration
PROJECT_ID="ringer-warp-v01"
REGION="us-central1"
REPOSITORY="warp-platform"
IMAGE_NAME="kamailio"
TAG="${1:-latest}"

# Full image path
FULL_IMAGE_PATH="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${IMAGE_NAME}:${TAG}"

echo "Building Kamailio Docker image..."
echo "Image: ${FULL_IMAGE_PATH}"

# Ensure we're in the correct directory
cd "$(dirname "$0")"

# Build the Docker image
docker build -t ${IMAGE_NAME}:${TAG} .

# Tag for Google Artifact Registry
docker tag ${IMAGE_NAME}:${TAG} ${FULL_IMAGE_PATH}

# Configure Docker for Google Artifact Registry
echo "Configuring Docker authentication for Google Artifact Registry..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Push to Google Artifact Registry
echo "Pushing image to Google Artifact Registry..."
docker push ${FULL_IMAGE_PATH}

echo "Image pushed successfully: ${FULL_IMAGE_PATH}"

# Update Kubernetes deployment if requested
if [ "$2" = "deploy" ]; then
    echo "Updating Kubernetes deployment..."
    
    # Update the deployment with the new image
    kubectl set image deployment/kamailio kamailio=${FULL_IMAGE_PATH} -n warp-sip
    
    # Wait for rollout to complete
    kubectl rollout status deployment/kamailio -n warp-sip
    
    echo "Deployment updated successfully!"
fi

# Create database schema if requested
if [ "$3" = "init-db" ]; then
    echo "Initializing Kamailio database schema..."
    
    # This would typically be done by running kamdbctl create
    # For now, we'll create a SQL file that can be applied
    cat > kamailio-schema.sql << 'EOF'
-- Kamailio database schema for PostgreSQL
-- This is a subset of the full schema focusing on essential tables

-- Version table
CREATE TABLE IF NOT EXISTS version (
    table_name VARCHAR(32) NOT NULL,
    table_version INTEGER DEFAULT 0 NOT NULL,
    CONSTRAINT version_table_name_idx UNIQUE (table_name)
);

-- Subscriber table (user authentication)
CREATE TABLE IF NOT EXISTS subscriber (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL DEFAULT '',
    domain VARCHAR(64) NOT NULL DEFAULT '',
    password VARCHAR(64) NOT NULL DEFAULT '',
    ha1 VARCHAR(128) NOT NULL DEFAULT '',
    ha1b VARCHAR(128) NOT NULL DEFAULT '',
    email_address VARCHAR(128) DEFAULT NULL,
    rpid VARCHAR(128) DEFAULT NULL,
    customer_id INTEGER,
    CONSTRAINT subscriber_account_idx UNIQUE (username, domain)
);

-- Location table (user registrations)
CREATE TABLE IF NOT EXISTS location (
    id SERIAL PRIMARY KEY,
    ruid VARCHAR(64) NOT NULL DEFAULT '',
    username VARCHAR(64) NOT NULL DEFAULT '',
    domain VARCHAR(64) DEFAULT NULL,
    contact VARCHAR(512) NOT NULL DEFAULT '',
    received VARCHAR(255) DEFAULT NULL,
    path VARCHAR(512) DEFAULT NULL,
    expires TIMESTAMP NOT NULL DEFAULT '2030-05-28 21:32:15',
    q REAL NOT NULL DEFAULT 1.0,
    callid VARCHAR(255) NOT NULL DEFAULT 'Default-Call-ID',
    cseq INTEGER NOT NULL DEFAULT 1,
    last_modified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    flags INTEGER NOT NULL DEFAULT 0,
    cflags INTEGER NOT NULL DEFAULT 0,
    user_agent VARCHAR(255) NOT NULL DEFAULT '',
    socket VARCHAR(64) DEFAULT NULL,
    methods INTEGER DEFAULT NULL,
    instance VARCHAR(255) DEFAULT NULL,
    reg_id INTEGER NOT NULL DEFAULT 0,
    server_id INTEGER NOT NULL DEFAULT 0,
    connection_id INTEGER NOT NULL DEFAULT 0,
    keepalive INTEGER NOT NULL DEFAULT 0,
    partition INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT location_ruid_idx UNIQUE (ruid)
);

-- Trusted IPs (IP ACL)
CREATE TABLE IF NOT EXISTS trusted (
    id SERIAL PRIMARY KEY,
    src_ip VARCHAR(50) NOT NULL,
    proto VARCHAR(4) NOT NULL,
    from_pattern VARCHAR(64) DEFAULT NULL,
    ruri_pattern VARCHAR(64) DEFAULT NULL,
    tag VARCHAR(64),
    priority INTEGER NOT NULL DEFAULT 0
);

-- Address table (IP ACL with groups)
CREATE TABLE IF NOT EXISTS address (
    id SERIAL PRIMARY KEY,
    grp SMALLINT NOT NULL DEFAULT 0,
    ip_addr VARCHAR(50) NOT NULL,
    mask SMALLINT NOT NULL DEFAULT 32,
    port SMALLINT NOT NULL DEFAULT 0,
    tag VARCHAR(64),
    customer_id INTEGER,
    active BOOLEAN DEFAULT TRUE
);

-- Dispatcher table (carrier endpoints)
CREATE TABLE IF NOT EXISTS dispatcher (
    id SERIAL PRIMARY KEY,
    setid INTEGER NOT NULL DEFAULT 0,
    destination VARCHAR(192) NOT NULL DEFAULT '',
    flags INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    attrs VARCHAR(255) DEFAULT '',
    description VARCHAR(64) DEFAULT ''
);

-- RTPEngine table
CREATE TABLE IF NOT EXISTS rtpengine (
    id SERIAL PRIMARY KEY,
    setid INTEGER NOT NULL DEFAULT 0,
    url VARCHAR(64) NOT NULL,
    weight INTEGER NOT NULL DEFAULT 1,
    disabled SMALLINT NOT NULL DEFAULT 0,
    CONSTRAINT rtpengine_nodes UNIQUE (setid, url)
);

-- Dialog table (active calls)
CREATE TABLE IF NOT EXISTS dialog (
    id BIGSERIAL PRIMARY KEY,
    hash_entry INTEGER NOT NULL,
    hash_id INTEGER NOT NULL,
    callid VARCHAR(255) NOT NULL,
    from_uri VARCHAR(255) NOT NULL,
    from_tag VARCHAR(128) NOT NULL,
    to_uri VARCHAR(255) NOT NULL,
    to_tag VARCHAR(128) NOT NULL,
    caller_cseq VARCHAR(20) NOT NULL,
    callee_cseq VARCHAR(20) NOT NULL,
    caller_route_set VARCHAR(512),
    callee_route_set VARCHAR(512),
    caller_contact VARCHAR(255) NOT NULL,
    callee_contact VARCHAR(255) NOT NULL,
    caller_sock VARCHAR(64) NOT NULL,
    callee_sock VARCHAR(64) NOT NULL,
    state INTEGER NOT NULL,
    start_time INTEGER NOT NULL,
    timeout INTEGER NOT NULL DEFAULT 0,
    sflags INTEGER NOT NULL DEFAULT 0,
    iflags INTEGER NOT NULL DEFAULT 0,
    toroute_name VARCHAR(32),
    req_uri VARCHAR(255) NOT NULL,
    xdata VARCHAR(512)
);

-- ACC table (CDRs)
CREATE TABLE IF NOT EXISTS acc (
    id BIGSERIAL PRIMARY KEY,
    method VARCHAR(16) NOT NULL DEFAULT '',
    from_tag VARCHAR(128) NOT NULL DEFAULT '',
    to_tag VARCHAR(128) NOT NULL DEFAULT '',
    callid VARCHAR(255) NOT NULL DEFAULT '',
    sip_code VARCHAR(3) NOT NULL DEFAULT '',
    sip_reason VARCHAR(128) NOT NULL DEFAULT '',
    time TIMESTAMP NOT NULL,
    src_ip VARCHAR(64) NOT NULL DEFAULT '',
    dst_ip VARCHAR(255) NOT NULL DEFAULT '',
    src_user VARCHAR(64) NOT NULL DEFAULT '',
    dst_user VARCHAR(64) NOT NULL DEFAULT '',
    customer_id INTEGER,
    duration INTEGER DEFAULT 0,
    setuptime INTEGER DEFAULT 0,
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Missed calls table
CREATE TABLE IF NOT EXISTS missed_calls (
    id BIGSERIAL PRIMARY KEY,
    method VARCHAR(16) NOT NULL DEFAULT '',
    from_tag VARCHAR(128) NOT NULL DEFAULT '',
    to_tag VARCHAR(128) NOT NULL DEFAULT '',
    callid VARCHAR(255) NOT NULL DEFAULT '',
    sip_code VARCHAR(3) NOT NULL DEFAULT '',
    sip_reason VARCHAR(128) NOT NULL DEFAULT '',
    time TIMESTAMP NOT NULL,
    src_ip VARCHAR(64) NOT NULL DEFAULT '',
    dst_ip VARCHAR(255) NOT NULL DEFAULT '',
    src_user VARCHAR(64) NOT NULL DEFAULT '',
    dst_user VARCHAR(64) NOT NULL DEFAULT '',
    customer_id INTEGER,
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- IP ACL for customers
CREATE TABLE IF NOT EXISTS ip_acl (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    ip_address VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ip_acl_unique UNIQUE (customer_id, ip_address)
);

-- Insert version information
INSERT INTO version (table_name, table_version) VALUES 
    ('subscriber', 7),
    ('location', 9),
    ('trusted', 6),
    ('address', 5),
    ('dispatcher', 4),
    ('rtpengine', 1),
    ('dialog', 7),
    ('acc', 5),
    ('missed_calls', 4)
ON CONFLICT (table_name) DO UPDATE SET table_version = EXCLUDED.table_version;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS location_expires_idx ON location(expires);
CREATE INDEX IF NOT EXISTS location_account_idx ON location(username, domain);
CREATE INDEX IF NOT EXISTS address_grp_idx ON address(grp);
CREATE INDEX IF NOT EXISTS acc_callid_idx ON acc(callid);
CREATE INDEX IF NOT EXISTS acc_time_idx ON acc(time);
CREATE INDEX IF NOT EXISTS dialog_hash_idx ON dialog(hash_entry, hash_id);
CREATE INDEX IF NOT EXISTS ip_acl_customer_idx ON ip_acl(customer_id);
EOF
    
    echo "Database schema SQL file created: kamailio-schema.sql"
    echo "Apply this schema to your PostgreSQL database with:"
    echo "PGPASSWORD=<password> psql -h 34.42.208.57 -U warp -d warp -f kamailio-schema.sql"
fi

echo "Done!"