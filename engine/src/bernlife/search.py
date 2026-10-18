"""A query in, a SearchResponse (contracts/result.schema.json) out.

The store, the embedder and the model are passed in, so tests run this with fakes and the HTTP
server, `predict` and `calibrate` share one path. With a model, the question is expanded first
(expand.py) and searched twice, plain and with its terms; with none, or when the model gives
nothing usable, search runs plain and the mode says "mock". Abstention reads the plain signals,
the ones its thresholds were set on. Display-only metrics (metrics.py) are added last and never
reorder results. The body carries no timings: the same query on the same snapshot and cache gives
the same bytes.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from importlib.metadata import version
from typing import Any

from bernlife.abstain import NO_SOURCE, abstain_reason
from bernlife.chunks import claims_of
from bernlife.embed import MODEL_ID, Embedder
from bernlife.expand import EXPAND_PROMPT_VERSION, Expansion, expand, expanded_text
from bernlife.llm import Chat
from bernlife.matching import Asked, asked, can_explain
from bernlife.metrics import query_topics, with_metrics
from bernlife.ranking import Candidate, candidates, cap_units
from bernlife.reason import reason
from bernlife.store import Store

RESULTS = 20
NO_MODEL = "mock"
NO_PROMPTS = "none"


@dataclass(frozen=True)
class Assessment:
    found: list[Candidate]
    ranked: list[Candidate]
    profiles: dict[str, dict[str, Any]]
    enrichment: dict[str, list[str]]
    question: Asked
    abstain_reason: str | None


def assess(
    query: str,
    sources: list[str] | None,
    store: Store,
    embedder: Embedder,
    expansion: Expansion | None = None,
) -> Assessment:
    """Abstention looks at every candidate; only those that can explain themselves are ranked."""
    plain = store.hits(query, embedder.query(query), sources)
    terms = [term.term for term in expansion.terms()] if expansion else []
    expanded = []
    if terms:
        text = expanded_text(query, expansion.terms())
        expanded = store.hits(text, embedder.query(text), sources)
    found = candidates(plain, expanded)
    profiles = store.profiles([c.profile_id for c in found])
    values = sorted({c["value"] for p in profiles.values() for c in p["fields"]["expertise"]})
    enrichment = store.enrichment(values)
    question = asked(query, terms)
    shown = [c for c in found if can_explain(question, profiles[c.profile_id], enrichment)]
    reason_to_abstain = abstain_reason(query, found) or (None if shown else NO_SOURCE)
    return Assessment(found, cap_units(shown), profiles, enrichment, question, reason_to_abstain)


def result(rank: int, candidate: Candidate, assessment: Assessment) -> dict[str, Any]:
    profile = assessment.profiles[candidate.profile_id]
    return {
        "rank": rank,
        "profile": profile,
        "reason": reason(assessment.question, profile, assessment.enrichment),
        "score": {
            "fused": candidate.fused,
            "lexical_rank": candidate.lexical_rank,
            "vector_rank": candidate.vector_rank,
        },
    }


def search(
    query: str,
    sources: list[str] | None,
    store: Store,
    embedder: Embedder,
    llm: Chat | None = None,
) -> dict[str, Any]:
    expansion = expand(llm, query) if llm is not None else None
    assessment = assess(query, sources, store, embedder, expansion)
    results = []
    if assessment.abstain_reason is None:
        shown = assessment.ranked[:RESULTS]
        results = [result(rank, c, assessment) for rank, c in enumerate(shown, 1)]
    models = {"embed": MODEL_ID}
    if expansion and llm is not None:
        models["expand"] = llm.models()["expand"]
    response = {
        "query": query,
        "mode": llm.backend if expansion and llm is not None else NO_MODEL,
        "abstained": assessment.abstain_reason is not None,
        "abstain_reason": assessment.abstain_reason,
        "expanded_terms": [term.as_record() for term in expansion.terms()] if expansion else [],
        "results": results,
        "versions": {
            "engine": version("bernlife"),
            "snapshot": store.snapshot(),
            "prompts": EXPAND_PROMPT_VERSION if expansion else NO_PROMPTS,
            "models": models,
        },
    }
    topics = query_topics(query, expansion.by_topic() if expansion else None)
    page_by_url = store.pages(sorted(cited_pages(results))).get
    return with_metrics(response, topics, page_by_url)


def cited_pages(results: Sequence[dict[str, Any]]) -> set[str]:
    """The pages metrics read: each shown profile's source page and every evidence page."""
    urls = set()
    for item in results:
        profile = item["profile"]
        urls.add(profile["source_url"])
        urls.update(claim["evidence"]["page_url"] for claim in claims_of(profile))
    return urls
