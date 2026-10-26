#!/bin/sh
# Creates the team, admin and test accounts on the VM with the repo's own script
# (web/scripts/accounts-seed.ts), run from the web image's build stage on the compose network.
# It prints each new handle and password once: ./seed.sh > ~/accounts.txt, then keep that file
# private (chmod 600) and delete it once the passwords are handed over. Existing handles keep their
# password and take the role the list gives them: run it once more after the role migration lands
# so `admin` becomes an admin.
set -eu
cd "$(dirname "$0")"
. ./.env
docker build -q -f ../../web/Dockerfile --target build -t bernlife-web-build ../.. >/dev/null
docker run --rm --network bernlife-prod_default \
  -e DATABASE_URL="postgresql://bernlife:${POSTGRES_PASSWORD}@db:5432/bernlife" \
  bernlife-web-build bun scripts/accounts-seed.ts
