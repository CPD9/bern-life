"""Snapshot checks: is every claim on its page, and is every profile in the snapshot?

A claim is traceable when its page is in the snapshot, the page text hashes to the claim's
`page_sha256`, and the span appears in that text after whitespace normalisation. The hash is
recomputed from the text rather than read from the page record, so a stale record cannot vouch
for a span. A result shown through a related project or unit (`via`) is held to the same bar: the
relation's own span and every related claim are checked, and the related profile must exist.
"""

import hashlib
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from .match import claims, normalise_whitespace

Record = dict[str, Any]


@dataclass(frozen=True)
class Miss:
    query: str
    profile: str
    claim: str
    reason: str


class PageIndex:
    """Page hash and normalised text, computed once per page and only for pages a claim cites."""

    def __init__(self, pages: Mapping[str, Record]) -> None:
        self.pages = pages
        self._seen: dict[str, tuple[str, str]] = {}

    def lookup(self, url: str) -> tuple[str, str] | None:
        if url not in self._seen:
            if url not in self.pages:
                return None
            text = self.pages[url]["text"]
            digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
            self._seen[url] = (digest, normalise_whitespace(text))
        return self._seen[url]


def check_claims(query: str, results: Sequence[Record], index: PageIndex) -> tuple[int, list[Miss]]:
    """How many claims the results make, and each one that is not on its page."""
    checked, misses = 0, []
    for result in results:
        profile = result["profile"]
        for pointer, evidence in evidence_of(result):
            checked += 1
            reason = untraceable(evidence, index)
            if reason is not None:
                misses.append(Miss(query, profile["id"], pointer, reason))
    return checked, misses


def evidence_of(result: Record) -> list[tuple[str, Record]]:
    """Each piece of evidence a result shows, with its JSON pointer: profile claims, then `via`."""
    shown = [(pointer, claim["evidence"]) for pointer, claim in claims(result["profile"])]
    via = result.get("via")
    if via is not None:
        shown.append(("/via", via))
        shown += [
            (f"/via/related_claims/{i}", claim["evidence"])
            for i, claim in enumerate(via["related_claims"])
        ]
    return shown


def untraceable(evidence: Record, index: PageIndex) -> str | None:
    page = index.lookup(evidence["page_url"])
    if page is None:
        return "page_not_in_snapshot"
    digest, text = page
    if digest != evidence["page_sha256"]:
        return "page_sha256_differs"
    if normalise_whitespace(evidence["span"]) not in text:
        return "span_not_on_page"
    return None


def invented(results: Sequence[Record], snapshot_ids: Mapping[str, Record]) -> tuple[str, ...]:
    """Profile ids the results show, directly or through `via`, that the snapshot does not hold."""
    shown = [r["profile"]["id"] for r in results]
    shown += [r["via"]["related_profile_id"] for r in results if r.get("via") is not None]
    return tuple(pid for pid in shown if pid not in snapshot_ids)
