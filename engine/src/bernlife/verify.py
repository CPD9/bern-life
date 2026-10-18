"""The verifier: a proposed claim becomes evidence only if plain string matching confirms it.

No model takes part here. A span must occur in the stored page text (E1 already normalised its
whitespace), the value must occur in the span, and a claim about a person must come from that
person's own page or from a span that names them. The stored span is always the page's own text
(`spans.py`). Every proposal is tallied by method, field and verdict, so the report shows what the
model got wrong as well as what was kept.
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
from bernlife.spans import Located, beside_name, from_name_line, locate

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
    verdicts: Counter[tuple[str, str, str]]  # (method, field, "kept" or the drop reason)
    adjusted: Counter[str]  # kept spans the page text replaced: case_only, role_below_name,
    # role_beside_name


def verify_all(
    candidates: Iterable[Candidate],
    relation_candidates: Iterable[RelationCandidate],
    pages: Mapping[str, Page],
    own: Mapping[str, Subject | None],
) -> Verified:
    """`own` maps a page URL to the subject the page itself is about."""
    claims: list[Claim] = []
    relations: list[Relation] = []
    verdicts = Counter[tuple[str, str, str]]()
    adjusted = Counter[str]()
    for candidate in candidates:
        result = verify_claim(candidate, pages[candidate.page_url], own.get(candidate.page_url))
        _tally(candidate.method, candidate.field, candidate.span, result, verdicts, adjusted)
        if not isinstance(result, str):
            claims.append(result)
    for relation in relation_candidates:
        checked = verify_relation(relation, pages[relation.page_url], own.get(relation.page_url))
        field = f"relation {relation.kind}"
        _tally(relation.method, field, relation.span, checked, verdicts, adjusted)
        if not isinstance(checked, str):
            relations.append(checked)
    dropped = Counter[str]()
    for (_, _, verdict), count in verdicts.items():
        if verdict != "kept":
            dropped[verdict] += count
    return Verified(tuple(claims), tuple(relations), dropped, verdicts, adjusted)


def verify_claim(candidate: Candidate, page: Page, own: Subject | None) -> Claim | str:
    subject = candidate.subject
    found = _found(candidate.span, candidate.value, page)
    if isinstance(found, str):
        return found
    if not _belongs(subject, found.span, own):
        is_role = candidate.field == "role" and subject.kind == "person"
        widened = _widen_role(found.span, page.text, subject.name) if is_role else None
        if widened is None:
            return "wrong_page"
        found = widened
    is_person_name = subject.kind == "person" and candidate.field == "name"
    if is_person_name and not looks_like_person(candidate.value):
        return "not_a_name"
    evidence = _evidence(found, page)
    return Claim(subject, candidate.field, candidate.value, candidate.method, evidence)


def verify_relation(relation: RelationCandidate, page: Page, own: Subject | None) -> Relation | str:
    found = _found(relation.span, None, page)
    if isinstance(found, str):
        return found
    people = [s for s in (relation.origin, relation.target) if s.kind == "person"]
    if not all(_belongs(person, found.span, own) for person in people):
        return "wrong_page"
    kind = relation.kind
    if kind == "leads" and not LEADERSHIP & set(fold(found.span).split()):
        kind = LEADS_FALLBACK[relation.target.kind]
    return Relation(relation.origin, relation.target, kind, relation.method, _evidence(found, page))


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


def _found(span: str, value: str | None, page: Page) -> Located | str:
    """The span as the page writes it, or the reason it cannot be evidence."""
    if len(span) > SPAN_MAX or len(value or "") > VALUE_MAX:
        return "too_long"
    found = locate(span, page.text)
    if found is None:
        return "span_not_in_page"
    if value is not None and (not value or value.casefold() not in found.span.casefold()):
        return "value_not_in_span"
    if contact_only(found.span) or (value is not None and contact_only(value)):
        return "contact_only"
    return found


def _widen_role(span: str, text: str, name: str) -> Located | None:
    """The tighter span first: a role beside the name on its line, then one on a line below."""
    beside = beside_name(span, text, name, SPAN_MAX)
    return beside if beside is not None else from_name_line(span, text, name, SPAN_MAX)


def _tally(
    method: str,
    field: str,
    proposed: str,
    result: Claim | Relation | str,
    verdicts: Counter[tuple[str, str, str]],
    adjusted: Counter[str],
) -> None:
    if isinstance(result, str):
        verdicts[method, field, result] += 1
        return
    verdicts[method, field, "kept"] += 1
    stored = result.evidence.span
    if stored.casefold() == proposed.casefold():
        if stored != proposed:
            adjusted["case_only"] += 1
    else:
        adjusted["role_below_name" if "\n" in stored else "role_beside_name"] += 1


def _belongs(subject: Subject, span: str, own: Subject | None) -> bool:
    return subject == own or mentions(span, subject.name)


def _evidence(found: Located, page: Page) -> Evidence:
    return Evidence(page.url, page.sha256, found.span, found.start, page.fetched_at)


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
