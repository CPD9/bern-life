"""Pages in, profiles and relations out: selectors, the model pass, the verifier, merge.

Selectors read every page. The model reads only the pages it is given, each through an injected
function, so tests pass a fake and the command passes the cached router. A second pass, topics,
reads person pages once more for what the person works on: it chooses its pages from the profiles
the first pass gives, never from a stored file, so a rerun from the cache reads the same pages
and writes the same bytes. Nothing reaches a profile without going through `verify_all`.
"""

from collections import Counter
from collections.abc import Callable, Iterable, Iterator, Mapping, Sequence
from dataclasses import dataclass, field

from bernlife.extract_model import ModelOutcome
from bernlife.extract_records import Candidate, Page, RelationCandidate, Subject
from bernlife.extract_selectors import page_subject, selector_candidates
from bernlife.merge import merge
from bernlife.relations import build_relations
from bernlife.verify import verify_all

ModelPass = Callable[[Page, Subject | None], ModelOutcome]
MapPages = Callable[[Callable[[Page], ModelOutcome], Iterable[Page]], Iterator[ModelOutcome]]
SelectPages = Callable[[Sequence[dict[str, object]]], Sequence[Page]]
TopicsPass = tuple[SelectPages, ModelPass]


@dataclass(frozen=True)
class Extraction:
    profiles: tuple[dict[str, object], ...]
    relations: tuple[dict[str, object], ...]
    dropped: Counter[str]
    verdicts: Counter[tuple[str, str, str]]
    adjusted: Counter[str]
    model_pages: int
    model_calls: int
    model_cached: int
    unnamed_subjects: int
    pages_without_subject: Counter[str]
    topic_pages: int = 0
    topic_calls: int = 0
    topic_cached: int = 0


@dataclass
class _Proposals:
    candidates: list[Candidate] = field(default_factory=list)
    relations: list[RelationCandidate] = field(default_factory=list)
    dropped: Counter[str] = field(default_factory=Counter)
    failures: Counter[tuple[str, str, str]] = field(default_factory=Counter)

    def add(self, outcomes: Iterable[ModelOutcome]) -> None:
        for outcome in outcomes:
            self.candidates += outcome.candidates
            self.relations += outcome.relations
            self.dropped.update(outcome.failures)
            self.failures.update({("model", "(reply)", f): n for f, n in outcome.failures.items()})


@dataclass(frozen=True)
class _Resolved:
    profiles: tuple[dict[str, object], ...]
    relations: tuple[dict[str, object], ...]
    dropped: Counter[str]
    verdicts: Counter[tuple[str, str, str]]
    adjusted: Counter[str]
    unnamed: int


def extract(
    pages: Sequence[Page],
    model_pages: Sequence[Page] = (),
    model: ModelPass | None = None,
    map_pages: MapPages = map,
    opportunity_sources: frozenset[str] = frozenset(),
    topics: TopicsPass | None = None,
) -> Extraction:
    by_url = {page.url: page for page in pages}
    institutes = {page.url: page.source_id not in opportunity_sources for page in pages}
    own = {page.url: page_subject(page, institutes[page.url]) for page in pages}
    proposals = _Proposals()
    for page in pages:
        found, related = selector_candidates(page, institutes[page.url])
        proposals.candidates += found
        proposals.relations += related
    outcomes = _outcomes(model, model_pages, own, map_pages)
    proposals.add(outcomes)
    topic_outcomes: list[ModelOutcome] = []
    if topics is not None:
        select, topics_model = topics
        chosen = select(_resolve(proposals, by_url, own).profiles)
        topic_outcomes = _outcomes(topics_model, chosen, own, map_pages)
        proposals.add(topic_outcomes)
    resolved = _resolve(proposals, by_url, own)
    return Extraction(
        profiles=resolved.profiles,
        relations=resolved.relations,
        dropped=resolved.dropped,
        verdicts=resolved.verdicts,
        adjusted=resolved.adjusted,
        model_pages=len(outcomes),
        model_calls=sum(outcome.calls for outcome in outcomes),
        model_cached=sum(outcome.cached for outcome in outcomes),
        unnamed_subjects=resolved.unnamed,
        pages_without_subject=Counter(
            page.kind for page in pages if own[page.url] is None and page.kind != "other"
        ),
        topic_pages=len(topic_outcomes),
        topic_calls=sum(outcome.calls for outcome in topic_outcomes),
        topic_cached=sum(outcome.cached for outcome in topic_outcomes),
    )


def _outcomes(
    model: ModelPass | None,
    pages: Sequence[Page],
    own: Mapping[str, Subject | None],
    map_pages: MapPages,
) -> list[ModelOutcome]:
    if model is None:
        return []
    return list(map_pages(lambda page: model(page, own[page.url]), pages))


def _resolve(
    proposals: _Proposals, by_url: Mapping[str, Page], own: Mapping[str, Subject | None]
) -> _Resolved:
    verified = verify_all(proposals.candidates, proposals.relations, by_url, own)
    merged = merge(verified.claims, by_url, own)
    relations, unresolved = build_relations(verified.relations, merged)
    return _Resolved(
        merged.profiles,
        tuple(relations),
        proposals.dropped + verified.dropped + unresolved,
        verified.verdicts + proposals.failures,
        verified.adjusted,
        merged.unnamed,
    )
