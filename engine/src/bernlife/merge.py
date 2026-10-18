"""One profile per person, unit, project or infrastructure, built from verified claims only.

People merge on their name key within a source (titles, accents and case removed), so the `_eng`
and `_ger` twins of a staff page and a team list that names the same person meet. Units, projects
and infrastructure merge on their page URL without the language suffix, because their names change
with the language. The displayed name and the result link come from the subject's own page,
English first, so the output does not depend on the order pages were read in.
"""

from collections import defaultdict
from collections.abc import Iterable, Mapping
from dataclasses import dataclass

from bernlife.extract_records import Claim, Page, Subject, fields_for
from bernlife.names import fold, slug


@dataclass(frozen=True)
class Merged:
    profiles: tuple[dict[str, object], ...]
    ids: Mapping[Subject, str]
    by_name: Mapping[tuple[str, str, str], str]
    unnamed: int

    def resolve(self, subject: Subject) -> str | None:
        if subject in self.ids:
            return self.ids[subject]
        if subject.key.startswith("name:"):
            return self.by_name.get((subject.kind, subject.source_id, subject.key[5:]))
        return None


def merge(
    claims: Iterable[Claim], pages: Mapping[str, Page], own: Mapping[str, Subject | None]
) -> Merged:
    grouped: dict[Subject, list[Claim]] = defaultdict(list)
    for claim in claims:
        grouped[claim.subject].append(claim)
    profiles, ids, by_name, taken = [], {}, {}, set()
    unnamed = 0
    for subject in sorted(grouped, key=lambda s: (s.kind, s.source_id, s.key)):
        ordered = sorted(grouped[subject], key=lambda c: _preference(c, pages, own))
        names = [claim for claim in ordered if claim.field == "name"]
        if not names:
            unnamed += 1
            continue
        profile_id = _unique_id(subject, names[0].value, taken)
        ids[subject] = profile_id
        for claim in names:
            by_name.setdefault((subject.kind, subject.source_id, _name_key(claim)), profile_id)
        profiles.append(_record(profile_id, subject, names[0], ordered))
    profiles.sort(key=lambda profile: str(profile["id"]))
    return Merged(tuple(profiles), ids, by_name, unnamed)


def _preference(
    claim: Claim, pages: Mapping[str, Page], own: Mapping[str, Subject | None]
) -> tuple[bool, bool, bool, int, str, int]:
    url = claim.evidence.page_url
    return (
        claim.method != "selector",
        own.get(url) != claim.subject,
        pages[url].lang != "en",
        len(url),
        url,
        claim.evidence.start,
    )


def _record(
    profile_id: str, subject: Subject, name: Claim, ordered: list[Claim]
) -> dict[str, object]:
    fields: dict[str, list[dict[str, object]]] = {f: [] for f in fields_for(subject.kind)}
    seen: set[tuple[str, str]] = set()
    for claim in ordered:
        key = (claim.field, claim.value.casefold())
        if claim.field in fields and key not in seen:
            seen.add(key)
            fields[claim.field].append(_claim_record(claim))
    return {
        "id": profile_id,
        "kind": subject.kind,
        "source_id": subject.source_id,
        "name": _claim_record(name),
        "source_url": name.evidence.page_url,
        "fields": fields,
    }


def _claim_record(claim: Claim) -> dict[str, object]:
    return {"value": claim.value, "method": claim.method, "evidence": claim.evidence.as_record()}


def _name_key(claim: Claim) -> str:
    """The same key a `name:` subject carries, so a unit named in a staff line finds its page."""
    if claim.subject.kind == "person":
        return claim.subject.key[5:]
    return fold(claim.value)


def _unique_id(subject: Subject, name: str, taken: set[str]) -> str:
    base = f"{subject.kind}-{subject.source_id}-{slug(name)}"
    candidate, number = base, 1
    while candidate in taken:
        number += 1
        candidate = f"{base}-{number}"
    taken.add(candidate)
    return candidate
