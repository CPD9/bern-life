#!/bin/sh
# Mints sign-up invite codes on the VM with the repo's own script (web/scripts/invite-create.ts),
# run from the web image's build stage on the compose network: ./invite.sh [count]
set -eu
cd "$(dirname "$0")"
. ./.env
docker build -q -f ../../web/Dockerfile --target build -t bernlife-web-build ../.. >/dev/null
docker run --rm --network bernlife-prod_default \
  -e DATABASE_URL="postgresql://bernlife:${POSTGRES_PASSWORD}@db:5432/bernlife" \
  bernlife-web-build bun scripts/invite-create.ts --count "${1:-1}"
