"""Connections to the engine's Postgres, with the session settings search relies on.

Iterative HNSW scans keep reading the index until enough rows pass a source filter, instead of
filtering the first `ef_search` neighbours and returning fewer; strict order keeps ties stable,
so the same query gives the same results.

serve waits for the database instead of exiting: in the hosted compose the web app shares serve's
network, and Docker restarting a serve that exited on a slow Postgres (after a reboot) leaves the
web app on a network that no longer exists.
"""

import logging
import time
from collections.abc import Callable

import psycopg

log = logging.getLogger("bernlife.database")

SESSION_SETTINGS = (
    "SET hnsw.iterative_scan = strict_order",
    "SET hnsw.ef_search = 100",
)


def connect(url: str) -> psycopg.Connection:
    conn = psycopg.connect(url)
    for statement in SESSION_SETTINGS:
        conn.execute(statement)
    conn.commit()
    return conn


def connect_when_ready(
    url: str,
    attempts: int = 60,
    pause: float = 2.0,
    open_connection: Callable[[str], psycopg.Connection] = connect,
    sleep: Callable[[float], None] = time.sleep,
) -> psycopg.Connection:
    """connect(), retried while Postgres refuses or is still starting; the last failure raises."""
    for attempt in range(1, attempts):
        try:
            return open_connection(url)
        except psycopg.OperationalError:
            log.info("database not ready (attempt %d of %d); retrying", attempt, attempts)
            sleep(pause)
    return open_connection(url)
