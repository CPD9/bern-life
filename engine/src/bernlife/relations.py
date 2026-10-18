"""Relations between profiles, each with its own verified span, in I1's `entity_relation` columns.

An end that names a unit only by its words ("Gerontechnology & Rehabilitation" in a staff line) is
looked up among the unit profiles' names; a relation whose end has no profile is dropped and
counted, never pointed at a guess.
"""

from collections import Counter
from collections.abc import Iterable

from bernlife.extract_records import Relation
from bernlife.merge import Merged

COLUMNS = (
    "from_profile_id",
    "to_profile_id",
    "kind",
    "method",
    "page_url",
    "page_sha256",
    "span",
    "start",
)


def build_relations(
    relations: Iterable[Relation], merged: Merged
) -> tuple[list[dict[str, object]], Counter[str]]:
    rows: dict[tuple[str, str, str], dict[str, object]] = {}
    dropped = Counter[str]()
    for relation in sorted(relations, key=_order):
        origin, target = merged.resolve(relation.origin), merged.resolve(relation.target)
        if origin is None or target is None:
            dropped["no_profile"] += 1
        elif origin == target:
            dropped["self_relation"] += 1
        else:
            rows.setdefault((origin, target, relation.kind), _row(origin, target, relation))
    return [rows[key] for key in sorted(rows)], dropped


def _order(relation: Relation) -> tuple[bool, str, int, str]:
    evidence = relation.evidence
    return (relation.method != "selector", evidence.page_url, evidence.start, relation.kind)


def _row(origin: str, target: str, relation: Relation) -> dict[str, object]:
    evidence = relation.evidence
    values = (origin, target, relation.kind, relation.method)
    values += (evidence.page_url, evidence.page_sha256, evidence.span, evidence.start)
    return dict(zip(COLUMNS, values, strict=True))
