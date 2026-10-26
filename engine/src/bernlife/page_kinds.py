"""Each stored page's kind against its site's `page_types` now: what `crawl --offline` would change.

A page's kind is written by the crawl from its URL alone (`classify.py`), so a change to a source
file can be previewed here without reading a page or asking a model, and applied with
`crawl --offline`, which rebuilds `pages.jsonl` from the kept HTML.
"""

from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from urllib.parse import urlsplit

from bernlife.classify import classify
from bernlife.extract_prompt import windows
from bernlife.extract_records import Page
from bernlife.sources import Site


@dataclass(frozen=True)
class KindChange:
    page: Page
    new_kind: str


def kind_changes(pages: Sequence[Page], sites: Mapping[str, Site]) -> list[KindChange]:
    """Pages whose stored kind differs from what their site's patterns give now, in URL order.
    A page on a host no source lists keeps its kind."""
    changes = []
    for page in sorted(pages, key=lambda p: p.url):
        site = sites.get(urlsplit(page.url).hostname or "")
        if site is not None and (new_kind := classify(site, page.url)) != page.kind:
            changes.append(KindChange(page, new_kind))
    return changes


def report(changes: Sequence[KindChange]) -> str:
    """One line per page, then the count by direction and the model windows a re-extraction
    would send for them, pages with the same text counted once: the cache answers the twin."""
    lines = [f"{c.page.url}  {c.page.kind} -> {c.new_kind}" for c in changes]
    directions = Counter(f"{c.page.kind} -> {c.new_kind}" for c in changes)
    by_direction = ", ".join(f"{d} {n}" for d, n in sorted(directions.items()))
    distinct = {c.page.sha256: c.page for c in changes}
    calls = sum(len(windows(page.text)) for page in distinct.values())
    lines.append(f"{len(changes)} pages change kind: {by_direction or 'none'}")
    lines.append(f"model windows for them: {calls} ({len(distinct)} distinct texts)")
    return "\n".join(lines)
