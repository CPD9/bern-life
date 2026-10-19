"""A reason from the result's own page: a passage next to its name that matches the question.

Rule 5 shows a candidate only if a claim of its own (or of a project it works on) matches the
question. Most people are a name and a role from a team page, and that page often says, right
next to the name, what the question asks: "Neuro Robotics" under a master student's name. Such a
candidate may still be shown when its own page, the page its name claim cites, has words within
WINDOW characters of that name whose forms match MIN_WORDS distinct word forms of the question
(all of them if it has fewer), by the same test the claim rule uses (matching.py). One shared word
is enough for a claim, which is about its profile; a page window is not, so it needs two. Words of
the name itself never count. The window never holds another
profile's name from that page: it stops before the next name, and it reaches back before the name
only when no other name ends within WINDOW characters before it. On a team list the lines under
a name belong to that name, so one person's line is never lent to the next.

The result then carries `passage`: the verbatim span from the name to the nearest matching words,
with the page's url, sha256, offset and fetch date. Code checks that the page text hashes to the
name claim's sha256 and that the span is that text at that offset. It is a passage on their page,
not a claim of their profile: the reason stays the plain one from the profile's own claims, the
explainer never sees it, it ranks after a result with a matching claim at an equal fused score,
and abstention never reads it.
"""

import bisect
import hashlib
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from functools import cache
from typing import Any, Protocol

from bernlife.matching import Asked, forms
from bernlife.profiles_db import timestamp

# Fixed before any dev run: on pages naming several profiles, half of all gaps between two names
# are under 102 characters, so there the next name ends the window; on a page about one profile
# (median text 734 characters), 300 on each side reaches most of what surrounds the name.
WINDOW = 300
MIN_WORDS = 2
KIND = "own_page"
TOKEN = re.compile(r"[^\W\d_]+")


@dataclass(frozen=True)
class OwnPage:
    url: str
    sha256: str
    text: str
    fetched_at: datetime
    names: tuple[tuple[int, int], ...]  # (start, end) of every name claim on the page


@dataclass(frozen=True)
class Passage:
    page_url: str
    page_sha256: str
    span: str
    start: int
    fetched_at: datetime


class PageStore(Protocol):
    def own_pages(self, urls: Sequence[str]) -> dict[str, OwnPage]: ...


@cache
def token_forms(token: str) -> frozenset[str]:
    return frozenset(forms(token))


class PageWords:
    """The words of one page with their offsets, read once however many names it holds."""

    def __init__(self, page: OwnPage):
        self.page = page
        self.verified = hashlib.sha256(page.text.encode("utf-8")).hexdigest() == page.sha256
        self.tokens = [(m.start(), m.end(), m.group()) for m in TOKEN.finditer(page.text)]
        self.starts = [start for start, _, _ in self.tokens]

    def between(self, low: int, high: int) -> list[tuple[int, int, str]]:
        """The words lying wholly inside [low, high)."""
        first, last = bisect.bisect_left(self.starts, low), bisect.bisect_left(self.starts, high)
        return [t for t in self.tokens[first:last] if t[1] <= high]


def bounds(names: Sequence[tuple[int, int]], start: int, end: int, length: int) -> tuple[int, int]:
    """Up to WINDOW characters after the name, ending before the next name on the page, and as
    many before it unless another name ends there (then the text before belongs to that name)."""
    reach = max(0, start - WINDOW)
    high = min([length, end + WINDOW, *(s for s, _ in names if s >= end)])
    before = any(reach < other_end <= start for _, other_end in names)
    return (start if before else reach), high


def passage_near(question: Asked, words: PageWords, span: str, start: int | None) -> Passage | None:
    """The span from the name to the nearest words matching MIN_WORDS distinct word forms of the
    question, or None."""
    page = words.page
    if not words.verified:
        return None
    at = page.text.find(span) if start is None else start
    if at < 0 or page.text[at : at + len(span)] != span:
        return None
    end = at + len(span)
    low, high = bounds(page.names, at, end, len(page.text))
    matches = []  # (gap to the name, start, end, shared forms) of each matching word
    for token_start, token_end, token in words.between(low, high):
        if token_start < end and token_end > at:
            continue
        shared = token_forms(token) & question.forms
        if shared:
            gap = token_start - end if token_start >= end else at - token_end
            matches.append((gap, token_start, token_end, shared))
    need = min(MIN_WORDS, len(question.forms))
    seen: set[str] = set()
    first, last = at, end
    for _, token_start, token_end, shared in sorted(matches, key=lambda m: m[:2]):
        if shared <= seen:
            continue
        seen |= shared
        first, last = min(first, token_start), max(last, token_end)
        if len(seen) >= need:
            return Passage(page.url, page.sha256, page.text[first:last], first, page.fetched_at)
    return None


def own_page_passages(
    question: Asked, ids: Sequence[str], store: PageStore, profiles: Mapping[str, Any]
) -> dict[str, Passage]:
    """For each id, a passage of its own page next to its name that matches the question."""
    evidence = {pid: profiles[pid]["name"]["evidence"] for pid in ids}
    pages = store.own_pages(sorted({e["page_url"] for e in evidence.values()}))
    words: dict[str, PageWords] = {}
    found: dict[str, Passage] = {}
    for pid, cited in evidence.items():
        page = pages.get(cited["page_url"])
        if page is None or page.sha256 != cited["page_sha256"]:
            continue
        if page.url not in words:
            words[page.url] = PageWords(page)
        passage = passage_near(question, words[page.url], cited["span"], cited.get("start"))
        if passage is not None:
            found[pid] = passage
    return found


def passage_record(passage: Passage) -> dict[str, Any]:
    return {
        "kind": KIND,
        "span": passage.span,
        "page_url": passage.page_url,
        "page_sha256": passage.page_sha256,
        "start": passage.start,
        "fetched_at": timestamp(passage.fetched_at),
    }
