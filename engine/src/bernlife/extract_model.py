"""The model pass: Apertus proposes values with spans, and the verifier decides what is kept.

The model reads one window of a page per call (`extract_prompt.py`) through the cached router
under role `extract`. A reply that does not parse, or an item of the wrong shape, is counted as
`bad_json` and contributes nothing; a model failure is counted by its marker and the run goes on.
"""

from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from bernlife.cache import CacheMiss, Message
from bernlife.extract_prompt import ASKED, page_messages
from bernlife.extract_records import Candidate, Page, RelationCandidate, Subject
from bernlife.extract_selectors import institute_subject, person_subject, site_line
from bernlife.llm_http import ModelUnavailable
from bernlife.llm_json import parse_json
from bernlife.names import display_name

MODEL = "model"

Ask = Callable[[list[Message]], str]


@dataclass(frozen=True)
class ModelOutcome:
    candidates: tuple[Candidate, ...]
    relations: tuple[RelationCandidate, ...]
    failures: Counter[str]
    calls: int
    cached: int


def model_pass(
    page: Page, subject: Subject | None, ask: Ask, is_cached: Callable[[list[Message]], bool]
) -> ModelOutcome:
    candidates: list[Candidate] = []
    relations: list[RelationCandidate] = []
    failures = Counter[str]()
    all_messages = page_messages(page)
    cached = sum(1 for messages in all_messages if is_cached(messages))
    for messages in all_messages:
        try:
            reply = parse_json(ask(messages))
        except ValueError:
            failures["bad_json"] += 1
            continue
        except ModelUnavailable as unavailable:
            failures[f"model_{unavailable.marker}"] += 1
            continue
        except CacheMiss:
            failures["cache_miss"] += 1
            continue
        malformed = read_reply(reply, page, subject, candidates, relations)
        if malformed:
            failures["bad_json"] += malformed
    return ModelOutcome(tuple(candidates), tuple(relations), failures, len(all_messages), cached)


def read_reply(
    reply: dict[str, Any],
    page: Page,
    subject: Subject | None,
    candidates: list[Candidate],
    relations: list[RelationCandidate],
) -> int:
    """Adds what the reply proposes; returns how many of its items had the wrong shape."""
    malformed = 0
    proposed = reply.get("subject")
    if subject is not None and isinstance(proposed, dict):
        for field in ASKED.get(page.kind, ()):
            pairs, bad = _pairs(proposed.get(field, []))
            malformed += bad
            candidates += [Candidate(subject, field, v, s, MODEL, page.url) for v, s in pairs]
    people = reply.get("people", [])
    for person in people if isinstance(people, list) else []:
        malformed += _read_person(person, page, subject, candidates, relations)
    return malformed + (0 if isinstance(people, list) else 1)


def _read_person(
    item: object,
    page: Page,
    subject: Subject | None,
    candidates: list[Candidate],
    relations: list[RelationCandidate],
) -> int:
    if not isinstance(item, dict) or (name := _pair(item.get("name"))) is None:
        return 1
    value, span = display_name(name[0]), name[1]
    person = person_subject(page.source_id, value)
    candidates.append(Candidate(person, "name", value, span, MODEL, page.url))
    roles, malformed = _pairs(item.get("role", []))
    candidates += [Candidate(person, "role", v, s, MODEL, page.url) for v, s in roles]
    target = _membership_target(page, subject)
    if target is not None:
        relations.append(
            RelationCandidate(person, target, _kind(item, target), span, MODEL, page.url)
        )
    return malformed


def _membership_target(page: Page, subject: Subject | None) -> Subject | None:
    if subject is not None and subject.kind in ("unit", "project"):
        return subject
    site = site_line(page)
    return institute_subject(page, site) if page.kind == "listing" and site else None


def _kind(item: dict[str, Any], target: Subject) -> str:
    if item.get("relation") == "lead":
        return "leads"
    return "member_of" if target.kind == "unit" else "works_on"


def _pairs(items: object) -> tuple[list[tuple[str, str]], int]:
    if not isinstance(items, list):
        return [], 1
    pairs = [_pair(item) for item in items]
    return [pair for pair in pairs if pair is not None], sum(1 for p in pairs if p is None)


def _pair(item: object) -> tuple[str, str] | None:
    if not isinstance(item, dict):
        return None
    value, span = item.get("value"), item.get("span")
    if isinstance(value, str) and isinstance(span, str):
        return value, span
    return None
