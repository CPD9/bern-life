"""What search reads from the database, behind one small interface so tests can stand in for it."""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Protocol

import psycopg

from bernlife.profiles_db import read_profiles
from bernlife.search_sql import Hit, fetch_hits


class Store(Protocol):
    def hits(self, query: str, vector: list[float], sources: list[str] | None) -> list[Hit]: ...
    def profiles(self, ids: Sequence[str]) -> dict[str, dict[str, Any]]: ...
    def enrichment(self, values: Sequence[str]) -> dict[str, list[str]]: ...
    def pages(self, urls: Sequence[str]) -> dict[str, dict[str, Any]]: ...
    def snapshot(self) -> str: ...


@dataclass(frozen=True)
class PostgresStore:
    conn: psycopg.Connection

    def hits(self, query: str, vector: list[float], sources: list[str] | None) -> list[Hit]:
        return fetch_hits(self.conn, query, vector, sources)

    def profiles(self, ids: Sequence[str]) -> dict[str, dict[str, Any]]:
        return read_profiles(self.conn, ids)

    def enrichment(self, values: Sequence[str]) -> dict[str, list[str]]:
        rows = self.conn.execute(
            "SELECT value, term FROM term WHERE value = ANY(%s) ORDER BY value, term, kind",
            (list(values),),
        ).fetchall()
        found: dict[str, list[str]] = {}
        for value, term in rows:
            found.setdefault(value, []).append(term)
        return found

    def pages(self, urls: Sequence[str]) -> dict[str, dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT url, unit, text FROM page WHERE url = ANY(%s)", (list(urls),)
        ).fetchall()
        return {url: {"url": url, "unit": unit, "text": text} for url, unit, text in rows}

    def snapshot(self) -> str:
        row = self.conn.execute(
            "SELECT version FROM bundle_load ORDER BY loaded_at DESC, id DESC LIMIT 1"
        ).fetchone()
        return row[0] if row else "none"
