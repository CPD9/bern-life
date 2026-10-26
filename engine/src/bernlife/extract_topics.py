"""Which person pages the topics pass reads (`extract --only-missing-topics`).

A person page is read once more, for what the person works on, when no profile whose name claim
cites the page has an expertise claim yet, the page has a readable subject the claims can join,
and its text has at least MIN_TEXT characters: a shorter page holds a name, a role and contact
lines, nothing to extract. A page whose bare-name profile has no claims but whose titled twin
("..., MD") has them is not read again.
"""

from collections.abc import Iterable, Sequence
from typing import Any

from bernlife.extract_prompt import windows
from bernlife.extract_records import Page
from bernlife.extract_selectors import page_subject

MIN_TEXT = 300


def missing_topics(
    pages: Iterable[Page],
    profiles: Iterable[dict[str, Any]],
    opportunity_sources: frozenset[str] = frozenset(),
) -> list[Page]:
    """In page order. `profiles` are the profile pass's own, so the choice is the same on every
    run from the cache."""
    has_expertise: dict[str, bool] = {}
    for profile in profiles:
        url = str(profile["name"]["evidence"]["page_url"])
        has_expertise[url] = has_expertise.get(url, False) or bool(profile["fields"]["expertise"])
    return [
        page
        for page in pages
        if page.kind == "person"
        and len(page.text) >= MIN_TEXT
        and has_expertise.get(page.url) is False
        and page_subject(page, page.source_id not in opportunity_sources) is not None
    ]


def report(pages: Sequence[Page]) -> str:
    calls = sum(len(windows(page.text)) for page in pages)
    return "\n".join(
        [
            *(page.url for page in pages),
            f"{len(pages)} person pages without an expertise claim; "
            f"model windows for them: {calls}",
        ]
    )
