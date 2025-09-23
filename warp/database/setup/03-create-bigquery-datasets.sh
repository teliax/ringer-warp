#!/bin/bash

# WARP Platform BigQuery Dataset Creation Script
# Project: ringer-warp-v01
# This script creates BigQuery datasets for CDR/MDR storage and analytics

PROJECT_ID="ringer-warp-v01"
LOCATION="us-central1"

echo "Creating BigQuery datasets for WARP platform..."
echo "Project: $PROJECT_ID"
echo "Location: $LOCATION"

# Function to create dataset with configuration
create_dataset() {
    local dataset_name=$1
    local description=$2
    local default_partition_expiration=$3
    
    echo -e "\nCreating dataset: $dataset_name"
    
    bq mk \
        --project_id="$PROJECT_ID" \
        --location="$LOCATION" \
        --dataset \
        --description="$description" \
        --default_partition_expiration="$default_partition_expiration" \
        "$dataset_name"
    
    if [ $? -eq 0 ]; then
        echo "✓ Dataset $dataset_name created successfully"
    else
        echo "⚠ Dataset $dataset_name may already exist or creation failed"
    fi
}

# Create CDR dataset with 90-day partition expiration
create_dataset "warp_cdr" \
    "Call Detail Records for voice traffic - partitioned daily" \
    "7776000"  # 90 days in seconds

# Create MDR dataset with 90-day partition expiration  
create_dataset "warp_mdr" \
    "Message Detail Records for SMS/MMS traffic - partitioned daily" \
    "7776000"  # 90 days in seconds

# Create Analytics dataset (no expiration)
create_dataset "warp_analytics" \
    "Aggregated analytics and reporting data" \
    "0"  # No expiration

# Create CDR table with daily partitioning
echo -e "\nCreating CDR table with schema..."
bq mk \
    --project_id="$PROJECT_ID" \
    --table \
    --time_partitioning_field="start_stamp" \
    --time_partitioning_type="DAY" \
    --clustering_fields="customer_ban,direction,call_type" \
    --description="Raw CDR data from PostgreSQL" \
    warp_cdr.raw_cdr \
    - <<EOF
[
    {"name": "id", "type": "STRING", "mode": "REQUIRED"},
    {"name": "sip_uuid", "type": "STRING", "mode": "REQUIRED"},
    {"name": "sip_callid", "type": "STRING", "mode": "REQUIRED"},
    {"name": "start_stamp", "type": "TIMESTAMP", "mode": "REQUIRED"},
    {"name": "progress_stamp", "type": "TIMESTAMP", "mode": "NULLABLE"},
    {"name": "answer_stamp", "type": "TIMESTAMP", "mode": "NULLABLE"},
    {"name": "end_stamp", "type": "TIMESTAMP", "mode": "NULLABLE"},
    {"name": "customer_ban", "type": "STRING", "mode": "REQUIRED"},
    {"name": "trunk_id", "type": "STRING", "mode": "NULLABLE"},
    {"name": "raw_ani", "type": "STRING", "mode": "NULLABLE"},
    {"name": "dni", "type": "STRING", "mode": "REQUIRED"},
    {"name": "direction", "type": "STRING", "mode": "REQUIRED"},
    {"name": "call_type", "type": "STRING", "mode": "NULLABLE"},
    {"name": "routing_partition", "type": "STRING", "mode": "NULLABLE"},
    {"name": "selected_vendor", "type": "STRING", "mode": "NULLABLE"},
    {"name": "vendor_trunk", "type": "STRING", "mode": "NULLABLE"},
    {"name": "raw_seconds", "type": "INTEGER", "mode": "NULLABLE"},
    {"name": "billed_seconds", "type": "INTEGER", "mode": "NULLABLE"},
    {"name": "disposition", "type": "STRING", "mode": "NULLABLE"},
    {"name": "sip_response_code", "type": "INTEGER", "mode": "NULLABLE"},
    {"name": "ani_lrn", "type": "STRING", "mode": "NULLABLE"},
    {"name": "ani_spid", "type": "STRING", "mode": "NULLABLE"},
    {"name": "ani_ocn", "type": "STRING", "mode": "NULLABLE"},
    {"name": "ani_lata", "type": "INTEGER", "mode": "NULLABLE"},
    {"name": "ani_state", "type": "STRING", "mode": "NULLABLE"},
    {"name": "dni_lrn", "type": "STRING", "mode": "NULLABLE"},
    {"name": "dni_spid", "type": "STRING", "mode": "NULLABLE"},
    {"name": "dni_ocn", "type": "STRING", "mode": "NULLABLE"},
    {"name": "dni_lata", "type": "INTEGER", "mode": "NULLABLE"},
    {"name": "dni_state", "type": "STRING", "mode": "NULLABLE"},
    {"name": "jurisdiction", "type": "STRING", "mode": "NULLABLE"},
    {"name": "customer_rate", "type": "NUMERIC", "mode": "NULLABLE"},
    {"name": "vendor_cost", "type": "NUMERIC", "mode": "NULLABLE"},
    {"name": "margin", "type": "NUMERIC", "mode": "NULLABLE"},
    {"name": "total_charge", "type": "NUMERIC", "mode": "NULLABLE"},
    {"name": "created_at", "type": "TIMESTAMP", "mode": "REQUIRED"},
    {"name": "processed_at", "type": "TIMESTAMP", "mode": "NULLABLE"}
]
EOF

# Create MDR table with daily partitioning
echo -e "\nCreating MDR table with schema..."
bq mk \
    --project_id="$PROJECT_ID" \
    --table \
    --time_partitioning_field="submit_timestamp" \
    --time_partitioning_type="DAY" \
    --clustering_fields="customer_ban,message_type,direction" \
    --description="Message Detail Records for SMS/MMS" \
    warp_mdr.message_records \
    - <<EOF
[
    {"name": "id", "type": "STRING", "mode": "REQUIRED"},
    {"name": "message_uuid", "type": "STRING", "mode": "REQUIRED"},
    {"name": "submit_timestamp", "type": "TIMESTAMP", "mode": "REQUIRED"},
    {"name": "delivery_timestamp", "type": "TIMESTAMP", "mode": "NULLABLE"},
    {"name": "customer_ban", "type": "STRING", "mode": "REQUIRED"},
    {"name": "campaign_id", "type": "STRING", "mode": "NULLABLE"},
    {"name": "message_type", "type": "STRING", "mode": "REQUIRED"},
    {"name": "direction", "type": "STRING", "mode": "REQUIRED"},
    {"name": "from_number", "type": "STRING", "mode": "REQUIRED"},
    {"name": "to_number", "type": "STRING", "mode": "REQUIRED"},
    {"name": "number_type", "type": "STRING", "mode": "NULLABLE"},
    {"name": "segments", "type": "INTEGER", "mode": "NULLABLE"},
    {"name": "delivery_status", "type": "STRING", "mode": "NULLABLE"},
    {"name": "error_code", "type": "STRING", "mode": "NULLABLE"},
    {"name": "vendor_name", "type": "STRING", "mode": "NULLABLE"},
    {"name": "customer_rate", "type": "NUMERIC", "mode": "NULLABLE"},
    {"name": "vendor_cost", "type": "NUMERIC", "mode": "NULLABLE"},
    {"name": "total_charge", "type": "NUMERIC", "mode": "NULLABLE"},
    {"name": "created_at", "type": "TIMESTAMP", "mode": "REQUIRED"}
]
EOF

# Create analytics views
echo -e "\nCreating analytics views..."

# Daily usage summary view
bq mk \
    --project_id="$PROJECT_ID" \
    --use_legacy_sql=false \
    --view \
    --description="Daily usage summary by customer" \
    warp_analytics.daily_usage_summary \
"SELECT
    customer_ban,
    DATE(start_stamp) as usage_date,
    direction,
    call_type,
    COUNT(*) as call_count,
    SUM(billed_seconds)/60 as total_minutes,
    SUM(total_charge) as total_charges,
    AVG(margin) as avg_margin,
    COUNT(DISTINCT selected_vendor) as vendors_used,
    SUM(CASE WHEN disposition = 'ANSWERED' THEN 1 ELSE 0 END) / COUNT(*) as answer_rate
FROM \`${PROJECT_ID}.warp_cdr.raw_cdr\`
WHERE start_stamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
GROUP BY customer_ban, usage_date, direction, call_type"

# Vendor performance view
bq mk \
    --project_id="$PROJECT_ID" \
    --use_legacy_sql=false \
    --view \
    --description="Vendor performance metrics" \
    warp_analytics.vendor_performance \
"SELECT
    selected_vendor as vendor_name,
    DATE(start_stamp) as call_date,
    COUNT(*) as total_calls,
    SUM(CASE WHEN disposition = 'ANSWERED' THEN 1 ELSE 0 END) as answered_calls,
    SUM(CASE WHEN disposition = 'ANSWERED' THEN 1 ELSE 0 END) / COUNT(*) as asr,
    AVG(CASE WHEN disposition = 'ANSWERED' THEN raw_seconds ELSE NULL END) as acd_seconds,
    SUM(vendor_cost) as total_cost,
    SUM(margin) as total_margin
FROM \`${PROJECT_ID}.warp_cdr.raw_cdr\`
WHERE start_stamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY vendor_name, call_date"

# Create service account for streaming
echo -e "\nCreating service account for BigQuery streaming..."
gcloud iam service-accounts create warp-bq-streamer \
    --display-name="WARP BigQuery Streamer" \
    --project="$PROJECT_ID"

# Grant BigQuery permissions
echo "Granting BigQuery permissions..."
for dataset in warp_cdr warp_mdr warp_analytics; do
    bq add-iam-policy-binding \
        --project_id="$PROJECT_ID" \
        --member="serviceAccount:warp-bq-streamer@${PROJECT_ID}.iam.gserviceaccount.com" \
        --role="roles/bigquery.dataEditor" \
        "$dataset"
done

# Create streaming configuration table in PostgreSQL
cat > streaming_config.sql <<'EOF'
-- BigQuery Streaming Configuration
CREATE TABLE IF NOT EXISTS billing.bigquery_streaming_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Streaming Settings
    dataset_name VARCHAR(100) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    
    -- Batch Configuration
    batch_size INTEGER DEFAULT 500,
    batch_timeout_seconds INTEGER DEFAULT 10,
    max_retries INTEGER DEFAULT 3,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_streamed_at TIMESTAMPTZ,
    last_streamed_id UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default streaming configurations
INSERT INTO billing.bigquery_streaming_config (dataset_name, table_name, batch_size) VALUES
    ('warp_cdr', 'raw_cdr', 500),
    ('warp_mdr', 'message_records', 1000);
EOF

echo -e "\n✓ BigQuery setup completed!"
echo -e "\nNext steps:"
echo "1. Save the service account key for warp-bq-streamer"
echo "2. Configure the streaming service with the key"
echo "3. Run the streaming_config.sql in PostgreSQL"
echo "4. Test streaming with sample data"