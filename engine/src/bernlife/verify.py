"""The verifier: a proposed claim becomes evidence only if plain string matching confirms it.

No model takes part here. A span must occur character for character in the stored page text (E1
already normalised its whitespace), the value must occur in the span, and a claim about a person
must come from that person's own page or from a span that names them. Every drop is counted by
reason, so the report shows what the model got wrong as well as what was kept.
"""

import re
from collections import Counter
from collections.abc import Iterable, Mapping
from dataclasses import dataclass

from bernlife.extract_records import (
    Candidate,
    Claim,
    Evidence,
    Page,
    Relation,
    RelationCandidate,
    Subject,
)
from bernlife.names import fold, looks_like_person, mentions

SPAN_MAX = 300
VALUE_MAX = 200
CONTACT_TOKEN = re.compile(r"\[(?:email|phone)\]")
LEADERSHIP = frozenset(
    {
        "head",
        "heads",
        "headed",
        "lead",
        "leads",
        "led",
        "leader",
        "leiter",
        "leiterin",
        "leitung",
        "director",
    }
    | {"direktor", "direktorin", "directeur", "directrice", "chair", "pi", "responsable"}
    | {"coordinator", "koordinator", "koordinatorin", "chef", "cheffe", "principal"}
)
LEADS_FALLBACK = {"unit": "member_of", "project": "works_on"}


@dataclass(frozen=True)
class Verified:
    claims: tuple[Claim, ...]
    relations: tuple[Relation, ...]
    dropped: Counter[str]


def verify_all(
    candidates: Iterable[Candidate],
    relation_candidates: Iterable[RelationCandidate],
    pages: Mapping[str, Page],
    own: Mapping[str, Subject | None],
) -> Verified:
    """`own` maps a page URL to the subject the page itself is about."""
    claims, relations, dropped = [], [], Counter[str]()
    for candidate in candidates:
        result = verify_claim(candidate, pages[candidate.page_url], own.get(candidate.page_url))
        if isinstance(result, str):
            dropped[result] += 1
        else:
            claims.append(result)
    for relation in relation_candidates:
        checked = verify_relation(relation, pages[relation.page_url], own.get(relation.page_url))
        if isinstance(checked, str):
            dropped[checked] += 1
        else:
            relations.append(checked)
    return Verified(tuple(claims), tuple(relations), dropped)


def verify_claim(candidate: Candidate, page: Page, own: Subject | None) -> Claim | str:
    reason = _span_problem(candidate.span, candidate.value, page)
    if reason is None and not _belongs(candidate.subject, candidate.span, own):
        reason = "wrong_page"
    is_person_name = candidate.field == "name" and candidate.subject.kind == "person"
    if reason is None and is_person_name and not looks_like_person(candidate.value):
        reason = "not_a_name"
    if reason is not None:
        return reason
    evidence = _evidence(candidate.span, page)
    return Claim(candidate.subject, candidate.field, candidate.value, candidate.method, evidence)


def verify_relation(relation: RelationCandidate, page: Page, own: Subject | None) -> Relation | str:
    reason = _span_problem(relation.span, None, page)
    people = [s for s in (relation.origin, relation.target) if s.kind == "person"]
    if reason is None and not all(_belongs(person, relation.span, own) for person in people):
        reason = "wrong_page"
    if reason is not None:
        return reason
    kind = relation.kind
    if kind == "leads" and not LEADERSHIP & set(fold(relation.span).split()):
        kind = LEADS_FALLBACK[relation.target.kind]
    evidence = _evidence(relation.span, page)
    return Relation(relation.origin, relation.target, kind, relation.method, evidence)


def contact_only(text: str) -> bool:
    return not any(char.isalpha() for char in CONTACT_TOKEN.sub("", text))


def recheck(
    profiles: Iterable[dict], relations: Iterable[dict], pages: Mapping[str, Page]
) -> list[str]:
    """Every stored span against its page once more, from the records about to be written."""
    problems = []
    for profile in profiles:
        claims = [profile["name"], *(c for f in profile["fields"].values() for c in f)]
        for claim in claims:
            problem = _stored_problem(claim["evidence"], claim["value"], pages)
            if problem:
                problems.append(f"{profile['id']}: {problem}")
    for row in relations:
        problem = _stored_problem(row, "", pages)
        if problem:
            problems.append(f"{row['from_profile_id']} {row['kind']}: {problem}")
    return problems


def _span_problem(span: str, value: str | None, page: Page) -> str | None:
    if len(span) > SPAN_MAX or len(value or "") > VALUE_MAX:
        return "too_long"
    if not span or span not in page.text:
        return "span_not_in_page"
    if value is not None and (not value or value.casefold() not in span.casefold()):
        return "value_not_in_span"
    if contact_only(span) or (value is not None and contact_only(value)):
        return "contact_only"
    return None


def _belongs(subject: Subject, span: str, own: Subject | None) -> bool:
    return subject == own or mentions(span, subject.name)


def _evidence(span: str, page: Page) -> Evidence:
    return Evidence(page.url, page.sha256, span, page.text.index(span), page.fetched_at)


def _stored_problem(evidence: Mapping, value: str, pages: Mapping[str, Page]) -> str | None:
    page = pages.get(evidence["page_url"])
    span, start = evidence["span"], evidence["start"]
    if page is None or page.sha256 != evidence["page_sha256"]:
        return f"no stored page {evidence['page_url']} with that sha256"
    if page.text[start : start + len(span)] != span or len(span) > SPAN_MAX:
        return f"span not at {start} in {page.url}"
    if value.casefold() not in span.casefold():
        return f"value {value!r} not in its span"
    return None
