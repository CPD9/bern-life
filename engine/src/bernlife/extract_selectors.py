"""What a page's structure states plainly, read without a model (`method: "selector"`).

21 of the 22 hosts share UniBE's CMS. Its titles read `Section: <Name> - <Institute>`, and its
text opens with the institute line, then the section, the name line, the role line and an optional
`University of Bern, <centre>, <group>` line. A name read from the title counts only if it is also
a whole line of the text, so a selector never states something the page text does not show.
"""

import re
from urllib.parse import urlsplit

from bernlife.extract_records import PROFILE_KINDS, Candidate, Page, RelationCandidate, Subject
from bernlife.names import (
    display_name,
    fold,
    has_language_suffix,
    looks_like_person,
    person_key,
    twin_key,
)

SELECTOR = "selector"
TITLE_SUFFIX = re.compile(r"^(.*\S)\s+[-–|]\s+(\S.*)$")
AFFILIATION = re.compile(r"^(?:University of Bern|Universität Bern|Université de Berne), ")
LABELS = frozenset(
    {"phone", "telefon", "telephone", "tel", "mobile", "fax", "email", "e mail", "mail"}
    | {"e mail address", "office", "buro", "room", "raum", "address", "adresse", "postal address"}
    | {"postadresse", "contact", "kontakt", "share", "weiterempfehlen", "print", "drucken", "top"}
    | {"facebook", "linkedin", "twitter", "website", "homepage", "orcid", "vcard", "office hours"}
)
UNIT_WORDS = frozenset(
    {"departement", "department", "institut", "institute", "abteilung", "division", "center"}
    | {"centre", "zentrum", "faculty", "fakultat", "klinik", "clinic"}
)
ROLE_MAX_CHARS = 160
RELATION_TO_INSTITUTE = {"unit": "part_of", "infrastructure": "operates"}


def person_subject(source_id: str, name: str) -> Subject:
    return Subject("person", source_id, "name:" + person_key(name), display_name(name))


def unit_named(source_id: str, name: str) -> Subject:
    """A unit known only by name, resolved against the unit profiles when relations are built."""
    return Subject("unit", source_id, "name:" + fold(name), name)


def institute_subject(page: Page, name: str) -> Subject:
    return Subject("unit", page.source_id, f"host:{urlsplit(page.url).hostname}", name)


def page_name(page: Page) -> str | None:
    match = TITLE_SUFFIX.match(page.title)
    rest = match.group(1) if match else page.title.strip()
    candidates = [rest]
    candidates += [rest.split(sep, 1)[1] for sep in (": ", " - ", " – ") if sep in rest]
    lines = set(page.text.split("\n"))
    return next((name for name in candidates if name in lines), None)


def site_line(page: Page) -> str | None:
    """The institute line of the page header: the title's site suffix, when the text shows it."""
    match = TITLE_SUFFIX.match(page.title)
    if match is None or match.group(2) not in page.text.split("\n"):
        return None
    return match.group(2)


def page_subject(page: Page) -> Subject | None:
    """What the page itself is about, or None for listings and pages without a readable name."""
    name = page_name(page)
    if page.kind not in PROFILE_KINDS or name is None:
        return None
    if page.kind == "person":
        person = display_name(name)
        return person_subject(page.source_id, person) if looks_like_person(person) else None
    if name == site_line(page):
        return institute_subject(page, name)
    return Subject(page.kind, page.source_id, _page_key(page, name), name)


def _page_key(page: Page, name: str) -> str:
    """UniBE's CMS pairs language versions by URL suffix, and their names differ by language.
    Other sites (DCB) use different slugs per language, so their pages pair by host and name."""
    if has_language_suffix(page.url):
        return "url:" + twin_key(page.url)
    return f"page:{urlsplit(page.url).hostname}:{fold(name)}"


def selector_candidates(page: Page) -> tuple[list[Candidate], list[RelationCandidate]]:
    candidates: list[Candidate] = []
    relations: list[RelationCandidate] = []
    site = site_line(page)
    institute = institute_subject(page, site) if site else None
    if institute and site:
        candidates.append(Candidate(institute, "name", site, site, SELECTOR, page.url))
    subject = page_subject(page)
    name = page_name(page)
    if subject is None or name is None or subject == institute:
        return candidates, relations
    candidates.append(Candidate(subject, "name", subject.name, name, SELECTOR, page.url))
    if subject.kind == "person":
        _person_lines(page, subject, name, candidates, relations)
        if institute and site:
            candidates.append(Candidate(subject, "unit", site, site, SELECTOR, page.url))
            relations.append(_relation(subject, institute, "member_of", site, page))
    elif institute and site and subject.kind in RELATION_TO_INSTITUTE:
        kind = RELATION_TO_INSTITUTE[subject.kind]
        origin, target = (subject, institute) if kind == "part_of" else (institute, subject)
        relations.append(_relation(origin, target, kind, site, page))
    return candidates, relations


def _person_lines(
    page: Page,
    person: Subject,
    name_line: str,
    candidates: list[Candidate],
    relations: list[RelationCandidate],
) -> None:
    lines = page.text.split("\n")
    following = lines[lines.index(name_line) + 1 :][:3]
    if following and _is_role(following[0]):
        field = "unit" if fold(following[0]).split()[0] in UNIT_WORDS else "role"
        candidates.append(Candidate(person, field, following[0], following[0], SELECTOR, page.url))
    for line in following:
        if not AFFILIATION.match(line):
            continue
        for part in (part.strip() for part in line.split(", ")[1:]):
            if part:
                candidates.append(Candidate(person, "unit", part, line, SELECTOR, page.url))
                unit = unit_named(page.source_id, part)
                relations.append(_relation(person, unit, "member_of", line, page))


def _is_role(line: str) -> bool:
    if AFFILIATION.match(line) or len(line) > ROLE_MAX_CHARS:
        return False
    return fold(line) not in LABELS and not line.startswith("[")


def _relation(
    origin: Subject, target: Subject, kind: str, span: str, page: Page
) -> RelationCandidate:
    return RelationCandidate(origin, target, kind, span, SELECTOR, page.url)
