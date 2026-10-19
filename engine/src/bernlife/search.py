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
from bernlife.brief import BRIEF_PROMPT_VERSION
from bernlife.chunks import claims_of
from bernlife.embed import MODEL_ID, Embedder
from bernlife.expand import EXPAND_PROMPT_VERSION, Expansion, expand, expanded_text
from bernlife.explain import EXPLAIN_PROMPT_VERSION, explain_top
from bernlife.extract_records import PEOPLE_KINDS
from bernlife.llm import Chat
from bernlife.llm_gate import request_mode
from bernlife.matching import Asked, asked, can_explain
from bernlife.metrics import query_topics, with_metrics
from bernlife.ranking import Candidate, candidates, cap_units
from bernlife.reason import reason
from bernlife.store import Relation, Store
from bernlife.via import relation_reasons, via_record
from bernlife.wording import Recorded, for_model, from_repository

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
    vias: dict[str, tuple[Relation, list[tuple[str, int]]]]


def assess(
    query: str,
    sources: list[str] | None,
    store: Store,
    embedder: Embedder,
    expansion: Expansion | None = None,
    kinds: Sequence[str] = PEOPLE_KINDS,
) -> Assessment:
    """Abstention looks at every candidate; only those that can explain themselves are ranked."""
    plain = store.hits(query, embedder.query(query), sources, kinds)
    terms = [term.term for term in expansion.terms()] if expansion else []
    expanded = []
    if terms:
        text = expanded_text(query, expansion.terms())
        expanded = store.hits(text, embedder.query(text), sources, kinds)
    found = candidates(plain, expanded)
    profiles = store.profiles([c.profile_id for c in found])
    values = sorted({c["value"] for p in profiles.values() for c in p["fields"]["expertise"]})
    enrichment = store.enrichment(values)
    question = asked(query, terms)
    own = {c.profile_id for c in found if can_explain(question, profiles[c.profile_id], enrichment)}
    unexplained = [c.profile_id for c in found if c.profile_id not in own]
    vias = relation_reasons(question, unexplained, store, profiles, enrichment)
    shown = [c for c in found if c.profile_id in own or c.profile_id in vias]
    reason_to_abstain = abstain_reason(query, found) or (None if shown else NO_SOURCE)
    return Assessment(
        found, cap_units(shown), profiles, enrichment, question, reason_to_abstain, vias
    )


def result(rank: int, candidate: Candidate, assessment: Assessment) -> dict[str, Any]:
    """A result shown through a project keeps its plain reason (its own claims are what it can
    cite) and carries `via`, the relation and the project's matching claims."""
    profile = assessment.profiles[candidate.profile_id]
    item = {
        "rank": rank,
        "profile": profile,
        "reason": reason(assessment.question, profile, assessment.enrichment),
        "score": {
            "fused": candidate.fused,
            "lexical_rank": candidate.lexical_rank,
            "vector_rank": candidate.vector_rank,
        },
    }
    if candidate.profile_id in assessment.vias:
        relation, matched = assessment.vias[candidate.profile_id]
        item["via"] = via_record(relation, assessment.profiles[relation.to_profile_id], matched)
    return item


def search(
    query: str,
    sources: list[str] | None,
    store: Store,
    embedder: Embedder,
    llm: Chat | None = None,
    kinds: Sequence[str] = PEOPLE_KINDS,
    recorded: Recorded | None = None,
) -> dict[str, Any]:
    """Without `kinds`, people, units, projects and infrastructure, as before opportunities. The
    prompts carry the question in its recorded wording when the call cannot go live (wording.py);
    the response echoes it as typed."""
    asked_as, expansion = query, None
    if llm is not None:
        recorded = from_repository() if recorded is None else recorded
        asked_as = for_model(query, llm.backend, recorded)
        expansion = expand(llm, asked_as)
    assessment = assess(query, sources, store, embedder, expansion, kinds)
    results = []
    if assessment.abstain_reason is None:
        shown = assessment.ranked[:RESULTS]
        results = [result(rank, c, assessment) for rank, c in enumerate(shown, 1)]
    outcomes: list[str] = []
    if llm is not None:
        results, outcomes = explain_top(llm, results, [asked_as] * len(results))
    used = {"expand": bool(expansion), "explain": "kept" in outcomes}
    response = {
        "query": query,
        "abstained": assessment.abstain_reason is not None,
        "abstain_reason": assessment.abstain_reason,
        "expanded_terms": [term.as_record() for term in expansion.terms()] if expansion else [],
        "results": results,
        **model_use(llm, used, store.snapshot()),
    }
    topics = query_topics(query, expansion.by_topic() if expansion else None)
    page_by_url = store.pages(sorted(cited_pages(results))).get
    return with_metrics(response, topics, page_by_url)


PROMPT_VERSIONS = {
    "brief": BRIEF_PROMPT_VERSION,
    "expand": EXPAND_PROMPT_VERSION,
    "explain": EXPLAIN_PROMPT_VERSION,
}


def model_use(llm: Chat | None, used: dict[str, bool], snapshot: str) -> dict[str, Any]:
    """`mode` and `versions` as they really were: a role counts only if its text was used."""
    roles = [role for role, yes in used.items() if yes]
    models = {"embed": MODEL_ID}
    if llm is not None:
        models |= {role: llm.models()[role] for role in roles}
    return {
        "mode": request_mode(llm.backend) if llm is not None and roles else NO_MODEL,
        "versions": {
            "engine": version("bernlife"),
            "snapshot": snapshot,
            "prompts": "+".join(PROMPT_VERSIONS[role] for role in roles) or NO_PROMPTS,
            "models": models,
        },
    }


def cited_pages(results: Sequence[dict[str, Any]]) -> set[str]:
    """The pages metrics read: each shown profile's source page and every evidence page."""
    urls = set()
    for item in results:
        profile = item["profile"]
        urls.add(profile["source_url"])
        urls.update(claim["evidence"]["page_url"] for claim in claims_of(profile))
    return urls
