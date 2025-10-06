# RTPEngine Deployment Checklist

## Pre-Deployment Verification
- [ ] SSH access confirmed to all RTPEngine VMs:
  - [ ] VM1: 34.123.38.31
  - [ ] VM2: 35.222.101.214
  - [ ] VM3: 35.225.65.80
- [ ] SSH user: `debian` (or appropriate user)
- [ ] SSH key available at: `~/.ssh/id_rsa`
- [ ] Redis server accessible at: 10.0.0.100:6379
- [ ] Homer server (optional) accessible at: 10.0.0.200:9060

## Deployment Steps

### Phase 1: Infrastructure Preparation
- [ ] Update SSH credentials in deployment script
- [ ] Verify network connectivity between VMs
- [ ] Ensure firewall rules allow:
  - [ ] Control ports: 22222 (TCP/UDP)
  - [ ] RTP ports: 30000-40000 (UDP)
  - [ ] Prometheus metrics: 9103 (TCP)
  - [ ] CLI management: 22223 (TCP, localhost only)

### Phase 2: RTPEngine Installation (Per VM)
- [ ] **VM1 (34.123.38.31)**
  - [ ] Run installation script
  - [ ] Copy configuration file (rtpengine-vm1.conf)
  - [ ] Generate SSL certificates
  - [ ] Configure firewall
  - [ ] Start service
  - [ ] Verify service status
  
- [ ] **VM2 (35.222.101.214)**
  - [ ] Run installation script
  - [ ] Copy configuration file (rtpengine-vm2.conf)
  - [ ] Generate SSL certificates
  - [ ] Configure firewall
  - [ ] Start service
  - [ ] Verify service status
  
- [ ] **VM3 (35.225.65.80)**
  - [ ] Run installation script
  - [ ] Copy configuration file (rtpengine-vm3.conf)
  - [ ] Generate SSL certificates
  - [ ] Configure firewall
  - [ ] Start service
  - [ ] Verify service status

### Phase 3: Redis Configuration
- [ ] Install Redis client on all RTPEngine VMs
- [ ] Test Redis connectivity from each VM
- [ ] Verify Redis database 1 is available for RTPEngine

### Phase 4: Kamailio Integration
- [ ] Update Kamailio configuration with RTPEngine endpoints
- [ ] Add load balancing configuration
- [ ] Configure NAT traversal settings
- [ ] Enable WebRTC support if needed
- [ ] Restart Kamailio service
- [ ] Test Kamailio-RTPEngine communication

### Phase 5: Monitoring Setup
- [ ] Configure Prometheus to scrape RTPEngine metrics
- [ ] Set up Grafana dashboards
- [ ] Configure Homer integration (optional)
- [ ] Set up log aggregation

### Phase 6: Verification
- [ ] Run status check script on each VM
- [ ] Perform test calls through each RTPEngine instance
- [ ] Verify load balancing is working
- [ ] Check Redis session sharing
- [ ] Monitor resource usage
- [ ] Review logs for errors

## Post-Deployment Tasks
- [ ] Document final configuration
- [ ] Create backup of configuration files
- [ ] Set up automated monitoring alerts
- [ ] Schedule regular health checks
- [ ] Document troubleshooting procedures

## Rollback Plan
- [ ] Keep original Kamailio configuration backed up
- [ ] Document service stop procedures
- [ ] Have firewall rule rollback commands ready
- [ ] Prepare quick disable commands for Kamailio

## Sign-off
- [ ] Development environment tested
- [ ] Staging environment tested
- [ ] Production deployment approved
- [ ] Operations team briefed
- [ ] Documentation completed

Date: _______________
Deployed by: _______________
Reviewed by: _______________