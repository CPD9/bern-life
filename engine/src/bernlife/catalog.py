"""What GET /api/sources lists: each source with its hosts, the kinds of profiles it holds, and how
many pages and profiles of the loaded snapshot are its own.

The database is the truth for what is loaded. A source configured in sources/ after the last load
is listed too, with no pages, so the list names every source the engine is set up to read.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, replace
from datetime import datetime
from typing import Any

import psycopg

from bernlife.extract_records import PROFILE_KINDS
from bernlife.profiles_db import timestamp
from bernlife.sources import Source

SOURCES = "SELECT id, name FROM source ORDER BY id"
HOSTS = "SELECT source_id, host FROM site ORDER BY source_id, host"
PAGES = "SELECT source_id, count(*), max(fetched_at) FROM page GROUP BY source_id"
PROFILES = "SELECT source_id, kind::text, count(*) FROM profile GROUP BY source_id, kind"


@dataclass(frozen=True)
class SourceStats:
    id: str
    name: str
    hosts: tuple[str, ...]
    profiles_by_kind: Mapping[str, int]
    pages: int
    newest_fetched_at: datetime | None


def read_loaded(conn: psycopg.Connection) -> list[SourceStats]:
    hosts: dict[str, list[str]] = {}
    for source_id, host in conn.execute(HOSTS).fetchall():
        hosts.setdefault(source_id, []).append(host)
    by_kind: dict[str, dict[str, int]] = {}
    for source_id, kind, count in conn.execute(PROFILES).fetchall():
        by_kind.setdefault(source_id, {})[kind] = count
    pages = {row[0]: (row[1], row[2]) for row in conn.execute(PAGES).fetchall()}
    return [
        SourceStats(
            source_id,
            name,
            tuple(hosts.get(source_id, ())),
            by_kind.get(source_id, {}),
            *pages.get(source_id, (0, None)),
        )
        for source_id, name in conn.execute(SOURCES).fetchall()
    ]


def configured_stats(source: Source) -> SourceStats:
    hosts = tuple(sorted(site.host for site in source.sites))
    return SourceStats(source.id, source.name, hosts, {}, 0, None)


def source_list(
    loaded: Sequence[SourceStats], configured: Sequence[Source]
) -> list[dict[str, Any]]:
    """Loaded values win; a loaded source without hosts takes them from its configuration."""
    stats = {source.id: source for source in loaded}
    for source in configured:
        known = stats.get(source.id)
        if known is None:
            stats[source.id] = configured_stats(source)
        elif not known.hosts:
            stats[source.id] = replace(known, hosts=configured_stats(source).hosts)
    return [source_entry(stats[source_id]) for source_id in sorted(stats)]


def source_entry(stats: SourceStats) -> dict[str, Any]:
    newest = stats.newest_fetched_at
    return {
        "id": stats.id,
        "name": stats.name,
        "hosts": list(stats.hosts),
        "kinds": [kind for kind in PROFILE_KINDS if stats.profiles_by_kind.get(kind)],
        "pages": stats.pages,
        "profiles": sum(stats.profiles_by_kind.values()),
        "newest_fetched_at": timestamp(newest) if newest is not None else None,
    }
