"""`python -m bernlife serve`: the API over the loaded snapshot, on 127.0.0.1 only.

One database connection behind a lock: a search takes tens of milliseconds and the web app is
the only caller, so queueing is simpler than a pool and keeps every read on one snapshot. A request
allowed to go live holds the lock while the model answers, so live demos queue the rest.
"""

import logging
import os
import sys
import threading
import time
from collections.abc import Callable, Mapping, Sequence
from contextlib import AbstractContextManager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import psycopg

from bernlife import config, paths
from bernlife.admin import activity_summary, flagged_people
from bernlife.agent import EngineTools, answer
from bernlife.api_requests import SearchRequest
from bernlife.brief_search import brief_search
from bernlife.cache import Message, audit_records, cache_roots
from bernlife.catalog import read_loaded, source_list
from bernlife.database import connect_when_ready
from bernlife.embed import MODEL_ID, Embedder, e5_embedder
from bernlife.extract_records import PEOPLE_KINDS
from bernlife.health import service_health
from bernlife.llm import MockLLM, Router
from bernlife.llm import connect as connect_model
from bernlife.llm_gate import request_scope
from bernlife.numbers import numbers_report, results_dir
from bernlife.profiles_db import place_people
from bernlife.request_log import Tally
from bernlife.search import search
from bernlife.server import make_server
from bernlife.sources import Source, load_sources
from bernlife.store import PostgresStore

log = logging.getLogger("bernlife.serve")


def utc_now() -> datetime:
    return datetime.now(UTC)


class EngineApi:
    def __init__(
        self,
        conn: psycopg.Connection,
        embedder: Embedder,
        llm: Router | MockLLM,
        *,
        configured: Sequence[Source] = (),
        recorded: Path | None = None,
        audit_root: Path | None = None,
        clock: Callable[[], float] = time.monotonic,
        now: Callable[[], datetime] = utc_now,
    ):
        self._store = PostgresStore(conn)
        self._llm = llm
        self._conn = conn
        self._embedder = embedder
        self._configured = tuple(configured)
        live_root, recorded_root = cache_roots(paths.data_dir())
        self._recorded = recorded or recorded_root
        self._audit = audit_root or live_root
        self._clock, self._now = clock, now
        self._started = clock()
        self._lock = threading.Lock()

    @property
    def backend(self) -> str:
        return self._llm.backend

    def scope(self, *, live: bool) -> AbstractContextManager[Tally]:
        return request_scope(live=live)

    def health(self) -> dict[str, Any]:
        with self._lock:
            pages, profiles, sources = self._conn.execute(
                "SELECT (SELECT count(*) FROM page), (SELECT count(*) FROM profile),"
                " (SELECT count(DISTINCT source_id) FROM profile)"
            ).fetchone()
            snapshot = self._store.snapshot()
        base = {
            "mode": self._llm.backend,
            "models": {**self._llm.models(), "embed": MODEL_ID},
            "snapshot": snapshot,
            "counts": {"pages": pages, "profiles": profiles, "sources": sources},
        }
        uptime_s = int(self._clock() - self._started)
        return service_health(
            base, uptime_s, self._llm.recent_failures(), self._llm.budget_status()
        )

    def search(self, request: SearchRequest) -> dict[str, Any]:
        with self._lock:
            return search(
                request.query,
                request.sources,
                self._store,
                self._embedder,
                self._llm,
                request.kinds or PEOPLE_KINDS,
            )

    def brief(self, text: str) -> dict[str, Any]:
        with self._lock:
            return brief_search(text, None, self._store, self._embedder, self._llm)

    def agent(self, messages: list[Message]) -> dict[str, Any]:
        with self._lock:
            tools = EngineTools(self._store, self._embedder, self._llm)
            return answer(messages, tools, self._llm)

    def profile(self, profile_id: str) -> dict[str, Any] | None:
        with self._lock:
            return self._store.profiles([profile_id]).get(profile_id)

    def place_people(self, source_id: str, host: str) -> dict[str, Any]:
        with self._lock:
            snapshot = self._store.snapshot()
            people, total = place_people(self._conn, source_id, host)
        return {"snapshot": snapshot, "people": people, "total": total}

    def sources(self) -> dict[str, Any]:
        with self._lock:
            snapshot = self._store.snapshot()
            loaded = read_loaded(self._conn)
        return {"snapshot": snapshot, "sources": source_list(loaded, self._configured)}

    def numbers(self) -> dict[str, Any]:
        with self._lock:
            snapshot = self._store.snapshot()
        return numbers_report(snapshot, self._now(), self._recorded, results_dir())

    def admin_activity(self) -> dict[str, Any]:
        """The audit is a file the router appends to, so it is read without the database lock;
        the budget comes from the router, as /api/health shows it."""
        budget = self._llm.budget_status()
        return activity_summary(audit_records(self._audit), self._now().date(), budget)

    def admin_flagged(self) -> dict[str, Any]:
        with self._lock:
            snapshot = self._store.snapshot()
            people, checked = flagged_people(self._conn)
        return {"snapshot": snapshot, "checked": checked, "people": people}

    def source_ids(self) -> set[str]:
        with self._lock:
            return {row[0] for row in self._conn.execute("SELECT id FROM source").fetchall()}


def main(argv: Sequence[str], env: Mapping[str, str] = os.environ) -> int:
    if argv:
        print("usage: python -m bernlife serve", file=sys.stderr)
        return 2
    logging.basicConfig(
        level=logging.INFO, stream=sys.stdout, format="%(asctime)s %(name)s %(message)s"
    )
    conn = connect_when_ready(config.database_url(env))
    conn.autocommit = True
    if PostgresStore(conn).snapshot() == "none":
        print("serve: no bundle loaded; run python -m bernlife load first", file=sys.stderr)
        return 1
    data = paths.data_dir(env)
    live_root, recorded_root = cache_roots(data)
    api = EngineApi(
        conn,
        e5_embedder(data),
        connect_model(env, serving=True),
        configured=load_sources(),
        recorded=recorded_root,
        audit_root=live_root,
    )
    server = make_server(api, config.engine_port(env))
    log.info("serving on http://127.0.0.1:%d", server.server_address[1])
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        conn.close()
    return 0
