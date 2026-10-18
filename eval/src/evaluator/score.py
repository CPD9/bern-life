"""Scores each prediction against its gold line.

recall@10 and the reciprocal rank need only the prediction; traceability and invented entities
need the snapshot and stay None without it, so the report can say "not computed" instead of 0.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from .load import GoldQuery
from .match import match
from .trace import Miss, PageIndex, check_claims, invented

TOP = 10

Record = dict[str, Any]


@dataclass(frozen=True)
class QueryResult:
    gold: GoldQuery
    abstained: bool
    recall: float | None
    reciprocal_rank: float | None
    url_only_hits: int
    top: tuple[Record, ...]
    claims: int | None
    misses: tuple[Miss, ...]
    invented: tuple[str, ...] | None

    @property
    def top_ids(self) -> frozenset[str]:
        return frozenset(result["profile"]["id"] for result in self.top)


def abstained(response: Record) -> bool:
    """An answer counts as an abstention only if it says so and shows nothing."""
    return bool(response["abstained"]) and not response["results"]


def top_results(response: Record) -> tuple[Record, ...]:
    return tuple(sorted(response["results"], key=lambda result: result["rank"])[:TOP])


def retrieval(gold: GoldQuery, top: Sequence[Record]) -> tuple[float, float, int] | None:
    """recall@10, reciprocal rank of the first expected hit, and how many targets were found
    only by URL (no name match), which the report lists so URL-only hits can be reviewed."""
    if gold.abstain or not gold.targets:
        return None
    found = url_only = 0
    for target in gold.targets:
        ways = {match(target, result["profile"]) for result in top} - {None}
        found += bool(ways)
        url_only += ways == {"url"}
    first = next(
        (
            position
            for position, result in enumerate(top, 1)
            if any(match(target, result["profile"]) for target in gold.targets)
        ),
        None,
    )
    return found / len(gold.targets), 1 / first if first else 0.0, url_only


def score(
    gold: GoldQuery,
    response: Record,
    pages: PageIndex | None,
    profiles: Mapping[str, Record] | None,
) -> QueryResult:
    top = top_results(response)
    scored = retrieval(gold, top)
    claims, misses = (
        (None, []) if pages is None else check_claims(gold.id, response["results"], pages)
    )
    return QueryResult(
        gold=gold,
        abstained=abstained(response),
        recall=None if scored is None else scored[0],
        reciprocal_rank=None if scored is None else scored[1],
        url_only_hits=0 if scored is None else scored[2],
        top=top,
        claims=claims,
        misses=tuple(misses),
        invented=None if profiles is None else invented(response["results"], profiles),
    )


def score_all(
    gold: Sequence[GoldQuery],
    responses: Mapping[str, Record],
    pages: Mapping[str, Record] | None,
    profiles: Mapping[str, Record] | None,
) -> list[QueryResult]:
    index = None if pages is None else PageIndex(pages)
    return [score(query, responses[query.id], index, profiles) for query in gold]
