#!/bin/sh
# One-command rollback to the DEMO fixtures: stops the engine and restarts the web app on its own
# network with DEMO_FIXTURES=1. `docker compose up -d` (compose.yaml alone) brings search back.
set -eu
cd "$(dirname "$0")"
docker compose rm --stop --force load serve
docker compose -f compose.yaml -f compose.demo.yaml up -d --wait web caddy
