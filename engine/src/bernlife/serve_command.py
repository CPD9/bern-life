"""`python -m bernlife serve`: the API over the loaded snapshot, on 127.0.0.1 only.

One database connection behind a lock: a search takes tens of milliseconds and the web app is
the only caller, so queueing is simpler than a pool and keeps every read on one snapshot.
"""

import logging
import os
import sys
import threading
import time
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

import psycopg

from bernlife import config, paths
from bernlife.brief_search import brief_search
from bernlife.database import connect
from bernlife.embed import MODEL_ID, Embedder, e5_embedder
from bernlife.extract_records import PEOPLE_KINDS
from bernlife.llm import Chat
from bernlife.llm import connect as connect_model
from bernlife.search import search
from bernlife.server import SearchRequest, make_server
from bernlife.store import PostgresStore

log = logging.getLogger("bernlife.serve")


class EngineApi:
    def __init__(self, conn: psycopg.Connection, embedder: Embedder, llm: Chat):
        self._store = PostgresStore(conn)
        self._llm = llm
        self._conn = conn
        self._embedder = embedder
        self._lock = threading.Lock()

    def health(self) -> dict[str, Any]:
        with self._lock:
            pages, profiles, sources = self._conn.execute(
                "SELECT (SELECT count(*) FROM page), (SELECT count(*) FROM profile),"
                " (SELECT count(DISTINCT source_id) FROM profile)"
            ).fetchone()
            snapshot = self._store.snapshot()
        return {
            "mode": self._llm.backend,
            "models": {**self._llm.models(), "embed": MODEL_ID},
            "snapshot": snapshot,
            "counts": {"pages": pages, "profiles": profiles, "sources": sources},
        }

    def search(self, request: SearchRequest) -> dict[str, Any]:
        started = time.monotonic()
        with self._lock:
            response = search(
                request.query,
                request.sources,
                self._store,
                self._embedder,
                self._llm,
                request.kinds or PEOPLE_KINDS,
            )
        elapsed_ms = (time.monotonic() - started) * 1000
        log.info("search %.0f ms, %d results", elapsed_ms, len(response["results"]))
        return response

    def brief(self, text: str) -> dict[str, Any]:
        with self._lock:
            return brief_search(text, None, self._store, self._embedder, self._llm)

    def profile(self, profile_id: str) -> dict[str, Any] | None:
        with self._lock:
            return self._store.profiles([profile_id]).get(profile_id)

    def source_ids(self) -> set[str]:
        with self._lock:
            return {row[0] for row in self._conn.execute("SELECT id FROM source").fetchall()}


def main(argv: Sequence[str], env: Mapping[str, str] = os.environ) -> int:
    if argv:
        print("usage: python -m bernlife serve", file=sys.stderr)
        return 2
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
    conn = connect(config.database_url(env))
    conn.autocommit = True
    if PostgresStore(conn).snapshot() == "none":
        print("serve: no bundle loaded; run python -m bernlife load first", file=sys.stderr)
        return 1
    api = EngineApi(conn, e5_embedder(Path(paths.data_dir(env))), connect_model(env))
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
