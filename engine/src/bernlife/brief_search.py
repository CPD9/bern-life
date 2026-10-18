"""A project brief in, a SearchResponse with `brief_terms` out (POST /api/brief).

Each verified need is expanded (in parallel) and searched like a question. A profile found by
several needs keeps its best rank, ties going to the higher fused score, then to its id; the unit
cap then applies to the merged list. A result's reason and explanation answer the need that
ranked it best, so "why it matches" always names a need the company wrote.
"""

from concurrent.futures import ThreadPoolExecutor
from typing import Any

from bernlife.abstain import NO_SOURCE
from bernlife.brief import read_needs
from bernlife.embed import Embedder
from bernlife.expand import expand
from bernlife.explain import explain_top
from bernlife.llm import Chat
from bernlife.metrics import Topic, with_metrics
from bernlife.ranking import Candidate, cap_units
from bernlife.search import RESULTS, Assessment, assess, cited_pages, model_use, result
from bernlife.store import Store


def brief_search(
    text: str, sources: list[str] | None, store: Store, embedder: Embedder, llm: Chat
) -> dict[str, Any]:
    needs = read_needs(llm, text)
    with ThreadPoolExecutor(max_workers=max(1, len(needs))) as pool:
        expansions = list(pool.map(lambda need: expand(llm, need.term), needs))
    assessments = [
        assess(need.term, sources, store, embedder, expansion)
        for need, expansion in zip(needs, expansions, strict=True)
    ]
    best: dict[str, tuple[int, float, int]] = {}
    for index, assessment in enumerate(assessments):
        if assessment.abstain_reason is not None:
            continue
        for rank, candidate in enumerate(assessment.ranked[:RESULTS], 1):
            key = (rank, -candidate.fused, index)
            best[candidate.profile_id] = min(key, best.get(candidate.profile_id, key))
    order = sorted(best, key=lambda pid: (best[pid][:2], pid))
    merged = cap_units([_candidate(assessments[best[pid][2]], pid) for pid in order])[:RESULTS]
    owner = [assessments[best[c.profile_id][2]] for c in merged]
    pairs = zip(merged, owner, strict=True)
    results = [result(rank, candidate, a) for rank, (candidate, a) in enumerate(pairs, 1)]
    results, outcomes = explain_top(llm, results, [a.question.query for a in owner])
    used = {"brief": bool(needs), "expand": any(expansions), "explain": "kept" in outcomes}
    terms = [t.as_record() for expansion in expansions if expansion for t in expansion.terms()]
    response = {
        "query": "; ".join(need.term for need in needs),
        "brief_terms": [need.as_record() for need in needs],
        "abstained": not results,
        "abstain_reason": None if results else NO_SOURCE,
        "expanded_terms": list({t["term"]: t for t in terms}.values()),
        "results": results,
        **model_use(llm, used, store.snapshot()),
    }
    topics = [
        Topic(
            need.term,
            (need.term, *(t.term for t in expansion.terms())) if expansion else (need.term,),
        )
        for need, expansion in zip(needs, expansions, strict=True)
    ]
    page_by_url = store.pages(sorted(cited_pages(results))).get
    return with_metrics(response, topics, page_by_url)


def _candidate(assessment: Assessment, profile_id: str) -> Candidate:
    return next(c for c in assessment.ranked if c.profile_id == profile_id)
