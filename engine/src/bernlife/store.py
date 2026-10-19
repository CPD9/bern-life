"""What search reads from the database, behind one small interface so tests can stand in for it."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol

import psycopg

from bernlife.own_page import OwnPage
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
    def own_pages(self, urls: Sequence[str]) -> dict[str, OwnPage]: ...
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

    def own_pages(self, urls: Sequence[str]) -> dict[str, OwnPage]:
        """Each page with the offsets of every name claim on it (a name with no stored offset is
        found by its span)."""
        pages = self.conn.execute(
            "SELECT url, sha256, text, fetched_at FROM page WHERE url = ANY(%s)", (list(urls),)
        ).fetchall()
        names: dict[str, list[tuple[int | None, str]]] = {}
        for url, start, span in self.conn.execute(
            "SELECT page_url, start, span FROM claim WHERE field::text = 'name'"
            " AND page_url = ANY(%s) ORDER BY page_url, start, span",
            (list(urls),),
        ).fetchall():
            names.setdefault(url, []).append((start, span))
        found = {}
        for url, sha256, text, fetched_at in pages:
            spans = [
                (text.find(span) if start is None else start, span)
                for start, span in names.get(url, [])
            ]
            offsets = tuple(sorted({(at, at + len(span)) for at, span in spans if at >= 0}))
            found[url] = OwnPage(url, sha256, text, fetched_at, offsets)
        return found

    def snapshot(self) -> str:
        row = self.conn.execute(
            "SELECT version FROM bundle_load ORDER BY loaded_at DESC, id DESC LIMIT 1"
        ).fetchone()
        return row[0] if row else "none"
