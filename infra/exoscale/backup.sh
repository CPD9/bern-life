#!/bin/sh
# Nightly backup on the VM (cron: /etc/cron.d/bernlife-backup). Each run is one folder in
# /var/backups/bernlife, kept 14 days: the database, the uploaded documents and Caddy's data (the
# certificate and its ACME account key). Documents are files named by sha256 whose rows live in
# the database, so both come from the same run. A folder appears only when every part is written;
# a failed run leaves bernlife-<time>.part. Restore and the off-VM copy: infra/exoscale.md.
set -eu
umask 077
dir=/var/backups/bernlife
run="$dir/bernlife-$(date -u +%Y%m%dT%H%M%SZ)"

compose() {
  docker compose -f /opt/bernlife/infra/exoscale/compose.yaml "$@"
}

mkdir -p "$run.part"
# No pipe on this side: sh has no pipefail, so a dump cut short would still gzip into a file that
# looks whole. The db image's bash has it; tar compresses by itself.
compose exec -T db bash -o pipefail -c 'pg_dump -U bernlife -d bernlife --no-owner | gzip' \
  > "$run.part/db.sql.gz"
compose exec -T web tar -czf - -C /data/uploads . > "$run.part/uploads.tar.gz"
compose exec -T caddy tar -czf - -C /data . > "$run.part/caddy-data.tar.gz"
mv "$run.part" "$run"
# Folders, failed runs, and the single dump files written before folders.
find "$dir" -mindepth 1 -maxdepth 1 -name 'bernlife-*' -mtime +14 -exec rm -rf {} +
