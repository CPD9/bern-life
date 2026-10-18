"""Bundle records as rows of the Prisma tables, column for column.

Pure, so the mapping is tested without a database. A claim's `position` is its index in the
profile's field list; the name is the `name` field at position 0, which is how the profile is
read back in the same order.
"""

from collections.abc import Iterator, Mapping
from typing import Any

from bernlife.chunks import Chunk, vector_key
from bernlife.extract_records import fields_for

Record = Mapping[str, Any]
Row = dict[str, object]
PAGE_COLUMNS = ("url", "source_id", "unit", "fetched_at", "sha256", "status", "lang", "kind")
RELATION_COLUMNS = (
    "from_profile_id",
    "to_profile_id",
    "kind",
    "method",
    "page_url",
    "page_sha256",
    "span",
    "start",
)


def page_row(page: Record) -> Row:
    return {
        **{column: page.get(column) for column in PAGE_COLUMNS},
        "title": page.get("title"),
        "text": page["text"],
    }


def profile_row(profile: Record) -> Row:
    return {
        "id": profile["id"],
        "kind": profile["kind"],
        "source_id": profile["source_id"],
        "name": profile["name"]["value"],
        "source_url": profile["source_url"],
    }


def claim_rows(profile: Record) -> Iterator[tuple[str, Row]]:
    """(label, row) pairs; the label names the claim in a refusal without quoting page text."""
    yield f"{profile['id']}/name", _claim_row(profile["id"], "name", 0, profile["name"])
    for field in fields_for(profile["kind"]):
        for position, claim in enumerate(profile["fields"][field]):
            label = f"{profile['id']}/{field}/{position}"
            yield label, _claim_row(profile["id"], field, position, claim)


def _claim_row(profile_id: str, field: str, position: int, claim: Record) -> Row:
    evidence = claim["evidence"]
    return {
        "profile_id": profile_id,
        "field": field,
        "position": position,
        "value": claim["value"],
        "method": claim["method"],
        "page_url": evidence["page_url"],
        "page_sha256": evidence["page_sha256"],
        "span": evidence["span"],
        "start": evidence.get("start"),
    }


def relation_row(relation: Record) -> Row:
    return {column: relation.get(column) for column in RELATION_COLUMNS}


def vector_literal(vector: list[float]) -> str:
    return "[" + ",".join(repr(float(x)) for x in vector) + "]"


def chunk_row(chunk: Chunk, vectors: Mapping[str, list[float]]) -> Row:
    """Raises KeyError for a chunk with no stored vector; the loader turns that into a refusal."""
    return {
        "id": chunk.id,
        "profile_id": chunk.profile_id,
        "page_url": chunk.page_url,
        "text": chunk.text,
        "embedding": vector_literal(vectors[vector_key(chunk.text)]),
    }
