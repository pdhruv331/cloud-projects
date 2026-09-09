#!/usr/bin/env bash
# Nightly backup of the n8n data volume to S3.
# Install:  sudo cp backup.sh /etc/cron.daily/n8n-backup && sudo chmod +x /etc/cron.daily/n8n-backup
# Requires: the EC2 instance role (or aws configure) to allow s3:PutObject on the bucket.
set -euo pipefail

BUCKET="s3://builtbydhruv-backups/n8n"
VOLUME="n8n_n8n_data"                 # <projectdir>_n8n_data — run `docker volume ls` to confirm
STAMP="$(date +%F)"
TMP="/tmp/n8n-${STAMP}.tgz"

docker run --rm -v "${VOLUME}":/data -v /tmp:/out alpine \
  tar czf "/out/n8n-${STAMP}.tgz" -C /data .

aws s3 cp "${TMP}" "${BUCKET}/"
rm -f "${TMP}"

echo "backed up ${VOLUME} -> ${BUCKET}/n8n-${STAMP}.tgz"
