#!/bin/bash
# Script to delete old VMs with "dev" in their names

PROJECT_ID="ringer-472421"

echo "⚠️  WARNING: This will delete the following VMs:"
echo "- warp-dev-consul-server-1 (us-central1-a)"
echo "- warp-dev-consul-server-2 (us-central1-b)"
echo "- warp-dev-consul-server-3 (us-central1-c)"
echo "- warp-dev-rtpengine-1 (us-central1-a)"
echo "- warp-dev-rtpengine-2 (us-central1-b)"
echo ""
echo "Make sure new instances are created and configured first!"
echo ""
read -p "Are you sure you want to proceed? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo "Deleting old VMs..."

# Delete Consul servers
gcloud compute instances delete warp-dev-consul-server-1 --zone=us-central1-a --project=${PROJECT_ID} --quiet &
gcloud compute instances delete warp-dev-consul-server-2 --zone=us-central1-b --project=${PROJECT_ID} --quiet &
gcloud compute instances delete warp-dev-consul-server-3 --zone=us-central1-c --project=${PROJECT_ID} --quiet &

# Delete RTPEngine instances
gcloud compute instances delete warp-dev-rtpengine-1 --zone=us-central1-a --project=${PROJECT_ID} --quiet &
gcloud compute instances delete warp-dev-rtpengine-2 --zone=us-central1-b --project=${PROJECT_ID} --quiet &

echo "Deletion commands started in background. Check status with:"
echo "gcloud compute operations list --filter='operationType:delete' --project=${PROJECT_ID}"