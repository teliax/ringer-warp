#!/bin/bash
# Fix APT sources by removing deprecated Sipwise repository

echo "Removing deprecated Sipwise repository..."
sudo rm -f /etc/apt/sources.list.d/sipwise.list
sudo rm -f /etc/apt/sources.list.d/sipwise*.list

echo "Cleaning APT cache..."
sudo apt-get clean
sudo apt-get update

echo "APT sources fixed!"