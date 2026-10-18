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

.PHONY: help fetch db-up db-migrate db-reset-throwaway db-drop-throwaway test live eval eval-fixture

help:
	@echo "make fetch                    download and verify the snapshot bundle into data/bundle/"
	@echo "make db-up                    start Postgres + pgvector on 127.0.0.1:5433"
	@echo "make db-migrate               apply migrations to DATABASE_URL"
	@echo "make db-reset-throwaway NAME=l3   drop and create bernlife_l3"
	@echo "make db-drop-throwaway NAME=l3    drop bernlife_l3"
	@echo "make test                     contracts, engine, infra, db schema, web (if present)"
	@echo "make live ARGS=<command>      stop unless the model endpoint in .env answers, then run it"
	@echo "make eval [PRED=<file>]       score predictions against eval/gold.jsonl (default: the bundle's)"
	@echo "make eval-fixture             the same on the invented fixture in eval/tests/fixtures/"

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
	PYTHONPATH=eval/src $(PYTHON) -m unittest discover -s eval/tests
	cd db && bun run validate
	@if [ -f web/package.json ]; then \
	  cd web && bun run typecheck && bun run lint && bun run test; \
	fi

# The model endpoints and keys live only in .env, so this one target reads it, in its own shell.
# health refuses unless the endpoint answers and serves the configured model: a live run never
# falls back to the cache or the mock.
live:
	@set -a; [ ! -f .env ] || . ./.env; set +a; \
	export BERNLIFE_BACKEND=live PYTHONPATH=engine/src; \
	$(PYTHON) -m bernlife health && { [ -z "$(ARGS)" ] || $(PYTHON) -m bernlife $(ARGS); }

# The evaluator is separate code from the search: it reads the bundle's files and imports nothing
# from engine/. The bundle sits where make fetch puts it.
BUNDLE ?= $(or $(BERNLIFE_DATA_DIR),data)/bundle
PRED ?= $(BUNDLE)/predictions.jsonl
EVALUATOR = PYTHONPATH=eval/src $(PYTHON) -m evaluator --gold eval/gold.jsonl
FIXTURE = eval/tests/fixtures

eval:
	$(EVALUATOR) --predictions $(PRED) --pages $(BUNDLE)/pages.jsonl --profiles $(BUNDLE)/profiles.jsonl

eval-fixture:
	$(EVALUATOR) --predictions $(FIXTURE)/predictions.jsonl --pages $(FIXTURE)/pages.jsonl \
	  --profiles $(FIXTURE)/profiles.jsonl --out eval/out/fixture
