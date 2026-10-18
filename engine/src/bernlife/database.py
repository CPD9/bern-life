"""Connections to the engine's Postgres, with the session settings search relies on.

Iterative HNSW scans keep reading the index until enough rows pass a source filter, instead of
filtering the first `ef_search` neighbours and returning fewer; strict order keeps ties stable,
so the same query gives the same results.
"""

import psycopg

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
