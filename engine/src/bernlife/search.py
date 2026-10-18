"""A query in, a SearchResponse (contracts/result.schema.json) out.

The store and the embedder are passed in, so tests run this with a fake encoder and the HTTP
server, `predict` and `calibrate` share one path. No model is called yet, so the mode is "mock"
and the reasons are the matched claim values themselves. The body carries no timings: the same
query on the same snapshot gives the same bytes. Latency is measured by the callers.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from importlib.metadata import version
from typing import Any, Protocol

import psycopg

from bernlife.abstain import abstain_reason
from bernlife.embed import MODEL_ID, Embedder
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
    def snapshot(self) -> str: ...


@dataclass(frozen=True)
class PostgresStore:
    conn: psycopg.Connection

    def hits(self, query: str, vector: list[float], sources: list[str] | None) -> list[Hit]:
        return fetch_hits(self.conn, query, vector, sources)

    def profiles(self, ids: Sequence[str]) -> dict[str, dict[str, Any]]:
        return read_profiles(self.conn, ids)

    def snapshot(self) -> str:
        row = self.conn.execute(
            "SELECT version FROM bundle_load ORDER BY loaded_at DESC, id DESC LIMIT 1"
        ).fetchone()
        return row[0] if row else "none"


@dataclass(frozen=True)
class Assessment:
    ranked: list[Candidate]
    abstain_reason: str | None


def assess(query: str, sources: list[str] | None, store: Store, embedder: Embedder) -> Assessment:
    found = candidates(store.hits(query, embedder.query(query), sources))
    return Assessment(cap_units(found), abstain_reason(query, found))


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
        profiles = store.profiles([c.profile_id for c in shown])
        results = [result(i, c, profiles[c.profile_id], query) for i, c in enumerate(shown, 1)]
    return {
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
