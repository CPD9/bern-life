"""From chunk hits to a ranked list of profiles: reciprocal rank fusion and a cap per unit.

Fusion uses ranks only, so neither signal's score scale can dominate. The cap keeps one large
unit from filling the top ten: a profile over the cap waits until after the top ten, unless no
other unit has a candidate left. Nothing here counts pages or links, so prominence earns nothing.
"""

from collections import Counter
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass

from bernlife.search_sql import Hit

RRF_K = 60
UNIT_CAP = 4
TOP = 10
SIGNALS = ("lexical", "vector")


@dataclass(frozen=True)
class Candidate:
    profile_id: str
    kind: str
    name: str
    unit: str
    fused: float
    lexical_rank: int | None
    vector_rank: int | None
    coverage: float
    similarity: float


def profile_ranks(hits: Iterable[Hit], signal: str) -> dict[str, int]:
    """1-based ranks by best chunk rank; profiles credited by the same chunk go by id."""
    best: dict[str, int] = {}
    for h in hits:
        if h.signal == signal:
            best[h.profile_id] = min(h.chunk_rank, best.get(h.profile_id, h.chunk_rank))
    ordered = sorted((chunk_rank, profile_id) for profile_id, chunk_rank in best.items())
    return {profile_id: rank for rank, (_, profile_id) in enumerate(ordered, 1)}


def rrf(rank_lists: Sequence[Mapping[str, int]], k: int = RRF_K) -> dict[str, float]:
    fused: dict[str, float] = {}
    for ranks in rank_lists:
        for profile_id, rank in ranks.items():
            fused[profile_id] = fused.get(profile_id, 0.0) + 1.0 / (k + rank)
    return fused


def candidates(plain: Sequence[Hit], expanded: Sequence[Hit] = ()) -> list[Candidate]:
    """Up to four rank lists fused: each signal for the plain question and, when there is one,
    for the question with its expansion terms. A profile's rank per signal is its best of the
    two. Coverage and similarity come from the plain question only, the signals abstention was
    calibrated on."""
    lists = [
        (signal, profile_ranks(hits, signal)) for hits in (plain, expanded) for signal in SIGNALS
    ]
    fused = rrf([ranks for _, ranks in lists])
    strength = {(h.signal, h.profile_id): h.strength for h in plain}
    about = {h.profile_id: h for h in [*expanded, *plain]}

    def best(signal: str, profile_id: str) -> int | None:
        found = [ranks[profile_id] for s, ranks in lists if s == signal and profile_id in ranks]
        return min(found, default=None)

    found = [
        Candidate(
            profile_id=profile_id,
            kind=about[profile_id].kind,
            name=about[profile_id].name,
            unit=about[profile_id].unit,
            fused=score,
            lexical_rank=best("lexical", profile_id),
            vector_rank=best("vector", profile_id),
            coverage=strength.get(("lexical", profile_id), 0.0),
            similarity=strength.get(("vector", profile_id), 0.0),
        )
        for profile_id, score in fused.items()
    ]
    return sorted(found, key=lambda c: (-c.fused, c.profile_id))


def cap_units(
    ordered: Sequence[Candidate], cap: int = UNIT_CAP, size: int = TOP
) -> list[Candidate]:
    top: list[Candidate] = []
    deferred: list[Candidate] = []
    per_unit: Counter[str] = Counter()
    rest: Sequence[Candidate] = ()
    for index, candidate in enumerate(ordered):
        if len(top) == size:
            rest = ordered[index:]
            break
        if per_unit[candidate.unit] < cap:
            top.append(candidate)
            per_unit[candidate.unit] += 1
        else:
            deferred.append(candidate)
    if len(top) < size:
        fill = deferred[: size - len(top)]
        top += fill
        deferred = deferred[len(fill) :]
    return [*top, *deferred, *rest]
