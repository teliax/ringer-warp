# BigQuery CDR/MDR Storage Architecture

## Overview
Call Detail Records (CDRs) and Message Detail Records (MDRs) are stored in Google BigQuery with partitioned tables for optimal performance, cost efficiency, and analytics capabilities.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│            SIP/SMS Event Sources                     │
│  Kamailio (CDR) | Jasmin (MDR) | RTPEngine (Media)  │
└─────────────────────────────────────────────────────┘
                        │
                   Pub/Sub Topics
                        │
┌─────────────────────────────────────────────────────┐
│              Dataflow Pipeline                       │
│  Enrichment | Validation | Rating | Transformation  │
└─────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────┐
│                    BigQuery                          │
│  Partitioned Tables | Clustering | Materialized Views│
└─────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────┐
│         Downstream Consumers                         │
│  Billing | Analytics | Customer Portal | NetSuite   │
└─────────────────────────────────────────────────────┘
```

## BigQuery Schema Design

### 1. CDR Table (Call Detail Records)

```sql
-- Dataset: warp_telecom
-- Table: cdrs
-- Partitioning: Daily on start_time
-- Clustering: customer_id, trunk_id, zone

CREATE TABLE `warp_telecom.cdrs`
(
  -- Primary identifiers
  call_id STRING NOT NULL,
  customer_id STRING NOT NULL,
  trunk_id STRING NOT NULL,

  -- Call timestamps
  start_time TIMESTAMP NOT NULL,
  answer_time TIMESTAMP,
  end_time TIMESTAMP NOT NULL,

  -- Call parties
  ani STRING NOT NULL,  -- Calling number
  dnis STRING NOT NULL, -- Called number

  -- ANI (Calling Party) LRN/LERG information
  ani_lrn STRING,
  ani_ocn STRING,
  ani_spid STRING,
  ani_lata STRING,
  ani_rate_center STRING,
  ani_state STRING,
  ani_carrier_name STRING,
  
  -- DNI (Called Party) LRN/LERG information
  dni_lrn STRING,
  dni_ocn STRING,
  dni_spid STRING,
  dni_lata STRING,
  dni_rate_center STRING,
  dni_state STRING,
  dni_carrier_name STRING,
  
  -- Toll-free specific (applies to DNI)
  ror_id STRING,        -- RespOrg ID
  ror_name STRING,      -- RespOrg name
  
  -- Derived routing information
  zone STRING, -- INTERSTATE, INTRASTATE, LOCAL, INTERNATIONAL, TOLLFREE
  jurisdiction STRING,

  -- Call metrics
  duration_seconds INT64,
  billable_seconds INT64,
  pdd_ms INT64, -- Post-dial delay
  mos FLOAT64,  -- Mean Opinion Score

  -- Routing details
  ingress_ip STRING,
  egress_ip STRING,
  ingress_codec STRING,
  egress_codec STRING,
  partition_id STRING,
  selected_vendor STRING,
  vendor_trunk STRING,
  dialstring STRING,

  -- Rating information
  vendor_rate NUMERIC(10,6),
  customer_rate NUMERIC(10,6),
  margin NUMERIC(10,6),
  rated_amount NUMERIC(12,4),
  currency STRING,

  -- SIP details
  sip_call_id STRING,
  sip_from_tag STRING,
  sip_to_tag STRING,
  release_cause INT64,
  release_text STRING,

  -- Media details
  rtp_packets_sent INT64,
  rtp_packets_received INT64,
  rtp_packets_lost INT64,
  jitter_ms FLOAT64,

  -- Processing metadata
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  rated_at TIMESTAMP,
  invoiced_at TIMESTAMP,
  invoice_id STRING,

  -- Data quality
  is_test BOOL DEFAULT FALSE,
  is_duplicate BOOL DEFAULT FALSE,
  processing_errors ARRAY<STRING>
)
PARTITION BY DATE(start_time)
CLUSTER BY customer_id, trunk_id, zone
OPTIONS(
  description="Call Detail Records for voice traffic",
  partition_expiration_days=2555,  -- 7 years retention
  require_partition_filter=true
);

-- Create indexes for common queries
CREATE SEARCH INDEX cdr_ani_dnis_idx ON `warp_telecom.cdrs`(ani, dnis);
CREATE SEARCH INDEX cdr_invoice_idx ON `warp_telecom.cdrs`(invoice_id) WHERE invoice_id IS NOT NULL;
```

### 2. MDR Table (Message Detail Records)

```sql
-- Table: mdrs
-- Partitioning: Daily on created_at
-- Clustering: customer_id, trunk_id, message_type

CREATE TABLE `warp_telecom.mdrs`
(
  -- Primary identifiers
  message_id STRING NOT NULL,
  customer_id STRING NOT NULL,
  trunk_id STRING NOT NULL,

  -- Message timestamps
  created_at TIMESTAMP NOT NULL,
  submitted_at TIMESTAMP,
  delivered_at TIMESTAMP,

  -- Message parties
  from_number STRING NOT NULL,
  to_number STRING NOT NULL,

  -- Message details
  message_type STRING NOT NULL, -- SMS, MMS, RCS
  direction STRING NOT NULL, -- INBOUND, OUTBOUND
  segments INT64,
  message_length INT64,
  encoding STRING,

  -- MMS/RCS specific
  media_urls ARRAY<STRING>,
  media_size_bytes INT64,

  -- Delivery information
  status STRING, -- QUEUED, SENT, DELIVERED, FAILED, READ
  delivery_receipt_requested BOOL,
  dlr_status STRING,
  dlr_error_code STRING,
  retry_count INT64,

  -- Routing information
  selected_route STRING,
  smsc_message_id STRING,
  upstream_provider STRING,

  -- Rating information
  rate_per_segment NUMERIC(10,6),
  total_segments_charged INT64,
  rated_amount NUMERIC(12,4),
  currency STRING,

  -- Campaign/compliance
  campaign_id STRING,
  content_type STRING, -- PROMOTIONAL, TRANSACTIONAL
  opt_out BOOL DEFAULT FALSE,

  -- A2P specific
  brand_id STRING,
  campaign_registry_id STRING,

  -- Processing metadata
  processed_at TIMESTAMP,
  rated_at TIMESTAMP,
  invoiced_at TIMESTAMP,
  invoice_id STRING,

  -- Data quality
  is_test BOOL DEFAULT FALSE,
  is_duplicate BOOL DEFAULT FALSE,
  processing_errors ARRAY<STRING>
)
PARTITION BY DATE(created_at)
CLUSTER BY customer_id, trunk_id, message_type
OPTIONS(
  description="Message Detail Records for SMS/MMS/RCS traffic",
  partition_expiration_days=2555,  -- 7 years retention
  require_partition_filter=true
);
```

### 3. Real-time Streaming Tables

```sql
-- Streaming buffer for real-time CDRs (5-minute partitions)
CREATE TABLE `warp_telecom.cdrs_streaming`
(
  call_id STRING NOT NULL,
  customer_id STRING NOT NULL,
  start_time TIMESTAMP NOT NULL,
  -- Subset of fields for real-time monitoring
  ani STRING,
  dnis STRING,
  duration_seconds INT64,
  status STRING,
  ingestion_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY TIMESTAMP_TRUNC(start_time, MINUTE)
OPTIONS(
  partition_expiration_days=1,
  description="Real-time streaming buffer for CDRs"
);

-- Streaming buffer for real-time MDRs
CREATE TABLE `warp_telecom.mdrs_streaming`
(
  message_id STRING NOT NULL,
  customer_id STRING NOT NULL,
  created_at TIMESTAMP NOT NULL,
  from_number STRING,
  to_number STRING,
  message_type STRING,
  status STRING,
  ingestion_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY TIMESTAMP_TRUNC(created_at, MINUTE)
OPTIONS(
  partition_expiration_days=1,
  description="Real-time streaming buffer for MDRs"
);
```

### 4. Aggregated Views for Billing

```sql
-- Daily usage summary for billing
CREATE MATERIALIZED VIEW `warp_telecom.daily_usage_summary`
PARTITION BY usage_date
CLUSTER BY customer_id, trunk_id
AS
SELECT
  DATE(start_time) as usage_date,
  customer_id,
  trunk_id,
  zone,
  COUNT(*) as call_count,
  SUM(billable_seconds)/60.0 as billable_minutes,
  AVG(duration_seconds) as avg_call_duration,
  SUM(rated_amount) as total_charges,
  COUNT(DISTINCT ani) as unique_callers,
  COUNT(DISTINCT dnis) as unique_destinations,
  SUM(CASE WHEN answer_time IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*) as answer_seizure_ratio
FROM `warp_telecom.cdrs`
WHERE DATE(start_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
  AND is_test = FALSE
  AND is_duplicate = FALSE
GROUP BY 1, 2, 3, 4;

-- Monthly billing summary
CREATE MATERIALIZED VIEW `warp_telecom.monthly_billing_summary`
PARTITION BY billing_month
CLUSTER BY customer_id
AS
SELECT
  DATE_TRUNC(DATE(start_time), MONTH) as billing_month,
  customer_id,
  zone,
  SUM(billable_seconds)/60.0 as total_minutes,
  SUM(rated_amount) as total_charges,
  COUNT(*) as total_calls,
  COUNT(DISTINCT DATE(start_time)) as active_days,
  ARRAY_AGG(DISTINCT trunk_id IGNORE NULLS) as active_trunks
FROM `warp_telecom.cdrs`
WHERE DATE(start_time) >= DATE_SUB(DATE_TRUNC(CURRENT_DATE(), MONTH), INTERVAL 6 MONTH)
  AND invoice_id IS NULL  -- Not yet invoiced
  AND is_test = FALSE
GROUP BY 1, 2, 3;
```

## Data Pipeline

### 1. Ingestion from Kamailio/Jasmin

```python
import json
from google.cloud import pubsub_v1, bigquery
from datetime import datetime

class CDRIngestionPipeline:
    def __init__(self):
        self.publisher = pubsub_v1.PublisherClient()
        self.bq_client = bigquery.Client()
        self.cdr_topic = 'projects/warp-prod/topics/cdrs'
        self.mdr_topic = 'projects/warp-prod/topics/mdrs'

    def process_kamailio_cdr(self, cdr_data):
        """Process CDR from Kamailio and send to Pub/Sub"""

        # Enrich CDR with additional data
        enriched_cdr = self.enrich_cdr(cdr_data)

        # Apply rating immediately for real-time balance
        if enriched_cdr['customer_type'] == 'PREPAID':
            rated_cdr = self.apply_rating(enriched_cdr)
            self.update_prepaid_balance(rated_cdr)

        # Send to Pub/Sub for BigQuery streaming
        message = json.dumps(enriched_cdr).encode('utf-8')
        future = self.publisher.publish(self.cdr_topic, message)

        # Also stream to real-time table
        self.stream_to_realtime_table(enriched_cdr)

        return future.result()

    def enrich_cdr(self, cdr):
        """Enrich CDR with LRN, jurisdiction, and rating data"""

        # LRN lookups for both ANI and DNI (NANPA calls)
        if cdr.get('ani', '').startswith('1'):
            ani_lrn_data = self.lrn_lookup(cdr['ani'])
            cdr['ani_lrn'] = ani_lrn_data['lrn']
            cdr['ani_ocn'] = ani_lrn_data['ocn']
            cdr['ani_spid'] = ani_lrn_data['spid']
            cdr['ani_lata'] = ani_lrn_data['lata']
            cdr['ani_rate_center'] = ani_lrn_data['rate_center']
            cdr['ani_state'] = ani_lrn_data['state']
            cdr['ani_carrier_name'] = ani_lrn_data['carrier_name']
        
        if cdr.get('dnis', '').startswith('1'):
            dni_lrn_data = self.lrn_lookup(cdr['dnis'])
            cdr['dni_lrn'] = dni_lrn_data['lrn']
            cdr['dni_ocn'] = dni_lrn_data['ocn']
            cdr['dni_spid'] = dni_lrn_data['spid']
            cdr['dni_lata'] = dni_lrn_data['lata']
            cdr['dni_rate_center'] = dni_lrn_data['rate_center']
            cdr['dni_state'] = dni_lrn_data['state']
            cdr['dni_carrier_name'] = dni_lrn_data['carrier_name']

        # Jurisdiction determination based on ANI vs DNI comparison
        cdr['zone'] = self.determine_zone(cdr)
        cdr['jurisdiction'] = self.determine_jurisdiction(
            cdr.get('ani_ocn'), cdr.get('dni_ocn'),
            cdr.get('ani_state'), cdr.get('dni_state'),
            cdr.get('ani_lata'), cdr.get('dni_lata')
        )

        # Apply rating
        rating = self.calculate_rate(cdr)
        cdr.update(rating)

        return cdr

    def stream_to_realtime_table(self, cdr):
        """Stream to real-time monitoring table"""

        table_id = 'warp-prod.warp_telecom.cdrs_streaming'
        table = self.bq_client.get_table(table_id)

        row = {
            'call_id': cdr['call_id'],
            'customer_id': cdr['customer_id'],
            'start_time': cdr['start_time'],
            'ani': cdr['ani'],
            'dnis': cdr['dnis'],
            'duration_seconds': cdr.get('duration_seconds', 0),
            'status': cdr.get('status', 'COMPLETED')
        }

        errors = self.bq_client.insert_rows_json(table, [row])
        if errors:
            print(f"Failed to insert row: {errors}")
```

### 2. Dataflow Pipeline for Batch Processing

```java
// Apache Beam pipeline for CDR processing
package io.warp.dataflow;

import org.apache.beam.sdk.Pipeline;
import org.apache.beam.sdk.io.gcp.bigquery.BigQueryIO;
import org.apache.beam.sdk.io.gcp.pubsub.PubsubIO;
import org.apache.beam.sdk.transforms.*;
import org.apache.beam.sdk.values.PCollection;

public class CDRProcessingPipeline {

    public static void main(String[] args) {
        Pipeline pipeline = Pipeline.create(options);

        // Read from Pub/Sub
        PCollection<CDRRecord> cdrs = pipeline
            .apply("ReadFromPubSub",
                PubsubIO.readStrings()
                    .fromSubscription("projects/warp-prod/subscriptions/cdr-processing"))
            .apply("ParseCDR",
                ParDo.of(new ParseCDRFn()))
            .apply("EnrichCDR",
                ParDo.of(new EnrichCDRFn()))
            .apply("ApplyRating",
                ParDo.of(new RatingFn()));

        // Write to BigQuery
        cdrs.apply("WriteToBigQuery",
            BigQueryIO.<CDRRecord>write()
                .to("warp-prod:warp_telecom.cdrs")
                .withSchema(CDRSchema.getSchema())
                .withTimePartitioning(new TimePartitioning()
                    .setField("start_time")
                    .setType("DAY"))
                .withClustering(new Clustering()
                    .setFields(ImmutableList.of("customer_id", "trunk_id", "zone")))
                .withWriteDisposition(BigQueryIO.Write.WriteDisposition.WRITE_APPEND)
                .withCreateDisposition(BigQueryIO.Write.CreateDisposition.CREATE_NEVER));

        // Also write to real-time streaming table
        cdrs.apply("WriteToStreamingTable",
            BigQueryIO.<CDRRecord>write()
                .to("warp-prod:warp_telecom.cdrs_streaming")
                .withSchema(StreamingSchema.getSchema())
                .withWriteDisposition(BigQueryIO.Write.WriteDisposition.WRITE_APPEND));

        pipeline.run();
    }
}
```

## Query Patterns

### 1. Real-time Usage Monitoring

```sql
-- Current active calls
SELECT
  customer_id,
  COUNT(*) as active_calls,
  SUM(TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), start_time, SECOND)) as total_seconds
FROM `warp_telecom.cdrs_streaming`
WHERE start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 MINUTE)
  AND end_time IS NULL
GROUP BY customer_id;

-- Real-time message throughput
SELECT
  TIMESTAMP_TRUNC(created_at, MINUTE) as minute,
  message_type,
  COUNT(*) as message_count,
  AVG(segments) as avg_segments
FROM `warp_telecom.mdrs_streaming`
WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
GROUP BY 1, 2
ORDER BY 1 DESC;
```

### 2. Billing Queries

```sql
-- Get unbilled usage for NetSuite export with jurisdiction breakdown
SELECT
  customer_id,
  trunk_id,
  zone,
  jurisdiction,
  DATE(start_time) as usage_date,
  COUNT(*) as call_count,
  SUM(billable_seconds)/60.0 as billable_minutes,
  SUM(rated_amount) as total_charges,
  -- Additional metrics for analysis
  COUNT(DISTINCT ani_state) as unique_originating_states,
  COUNT(DISTINCT dni_state) as unique_destination_states,
  COUNT(DISTINCT ani_ocn) as unique_originating_carriers,
  COUNT(DISTINCT dni_ocn) as unique_destination_carriers
FROM `warp_telecom.cdrs`
WHERE DATE(start_time) BETWEEN @start_date AND @end_date
  AND customer_id = @customer_id
  AND invoice_id IS NULL
  AND is_test = FALSE
GROUP BY 1, 2, 3, 4, 5;

-- Message usage for billing
SELECT
  customer_id,
  message_type,
  DATE(created_at) as usage_date,
  COUNT(*) as message_count,
  SUM(total_segments_charged) as billable_segments,
  SUM(rated_amount) as total_charges
FROM `warp_telecom.mdrs`
WHERE DATE(created_at) BETWEEN @start_date AND @end_date
  AND customer_id = @customer_id
  AND invoice_id IS NULL
  AND status = 'DELIVERED'
GROUP BY 1, 2, 3;
```

### 3. Analytics Queries

```sql
-- ASR/ACD by route and jurisdiction
SELECT
  selected_vendor,
  zone,
  jurisdiction,
  COUNT(*) as attempts,
  SUM(IF(answer_time IS NOT NULL, 1, 0)) / COUNT(*) as asr,
  AVG(IF(answer_time IS NOT NULL, duration_seconds, NULL)) as acd,
  APPROX_QUANTILES(duration_seconds, 100)[OFFSET(50)] as median_duration,
  AVG(pdd_ms) as avg_pdd,
  AVG(mos) as avg_mos,
  -- Carrier distribution
  COUNT(DISTINCT ani_ocn) as unique_ani_carriers,
  COUNT(DISTINCT dni_ocn) as unique_dni_carriers,
  -- Geographic distribution
  COUNT(DISTINCT CONCAT(ani_state, '-', dni_state)) as unique_state_pairs
FROM `warp_telecom.cdrs`
WHERE DATE(start_time) = CURRENT_DATE()
GROUP BY 1, 2, 3
HAVING attempts > 100
ORDER BY asr DESC;

-- Top destinations by customer
SELECT
  customer_id,
  SUBSTR(dnis, 1, 6) as destination_prefix,
  COUNT(*) as call_count,
  SUM(billable_seconds)/60.0 as total_minutes,
  SUM(rated_amount) as total_spend
FROM `warp_telecom.cdrs`
WHERE DATE(start_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND customer_id = @customer_id
GROUP BY 1, 2
ORDER BY total_spend DESC
LIMIT 20;
```

## Cost Optimization

### 1. Partitioning Strategy
- Daily partitions for CDRs/MDRs
- 7-year retention for compliance
- Automatic partition pruning with `require_partition_filter`

### 2. Clustering
- Cluster by customer_id for billing queries
- Secondary clustering on trunk_id and zone
- Reduces data scanned by 80-90%

### 3. Materialized Views
- Pre-aggregated daily/monthly summaries
- Automatic refresh for billing queries
- 95% query cost reduction for common patterns

### 4. Storage Optimization
```sql
-- Archive old partitions to long-term storage
ALTER TABLE `warp_telecom.cdrs`
SET OPTIONS (
  partition_expiration_days=90  -- Active storage
);

-- Create archive table with Nearline storage
CREATE TABLE `warp_telecom.cdrs_archive`
LIKE `warp_telecom.cdrs`
OPTIONS(
  storage_billing_model='PHYSICAL'  -- Compressed storage
);

-- Monthly archive job
INSERT INTO `warp_telecom.cdrs_archive`
SELECT * FROM `warp_telecom.cdrs`
WHERE DATE(start_time) < DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY);
```

## Integration with Billing System

### 1. NetSuite Export Query
```sql
CREATE OR REPLACE PROCEDURE `warp_telecom.export_to_netsuite`(
  export_date DATE,
  customer_id STRING
)
BEGIN
  -- Create temporary table with rated usage
  CREATE TEMP TABLE rated_usage AS
  SELECT
    customer_id,
    trunk_id,
    zone,
    SUM(billable_seconds)/60.0 as minutes,
    SUM(rated_amount) as charges,
    COUNT(*) as call_count,
    STRING_AGG(DISTINCT call_id) as call_ids
  FROM `warp_telecom.cdrs`
  WHERE DATE(start_time) = export_date
    AND customer_id = customer_id
    AND invoice_id IS NULL
  GROUP BY 1, 2, 3;

  -- Export to Cloud Storage for NetSuite
  EXPORT DATA OPTIONS(
    uri='gs://warp-billing-exports/netsuite/*.csv',
    format='CSV',
    overwrite=true,
    header=true
  ) AS
  SELECT * FROM rated_usage;

  -- Mark CDRs as exported
  UPDATE `warp_telecom.cdrs`
  SET invoice_id = GENERATE_UUID()
  WHERE DATE(start_time) = export_date
    AND customer_id = customer_id
    AND invoice_id IS NULL;
END;
```

### 2. Real-time Balance Check
```python
def check_prepaid_balance(customer_id):
    """Check real-time usage against prepaid balance"""

    query = """
    SELECT
      SUM(rated_amount) as current_usage
    FROM `warp_telecom.cdrs_streaming`
    WHERE customer_id = @customer_id
      AND start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
      AND invoice_id IS NULL
    """

    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("customer_id", "STRING", customer_id)
        ]
    )

    result = bq_client.query(query, job_config=job_config).result()
    current_usage = list(result)[0].current_usage or 0

    # Check against Redis cached balance
    cached_balance = redis_client.get(f"balance:{customer_id}")

    return {
        'current_usage': current_usage,
        'available_balance': float(cached_balance) - current_usage,
        'can_place_call': (float(cached_balance) - current_usage) > 0
    }
```

## Monitoring & Alerts

```yaml
# BigQuery monitoring alerts
alerts:
  - name: high_ingestion_lag
    query: |
      SELECT
        TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), MAX(ingestion_time), MINUTE) as lag_minutes
      FROM `warp_telecom.cdrs_streaming`
    condition: lag_minutes > 5
    severity: WARNING

  - name: missing_partitions
    query: |
      SELECT COUNT(*) as missing_days
      FROM UNNEST(GENERATE_DATE_ARRAY(
        DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY),
        CURRENT_DATE()
      )) as date
      WHERE date NOT IN (
        SELECT DISTINCT DATE(start_time)
        FROM `warp_telecom.cdrs`
        WHERE DATE(start_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
      )
    condition: missing_days > 0
    severity: CRITICAL

  - name: high_error_rate
    query: |
      SELECT
        COUNT(*) as error_count
      FROM `warp_telecom.cdrs`
      WHERE DATE(start_time) = CURRENT_DATE()
        AND ARRAY_LENGTH(processing_errors) > 0
    condition: error_count > 100
    severity: WARNING
```