"""A query in, a SearchResponse (contracts/result.schema.json) out.

The store and the embedder are passed in, so tests run this with a fake encoder and the HTTP
server, `predict` and `calibrate` share one path. No model is called yet, so the mode is "mock"
and the reasons are the matched claim values themselves. Display-only metrics (metrics.py) are
added last and never reorder results. The body carries no timings: the same query on the same
snapshot gives the same bytes. Latency is measured by the callers.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from importlib.metadata import version
from typing import Any, Protocol

import psycopg

from bernlife.abstain import NO_SOURCE, abstain_reason
from bernlife.chunks import claims_of
from bernlife.embed import MODEL_ID, Embedder
from bernlife.matching import can_explain
from bernlife.metrics import query_topics, with_metrics
from bernlife.profiles_db import read_profiles
from bernlife.ranking import Candidate, candidates, cap_units
from bernlife.reason import reason
from bernlife.search_sql import Hit, fetch_hits

RESULTS = 20
MODE = "mock"
PROMPTS = "none"


class Store(Protocol):
    def hits(self, query: str, vector: list[float], sources: list[str] | None) -> list[Hit]: ...
    def profiles(self, ids: Sequence[str]) -> dict[str, dict[str, Any]]: ...
    def pages(self, urls: Sequence[str]) -> dict[str, dict[str, Any]]: ...
    def snapshot(self) -> str: ...


@dataclass(frozen=True)
class PostgresStore:
    conn: psycopg.Connection

    def hits(self, query: str, vector: list[float], sources: list[str] | None) -> list[Hit]:
        return fetch_hits(self.conn, query, vector, sources)

    def profiles(self, ids: Sequence[str]) -> dict[str, dict[str, Any]]:
        return read_profiles(self.conn, ids)

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


@dataclass(frozen=True)
class Assessment:
    found: list[Candidate]
    ranked: list[Candidate]
    profiles: dict[str, dict[str, Any]]
    abstain_reason: str | None


def assess(query: str, sources: list[str] | None, store: Store, embedder: Embedder) -> Assessment:
    """Abstention looks at every candidate; only those that can explain themselves are ranked."""
    found = candidates(store.hits(query, embedder.query(query), sources))
    profiles = store.profiles([c.profile_id for c in found])
    shown = [c for c in found if can_explain(query, profiles[c.profile_id])]
    reason_to_abstain = abstain_reason(query, found) or (None if shown else NO_SOURCE)
    return Assessment(found, cap_units(shown), profiles, reason_to_abstain)


def result(rank: int, candidate: Candidate, profile: dict[str, Any], query: str) -> dict:
    return {
        "rank": rank,
        "profile": profile,
        "reason": reason(query, profile),
        "score": {
            "fused": candidate.fused,
            "lexical_rank": candidate.lexical_rank,
            "vector_rank": candidate.vector_rank,
        },
    }


def search(
    query: str, sources: list[str] | None, store: Store, embedder: Embedder
) -> dict[str, Any]:
    assessment = assess(query, sources, store, embedder)
    results = []
    if assessment.abstain_reason is None:
        shown = assessment.ranked[:RESULTS]
        profiles = assessment.profiles
        results = [result(i, c, profiles[c.profile_id], query) for i, c in enumerate(shown, 1)]
    response = {
        "query": query,
        "mode": MODE,
        "abstained": assessment.abstain_reason is not None,
        "abstain_reason": assessment.abstain_reason,
        "expanded_terms": [],
        "results": results,
        "versions": {
            "engine": version("bernlife"),
            "snapshot": store.snapshot(),
            "prompts": PROMPTS,
            "models": {"embed": MODEL_ID},
        },
    }
    page_by_url = store.pages(sorted(cited_pages(results))).get
    return with_metrics(response, query_topics(query), page_by_url)


def cited_pages(results: Sequence[dict[str, Any]]) -> set[str]:
    """The pages metrics read: each shown profile's source page and every evidence page."""
    urls = set()
    for item in results:
        profile = item["profile"]
        urls.add(profile["source_url"])
        urls.update(claim["evidence"]["page_url"] for claim in claims_of(profile))
    return urls
