"""Pages in, profiles and relations out: selectors, the model pass, the verifier, merge.

Selectors read every page. The model reads only the pages it is given, each through an injected
function, so tests pass a fake and the command passes the cached router. Nothing reaches a
profile without going through `verify_all`.
"""

from collections import Counter
from collections.abc import Callable, Iterable, Iterator, Sequence
from dataclasses import dataclass

from bernlife.extract_model import ModelOutcome
from bernlife.extract_records import Candidate, Page, RelationCandidate, Subject
from bernlife.extract_selectors import page_subject, selector_candidates
from bernlife.merge import merge
from bernlife.relations import build_relations
from bernlife.verify import verify_all

ModelPass = Callable[[Page, Subject | None], ModelOutcome]
MapPages = Callable[[Callable[[Page], ModelOutcome], Iterable[Page]], Iterator[ModelOutcome]]


@dataclass(frozen=True)
class Extraction:
    profiles: tuple[dict[str, object], ...]
    relations: tuple[dict[str, object], ...]
    dropped: Counter[str]
    model_pages: int
    model_calls: int
    model_cached: int
    unnamed_subjects: int
    pages_without_subject: Counter[str]


def extract(
    pages: Sequence[Page],
    model_pages: Sequence[Page] = (),
    model: ModelPass | None = None,
    map_pages: MapPages = map,
) -> Extraction:
    by_url = {page.url: page for page in pages}
    own = {page.url: page_subject(page) for page in pages}
    candidates: list[Candidate] = []
    relation_candidates: list[RelationCandidate] = []
    for page in pages:
        found, related = selector_candidates(page)
        candidates += found
        relation_candidates += related
    dropped = Counter[str]()
    outcomes: list[ModelOutcome] = []
    if model is not None:
        outcomes = list(map_pages(lambda page: model(page, own[page.url]), model_pages))
    for outcome in outcomes:
        candidates += outcome.candidates
        relation_candidates += outcome.relations
        dropped.update(outcome.failures)
    verified = verify_all(candidates, relation_candidates, by_url, own)
    dropped.update(verified.dropped)
    merged = merge(verified.claims, by_url, own)
    relations, unresolved = build_relations(verified.relations, merged)
    dropped.update(unresolved)
    return Extraction(
        profiles=merged.profiles,
        relations=tuple(relations),
        dropped=dropped,
        model_pages=len(outcomes),
        model_calls=sum(outcome.calls for outcome in outcomes),
        model_cached=sum(outcome.cached for outcome in outcomes),
        unnamed_subjects=merged.unnamed,
        pages_without_subject=Counter(
            page.kind for page in pages if own[page.url] is None and page.kind != "other"
        ),
    )
