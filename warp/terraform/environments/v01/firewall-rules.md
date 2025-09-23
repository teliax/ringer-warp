# Firewall Rules Created by Terraform

1. **Internal Communication**: Allow all internal VPC traffic
2. **SSH Access**: Port 22 from allowed IPs
3. **SIP Signaling**: UDP/TCP 5060 from allowed IPs
4. **RTP Media**: UDP 10000-20000 from anywhere
5. **Consul**: Ports 8300-8302, 8500-8502 internal only
6. **Monitoring**: Prometheus, Grafana ports internal only
7. **HTTPS**: Port 443 for API and web access