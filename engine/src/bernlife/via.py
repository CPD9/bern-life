"""A reason through a relation: shown because a project the result works on or leads matches.

A person named only on a project page has no claim of their own that matches the question, but
the project may. The result then carries `via` (contracts/result.schema.json): the relation with
its verbatim span, and the project's matching claims inline with their evidence, so the card
shows both sentences and the evaluator checks both. Membership of a unit does not count: on the
dev set it added nothing, and a broad unit could vouch for everyone in it.
"""

from collections.abc import Mapping, Sequence
from typing import Any

from bernlife.matching import Asked, matched_claims
from bernlife.profiles_db import timestamp
from bernlife.store import Relation, Store

VIA_KINDS = ("leads", "works_on")


def relation_reasons(
    question: Asked,
    ids: Sequence[str],
    store: Store,
    profiles: dict[str, dict[str, Any]],
    enrichment: dict[str, list[str]],
    kinds: Sequence[str] = VIA_KINDS,
) -> dict[str, tuple[Relation, list[tuple[str, int]]]]:
    """For each id, the first relation (in `kinds` order) whose other end has a claim matching
    the question, with that profile's matching claims. Fills `profiles` and `enrichment` with
    what it had to read."""
    relations = store.relations(ids, kinds)
    missing = sorted({r.to_profile_id for r in relations} - profiles.keys())
    profiles.update(store.profiles(missing))
    values = {c["value"] for pid in missing for c in profiles[pid]["fields"]["expertise"]}
    enrichment.update(store.enrichment(sorted(values - enrichment.keys())))
    order = {kind: n for n, kind in enumerate(kinds)}
    found: dict[str, tuple[Relation, list[tuple[str, int]]]] = {}
    for relation in sorted(
        relations, key=lambda r: (order[r.kind], r.from_profile_id, r.to_profile_id)
    ):
        if relation.from_profile_id in found:
            continue
        other: Mapping[str, Any] = profiles[relation.to_profile_id]
        matched = matched_claims(question, other, enrichment)
        if matched:
            found[relation.from_profile_id] = (relation, matched)
    return found


def via_record(
    relation: Relation, related: Mapping[str, Any], matched: list[tuple[str, int]]
) -> dict[str, Any]:
    record: dict[str, Any] = {
        "kind": relation.kind,
        "span": relation.span,
        "page_url": relation.page_url,
        "page_sha256": relation.page_sha256,
    }
    if relation.start is not None:
        record["start"] = relation.start
    return record | {
        "fetched_at": timestamp(relation.fetched_at),
        "related_profile_id": related["id"],
        "related_name": related["name"]["value"],
        "related_claims": [related["fields"][field][index] for field, index in matched],
    }
