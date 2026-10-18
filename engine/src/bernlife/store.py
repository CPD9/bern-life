"""What search reads from the database, behind one small interface so tests can stand in for it."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol

import psycopg

from bernlife.profiles_db import read_profiles
from bernlife.search_sql import Hit, fetch_hits


@dataclass(frozen=True)
class Relation:
    from_profile_id: str
    to_profile_id: str
    kind: str
    page_url: str
    page_sha256: str
    span: str
    start: int | None
    fetched_at: datetime


class Store(Protocol):
    def hits(
        self, query: str, vector: list[float], sources: list[str] | None, kinds: Sequence[str]
    ) -> list[Hit]: ...
    def profiles(self, ids: Sequence[str]) -> dict[str, dict[str, Any]]: ...
    def enrichment(self, values: Sequence[str]) -> dict[str, list[str]]: ...
    def pages(self, urls: Sequence[str]) -> dict[str, dict[str, Any]]: ...
    def relations(self, ids: Sequence[str], kinds: Sequence[str]) -> list[Relation]: ...
    def snapshot(self) -> str: ...


@dataclass(frozen=True)
class PostgresStore:
    conn: psycopg.Connection

    def hits(
        self, query: str, vector: list[float], sources: list[str] | None, kinds: Sequence[str]
    ) -> list[Hit]:
        return fetch_hits(self.conn, query, vector, sources, kinds)

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

    def relations(self, ids: Sequence[str], kinds: Sequence[str]) -> list[Relation]:
        rows = self.conn.execute(
            "SELECT r.from_profile_id, r.to_profile_id, r.kind::text, r.page_url, r.page_sha256,"
            " r.span, r.start, pg.fetched_at FROM entity_relation r"
            " JOIN page pg ON pg.url = r.page_url AND pg.sha256 = r.page_sha256"
            " WHERE r.from_profile_id = ANY(%s) AND r.kind::text = ANY(%s)"
            " ORDER BY r.from_profile_id, r.kind, r.to_profile_id",
            (list(ids), list(kinds)),
        ).fetchall()
        return [Relation(*row) for row in rows]

    def snapshot(self) -> str:
        row = self.conn.execute(
            "SELECT version FROM bundle_load ORDER BY loaded_at DESC, id DESC LIMIT 1"
        ).fetchone()
        return row[0] if row else "none"
