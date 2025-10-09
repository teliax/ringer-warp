# Jasmin Redis Architecture
## Multi-Pod High Availability with Redis State Sharing

**Date**: October 2025
**Status**: Production Architecture

---

## Overview

Jasmin uses Redis for **runtime state sharing** across multiple pods, enabling true high availability with automatic failover.

## Redis Benefits in Your 2-Pod Setup

### 1. **Delivery Receipt (DLR) Tracking** - Critical for SMS

**Problem Without Redis:**
```
Customer → Pod A → Sinch (sends SMS)
Sinch → Pod B ← DLR received
Pod B: "Unknown message ID" ❌
Customer never gets DLR webhook
```

**With Redis:**
```
Pod A sends SMS:
- Stores: Redis["dlr:msg_12345"] = {customer_id, webhook_url, metadata}

Pod B receives DLR:
- Looks up: Redis["dlr:msg_12345"]
- Finds customer webhook
- Delivers DLR ✅
```

**Configuration:**
```ini
[message-persistence]
store_type = redis
expire_time = 86400  # 24 hours
```

### 2. **Message Queue Persistence**

**Queue Storage:**
- Submit_sm requests queued in Redis
- If pod crashes mid-send, message not lost
- Other pod picks up from queue

**Benefits:**
- Zero message loss during pod restarts
- Graceful degradation under load
- Queue depth monitoring

### 3. **Rate Limiting Across Pods**

**Shared Counters:**
```
Customer has 100 msg/sec limit
Pod A: 60 msg/sec → Redis["rate:customer_123"] = 60
Pod B: 50 msg/sec → Redis incr → 110 ❌ rejected
```

**Without Redis:**
```
Pod A: 100 msg/sec ✅
Pod B: 100 msg/sec ✅
Total: 200 msg/sec (limit violated!)
```

### 4. **Session State for SMPP Clients**

**Bind Sessions:**
- SMPP client binds to Pod A
- Pod A stores session in Redis
- Pod A crashes → Pod B can resume session

**Reconnection Logic:**
```python
# Jasmin checks Redis for existing session
if redis.exists(f"session:{system_id}"):
    resume_session()
else:
    create_new_session()
```

### 5. **10DLC Campaign Cache**

Your interceptor uses Redis for 10DLC compliance:
```python
# Check campaign registration
campaign = redis.get(f"10dlc:campaign:{source_number}")

# Rate limiting
redis.incr(f"10dlc:rate:{source}:{hour}")
redis.incr(f"10dlc:daily:{source}:{date}")
```

**Shared across pods** - consistent enforcement.

---

## Redis Database Allocation

**Current Configuration:**
```
Database 0: Kamailio (usrloc, dialog, rtpengine, dispatcher)
Database 1: Jasmin (DLR, sessions, cache)
Database 2: Jasmin Interceptor (10DLC campaigns, rate limits)
Database 5: (Reserved for future RTPEngine state sync)
```

---

## What Redis Does NOT Handle

❌ **SMPP Connector Configurations**
- Stored in: `/etc/jasmin/store/jcli-prod.smppccs` (files)
- Not in Redis
- Lost on pod restart with emptyDir

❌ **Routing Rules**
- Stored in: `/etc/jasmin/store/jcli-prod.mtroutes` (files)
- Not in Redis

❌ **User Accounts**
- Stored in: `/etc/jasmin/store/jcli-prod.users` (files)

---

## Proper Architecture (PostgreSQL + Redis)

### Configuration (PostgreSQL) - Cold Storage
```
service_providers table (PostgreSQL)
    ↓
On pod startup: Read from PostgreSQL
    ↓
Create connectors via jCli
    ↓
Connectors active in memory
```

**Benefits:**
- ✅ Survives pod restarts
- ✅ Centralized management via API
- ✅ Version control, audit trails
- ✅ Both pods load same config

### Runtime State (Redis) - Hot Storage
```
Message sent (Pod A) → Redis DLR tracking
Message queued → Redis queue
Rate limit check → Redis counter
DLR received (Pod B) → Redis lookup → Webhook delivered
```

**Benefits:**
- ✅ Millisecond latency
- ✅ Shared across pods
- ✅ Automatic failover
- ✅ No data loss

---

## Implementation Plan

### Phase 1: Vendor Sync on Startup (Current)
```yaml
initContainers:
- name: sync-vendors
  image: postgres:15
  command: ["/scripts/sync-vendors-from-db.sh"]
  env:
    - DATABASE_HOST: 10.126.0.3
    - DATABASE_USER: warp
    - DATABASE_PASSWORD: <from secret>
  volumeMounts:
    - /scripts
```

**Script:**
1. Query PostgreSQL for active vendors
2. Wait for Jasmin to start
3. Create each connector via jCli
4. Start binds for priority=1 vendors

### Phase 2: Automatic Sync (Future)
- API creates vendor → PostgreSQL + immediate jCli update
- Periodic sync job (every 5 minutes)
- Webhook on vendor change → sync to Jasmin

### Phase 3: Redis State Monitoring
- Monitor DLR hit rate
- Track queue depth
- Alert on Redis connection issues

---

## Current State

**Working:**
- ✅ Redis connected (dbid=1)
- ✅ Message persistence enabled
- ✅ DLR tracking configured

**Missing:**
- ❌ Vendor sync from PostgreSQL on startup
- ❌ SMPP connectors lost on restart

**Next:**
Add init container to sync vendors from PostgreSQL → jCli on pod startup.

---

**Summary:**
- **Redis**: Real-time state (DLRs, queues, sessions) - SHARED across pods
- **PostgreSQL**: Configuration (vendors, routes, users) - PERSISTENT across restarts
- **Files**: Only temporary (created from PostgreSQL on startup)

This is the correct architecture for carrier-grade HA.
