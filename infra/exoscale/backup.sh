#!/bin/sh
# Nightly database backup on the VM (cron: /etc/cron.d/bernlife-backup). Keeps 14 days in
# /var/backups/bernlife; infra/exoscale.md has the restore command and the off-VM copy.
set -eu
umask 077
dir=/var/backups/bernlife
mkdir -p "$dir"
file="$dir/bernlife-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
docker compose -f /opt/bernlife/infra/exoscale/compose.yaml exec -T db \
  pg_dump -U bernlife -d bernlife --no-owner | gzip > "$file.part"
mv "$file.part" "$file"
find "$dir" -name 'bernlife-*.sql.gz' -mtime +14 -delete
