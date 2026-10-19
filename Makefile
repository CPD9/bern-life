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
.PHONY: pack-cache bundle run live-run stop predict-consistency

help:
	@echo "make fetch                    download and verify the snapshot bundle into data/bundle/"
	@echo "make run                      Postgres, engine and web replaying the bundle on 127.0.0.1:3000"
	@echo "make live-run                 make run with live model calls for signed-in users (remote endpoints)"
	@echo "make stop                     stop what make run or make live-run started (the database keeps running)"
	@echo "make db-up                    start Postgres + pgvector on 127.0.0.1:5433"
	@echo "make db-migrate               apply migrations to DATABASE_URL"
	@echo "make db-reset-throwaway NAME=l3   drop and create bernlife_l3"
	@echo "make db-drop-throwaway NAME=l3    drop bernlife_l3"
	@echo "make test                     contracts, engine, infra, db schema, web (if present)"
	@echo "make live ARGS=<command>      stop unless the model endpoint in ENV_FILE (.env) answers, then run it"
	@echo "make eval [PRED=<file>]       score predictions against eval/gold.jsonl (default: the bundle's)"
	@echo "make predict-consistency      criterion 2's wording sets through search in replay, for make eval"
	@echo "make eval-fixture             the same on the invented fixture in eval/tests/fixtures/"
	@echo "make pack-cache               fold recorded model calls into the bundle's cache pack"
	@echo "make bundle [BUNDLE_VERSION=bundle-YYYYMMDD-N]   check and pack the snapshot bundle"

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

# The model endpoints and keys live only in the env file (ENV_FILE), so only the live targets read
# it, each in its own shell. LIVE_DATA_DIR and LIVE_DATABASE_URL point a recording (make live) at
# another data folder and database without anyone opening that file. health refuses unless the
# endpoint answers and serves the configured model: a live run never falls back to the cache or
# the mock.
ENV_FILE ?= ./.env
LIVE_HEALTH = set -a; [ ! -f "$(abspath $(ENV_FILE))" ] || . "$(abspath $(ENV_FILE))"; set +a; \
	$(if $(LIVE_DATA_DIR),export BERNLIFE_DATA_DIR="$(LIVE_DATA_DIR)";) \
	$(if $(LIVE_DATABASE_URL),export DATABASE_URL="$(LIVE_DATABASE_URL)";) \
	export BERNLIFE_BACKEND=live PYTHONPATH=engine/src; \
	$(PYTHON) -m bernlife health

live:
	@$(LIVE_HEALTH) && { [ -z "$(ARGS)" ] || $(PYTHON) -m bernlife $(ARGS); }

# The evaluator is separate code from the search: it reads the bundle's files and imports nothing
# from engine/. The bundle sits where make fetch puts it.
BUNDLE ?= $(or $(BERNLIFE_DATA_DIR),data)/bundle
PRED ?= $(BUNDLE)/predictions.jsonl
EVALUATOR = PYTHONPATH=eval/src $(PYTHON) -m evaluator --gold eval/gold.jsonl
FIXTURE = eval/tests/fixtures
# Criterion 2's wording sets (eval/consistency.jsonl) are not in the bundle: predict-consistency
# runs them through the engine's own predict in replay, so no model is called and a wording nobody
# recorded is searched plain. make eval adds them once that file exists (refused when it was
# searched on another bundle), and scores the filled labelling sheets of criterion 4 when LABELS
# names their folder; the sheets name people, so they are never committed.
CONSISTENCY_PRED ?= $(or $(BERNLIFE_DATA_DIR),data)/eval/consistency_predictions.jsonl
CONSISTENCY_QUERIES = $(dir $(CONSISTENCY_PRED))consistency_queries.jsonl
EVAL_EXTRA = $(if $(wildcard $(CONSISTENCY_PRED)),--consistency eval/consistency.jsonl \
	--consistency-predictions $(CONSISTENCY_PRED)) $(if $(LABELS),--labels $(LABELS))

eval:
	$(EVALUATOR) --predictions $(PRED) --pages $(BUNDLE)/pages.jsonl --profiles $(BUNDLE)/profiles.jsonl \
	  $(EVAL_EXTRA)

predict-consistency:
	@mkdir -p $(dir $(CONSISTENCY_PRED))
	PYTHONPATH=eval/src $(PYTHON) -m evaluator.consistency eval/consistency.jsonl > $(CONSISTENCY_QUERIES)
	BERNLIFE_BACKEND=replay PYTHONPATH=engine/src $(PYTHON) -m bernlife predict \
	  --gold $(CONSISTENCY_QUERIES) --out $(CONSISTENCY_PRED)

eval-fixture:
	$(EVALUATOR) --predictions $(FIXTURE)/predictions.jsonl --pages $(FIXTURE)/pages.jsonl \
	  --profiles $(FIXTURE)/profiles.jsonl --out eval/out/fixture

# The bundle is built where the data is: crawl, extraction, predictions and the model cache under
# BERNLIFE_DATA_DIR. pack-cache never deletes; `python -m infra.pack_cache --prune` does, by hand.
BUNDLE_VERSION ?= bundle-$(shell date +%Y%m%d)-1

pack-cache:
	PYTHONPATH=engine/src $(PYTHON) -m infra.pack_cache

bundle: pack-cache
	PYTHONPATH=engine/src $(PYTHON) -m infra.build_bundle --version $(BUNDLE_VERSION)

# The judge's path: make fetch && make run. Compose migrates, loads the bundle, serves it and starts
# the production web app; the bundle folder is passed in so a .env cannot point compose elsewhere.
WEB_PORT ?= 3000
RUN_COMPOSE = BERNLIFE_BUNDLE_DIR=$(abspath $(BUNDLE)) WEB_PORT=$(WEB_PORT) $(COMPOSE) --profile run
RUN_SERVICES = migrate load serve web

run:
	@[ -f $(BUNDLE)/pages.jsonl ] || { echo "No snapshot bundle in $(BUNDLE); run make fetch first." >&2; exit 1; }
	@$(RUN_COMPOSE) up -d --build --wait $(RUN_SERVICES) || { \
	  $(RUN_COMPOSE) logs --no-log-prefix load; exit 1; }
	@$(PYTHON) -m infra.wait_ready --url http://127.0.0.1:$(WEB_PORT)

# make run with the compose profile live, after the same health check as make live (stop make run
# first: both publish WEB_PORT). Compose reads no env file of its own: every value comes from
# ENV_FILE, sourced by the health check, or from here. A loopback vLLM tunnel is out of the
# containers' reach, so remote endpoints only.
# The engine may call the model only for requests the web app marks live (signed-in users under
# their limits), within LLM_CALL_BUDGET (unset: none). An engine that does not keep to that would
# call it for anyone, so the web app starts only once the engine reports its budget on /api/health
# (contracts/api.md). Until then nothing reaches the engine: it takes loopback requests only, and
# no web app runs beside it yet.
# The volume bernlife_llm_cache holds what signed-in users typed or uploaded, inside model prompts
# and answers, so it never goes into the bundle: make stop, then docker volume rm bernlife_llm_cache
# deletes it.
LIVE_COMPOSE = BERNLIFE_BUNDLE_DIR=$(abspath $(BUNDLE)) WEB_PORT=$(WEB_PORT) BERNLIFE_LIVE_BACKEND=live \
	$(COMPOSE) --env-file /dev/null --profile live
LIVE_ENGINE = migrate load serve-live
LIVE_SERVICES = $(LIVE_ENGINE) web-live
LIVE_BUDGET_CHECK = import json, urllib.request as u; \
	h = json.load(u.urlopen('http://127.0.0.1:8100/api/health', timeout=5)); \
	raise SystemExit(0 if h.get('mode') == 'live' and isinstance(h.get('budget'), dict) else 1)

# One shell from the health check on, so every compose call sees the same sourced values.
live-run:
	@[ -f $(BUNDLE)/pages.jsonl ] || { echo "No snapshot bundle in $(BUNDLE); run make fetch first." >&2; exit 1; }
	@$(LIVE_HEALTH) && { $(LIVE_COMPOSE) up -d --build --wait $(LIVE_ENGINE) || { \
	  $(LIVE_COMPOSE) logs --no-log-prefix load serve-live; exit 1; }; } && \
	{ $(LIVE_COMPOSE) exec -T serve-live python -c "$(LIVE_BUDGET_CHECK)" || { \
	  echo "The engine reports no live call budget on /api/health, so nothing would keep its model calls within LLM_CALL_BUDGET; serve-live stopped." >&2; \
	  $(LIVE_COMPOSE) rm --stop --force serve-live; exit 1; }; } && \
	$(LIVE_COMPOSE) up -d --build --wait --no-deps web-live
	@$(PYTHON) -m infra.wait_ready --url http://127.0.0.1:$(WEB_PORT)

# Only the run and live-run services: the database is shared by every worktree's lane.
stop:
	$(RUN_COMPOSE) --profile live rm --stop --force $(sort $(RUN_SERVICES) $(LIVE_SERVICES))
