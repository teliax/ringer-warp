#!/bin/bash
# Quick fix for RTPEngine installation issues

set -e

echo "Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

echo "Creating iptables directory..."
sudo mkdir -p /etc/iptables

echo "Starting RTPEngine..."
cd /etc/rtpengine
sudo docker-compose pull
sudo systemctl daemon-reload
sudo systemctl enable rtpengine-docker
sudo systemctl start rtpengine-docker

echo "Checking status..."
sleep 5
sudo systemctl status rtpengine-docker --no-pager

echo "RTPEngine should now be running!"