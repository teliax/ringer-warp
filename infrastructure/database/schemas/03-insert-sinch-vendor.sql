-- Manual data migration: Insert Sinch_Atlanta into new messaging.vendors table
-- Run this as user 'warp' or 'postgres' (warp_app may not have cross-schema access)

-- Insert Sinch_Atlanta vendor data
INSERT INTO messaging.vendors (
    id,
    provider_type,
    instance_name,
    display_name,
    host,
    port,
    use_tls,
    bind_type,
    username,
    password,
    system_type,
    throughput,
    priority,
    is_primary,
    is_active,
    created_at,
    updated_at
) VALUES (
    '9e22660d-6f2e-4761-8729-f4272d30eb71'::uuid,
    'smpp',
    'Sinch_Atlanta',
    'Sinch Atlanta',
    'msgbrokersmpp-atl.inteliquent.com',
    3601,
    true,  -- use_tls
    'transceiver',
    'telxMBa1',  -- username
    '7C8Rx9{A',  -- password
    'cp',  -- system_type (Sinch requirement)
    100,  -- throughput (msgs/sec)
    2,  -- priority
    false,  -- is_primary
    true,  -- is_active
    '2025-10-10 18:22:32.771959',
    '2025-10-10 18:22:32.771959'
)
ON CONFLICT (instance_name) DO UPDATE SET
    host = EXCLUDED.host,
    port = EXCLUDED.port,
    use_tls = EXCLUDED.use_tls,
    bind_type = EXCLUDED.bind_type,
    username = EXCLUDED.username,
    password = EXCLUDED.password,
    system_type = EXCLUDED.system_type,
    updated_at = NOW();

-- Verify
SELECT instance_name, host, port, use_tls, bind_type, username, system_type, is_active
FROM messaging.vendors
WHERE instance_name = 'Sinch_Atlanta';
