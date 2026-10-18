"""The searchable texts: one chunk per profile, and passages of the pages that evidence cites.

A profile chunk holds the profile's own claim values, so a query in the profile's words finds it
directly, followed by the enrichment terms of its expertise values (retrieval help only), so a lay
or translated query finds it without a live model call. A passage is a run of whole lines cut
from a page, so every claim or relation span that lies inside it is still a verbatim substring;
search uses that to credit the profiles whose evidence a matching passage holds. Only cited
pages are cut: a passage that no profile's evidence touches could never become a result.
"""

import hashlib
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from bernlife.extract_records import FIELDS

PASSAGE_CHARS = 1000
Record = Mapping[str, Any]


@dataclass(frozen=True)
class Chunk:
    id: str
    kind: str  # "profile" or "chunk", as vectors.jsonl names them
    profile_id: str | None
    page_url: str
    source_id: str
    text: str


def profile_chunk(profile: Record, enrichment: Mapping[str, Sequence[str]] | None = None) -> Chunk:
    values = [str(claim["value"]) for claim in claims_of(profile)]
    terms = enrichment or {}
    values += [
        term for claim in profile["fields"]["expertise"] for term in terms.get(claim["value"], [])
    ]
    return Chunk(
        id=str(profile["id"]),
        kind="profile",
        profile_id=str(profile["id"]),
        page_url=str(profile["source_url"]),
        source_id=str(profile["source_id"]),
        text="\n".join(values),
    )


def windows(text: str, limit: int = PASSAGE_CHARS) -> list[str]:
    """Runs of whole lines of at most `limit` characters; a longer line is cut at spaces."""
    pieces = [piece for line in text.split("\n") for piece in _cut(line, limit)]
    runs: list[list[str]] = []
    size = 0
    for piece in pieces:
        if runs and size + 1 + len(piece) <= limit:
            runs[-1].append(piece)
            size += 1 + len(piece)
        else:
            runs.append([piece])
            size = len(piece)
    return [run for run in ("\n".join(lines).strip() for lines in runs) if run]


def _cut(line: str, limit: int) -> list[str]:
    if len(line) <= limit:
        return [line]
    parts, current = [], ""
    for word in line.split(" "):
        if current and len(current) + 1 + len(word) > limit:
            parts.append(current)
            current = word
        else:
            current = f"{current} {word}" if current else word
    return [*parts, current]


def page_passages(page: Record) -> list[Chunk]:
    title = str(page.get("title") or "")
    sha = str(page["sha256"])
    return [
        Chunk(
            id=f"page-{sha[:16]}-{number}",
            kind="chunk",
            profile_id=None,
            page_url=str(page["url"]),
            source_id=str(page["source_id"]),
            text=f"{title}\n{window}" if title else window,
        )
        for number, window in enumerate(windows(str(page["text"])))
    ]


def cited_urls(profiles: Iterable[Record], relations: Iterable[Record]) -> set[str]:
    urls = {str(relation["page_url"]) for relation in relations}
    for profile in profiles:
        urls.add(str(profile["source_url"]))
        urls.update(str(claim["evidence"]["page_url"]) for claim in claims_of(profile))
    return urls


def claims_of(profile: Record) -> list[Record]:
    """The name first, then the fields in contract order."""
    return [profile["name"], *(claim for field in FIELDS for claim in profile["fields"][field])]


def build_chunks(
    pages: Iterable[Record],
    profiles: list[Record],
    relations: list[Record],
    enrichment: Mapping[str, Sequence[str]] | None = None,
) -> list[Chunk]:
    cited = cited_urls(profiles, relations)
    chunks = [profile_chunk(profile, enrichment) for profile in profiles]
    chunks += [chunk for page in pages if page["url"] in cited for chunk in page_passages(page)]
    return sorted(chunks, key=lambda chunk: chunk.id)


def vector_key(text: str) -> str:
    """Vectors are stored by the text they were made from, so a changed text never reuses one."""
    return hashlib.sha256(passage_input(text).encode("utf-8")).hexdigest()


def passage_input(text: str) -> str:
    return f"passage: {text}"


def query_input(text: str) -> str:
    return f"query: {text}"
