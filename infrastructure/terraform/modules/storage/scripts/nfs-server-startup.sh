#!/bin/bash
# NFS Server Startup Script
# Configures NFS server for Jasmin shared storage

set -e

echo "🚀 Starting NFS server configuration..."

# Update system
apt-get update
apt-get install -y nfs-kernel-server nfs-common

# Format and mount data disk
DATA_DISK="/dev/disk/by-id/google-nfs-data"
MOUNT_POINT="/mnt/nfs-data"

if [ -b "$DATA_DISK" ]; then
  echo "📦 Setting up data disk..."

  # Check if disk is formatted
  if ! blkid "$DATA_DISK"; then
    echo "Formatting data disk..."
    mkfs.ext4 -F "$DATA_DISK"
  fi

  # Create mount point
  mkdir -p "$MOUNT_POINT"

  # Mount disk
  if ! mount | grep -q "$MOUNT_POINT"; then
    mount "$DATA_DISK" "$MOUNT_POINT"
    echo "✅ Data disk mounted at $MOUNT_POINT"
  fi

  # Add to fstab for persistence
  if ! grep -q "$MOUNT_POINT" /etc/fstab; then
    DISK_UUID=$(blkid -s UUID -o value "$DATA_DISK")
    echo "UUID=$DISK_UUID $MOUNT_POINT ext4 defaults,nofail 0 2" >> /etc/fstab
  fi
else
  echo "⚠️  Data disk not found, using root filesystem"
  MOUNT_POINT="/"
fi

# Create NFS export directory
EXPORT_DIR="$MOUNT_POINT${export_path}"
mkdir -p "$EXPORT_DIR"
chmod 777 "$EXPORT_DIR"

echo "✅ Created export directory: $EXPORT_DIR"

# Configure NFS exports
# Allow both GKE nodes (10.0.0.0/24) and pods (10.1.0.0/16)
cat > /etc/exports <<EOF
# Jasmin shared storage for GKE cluster (nodes + pods)
$EXPORT_DIR 10.0.0.0/16(rw,sync,no_subtree_check,no_root_squash)
EOF

echo "✅ NFS exports configured"

# Enable and start NFS server
systemctl enable nfs-server
systemctl restart nfs-server
systemctl restart nfs-kernel-server

# Export the NFS shares
exportfs -ra
exportfs -v

echo "✅ NFS server started and exports applied"

# Display status
echo ""
echo "📊 NFS Server Status:"
showmount -e localhost

echo ""
echo "🎉 NFS server configuration complete!"
echo "   Export path: $EXPORT_DIR"
echo "   Allowed clients: ${gke_pod_cidr}"
