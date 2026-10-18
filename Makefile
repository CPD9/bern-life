# Targets a judge can run on a clean machine. DATABASE_URL defaults to the compose database
# (same value as .env.example) and is overridden from the environment, never read from .env.

COMPOSE ?= docker compose
PYTHON ?= python3
DATABASE_URL ?= postgresql://bernlife:bernlife@127.0.0.1:5433/bernlife
export DATABASE_URL

PSQL = $(COMPOSE) exec -T db psql -U bernlife -d bernlife -v ON_ERROR_STOP=1

# Throwaway databases are one per lane; anything else is refused so a typo cannot drop real data.
define require_lane_name
	@case "$(NAME)" in l1|l2|l3) ;; \
	  *) echo "refusing: NAME must be l1, l2 or l3 (got '$(NAME)')" >&2; exit 2 ;; esac
endef

.PHONY: help fetch db-up db-migrate db-reset-throwaway db-drop-throwaway test

help:
	@echo "make fetch                    download and verify the snapshot bundle into data/bundle/"
	@echo "make db-up                    start Postgres + pgvector on 127.0.0.1:5433"
	@echo "make db-migrate               apply migrations to DATABASE_URL"
	@echo "make db-reset-throwaway NAME=l3   drop and create bernlife_l3"
	@echo "make db-drop-throwaway NAME=l3    drop bernlife_l3"
	@echo "make test                     contracts, engine, infra, db schema, web (if present)"

fetch:
	$(PYTHON) infra/fetch_bundle.py

db/node_modules: db/package.json db/bun.lock
	cd db && bun install --frozen-lockfile
	@touch $@

db-up:
	$(COMPOSE) up -d --wait db

db-migrate: db/node_modules
	cd db && bun run migrate:deploy

db-reset-throwaway:
	$(require_lane_name)
	$(PSQL) -c 'DROP DATABASE IF EXISTS bernlife_$(NAME) WITH (FORCE)' -c 'CREATE DATABASE bernlife_$(NAME)'

db-drop-throwaway:
	$(require_lane_name)
	$(PSQL) -c 'DROP DATABASE IF EXISTS bernlife_$(NAME) WITH (FORCE)'

test: db/node_modules
	$(PYTHON) contracts/check.py
	$(PYTHON) -m ruff check .
	$(PYTHON) -m ruff format --check .
	$(PYTHON) -m unittest discover -s engine/tests
	$(PYTHON) -m unittest discover -s infra/tests -t .
	cd db && bun run validate
	@if [ -f web/package.json ]; then \
	  cd web && bun run typecheck && bun run lint && bun run test; \
	fi
