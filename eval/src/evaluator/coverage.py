"""Who gets shown, and how complete each shown result is.

Exposure counts top-10 slots per source and per unit over the queries that should find someone,
next to each one's share of profiles in the snapshot, so a large unit crowding out small ones is
visible. A profile's unit is the unit of the page it links to (from the snapshot pages).
"""

from collections import Counter
from collections.abc import Callable, Mapping, Sequence
from typing import Any

from .score import QueryResult

Record = dict[str, Any]

# The case's required result fields, in its order.
FIELDS = (
    "person",
    "role/affiliation",
    "unit",
    "expertise",
    "projects",
    "infrastructure/services",
    "reason",
    "source link",
)
# The fields a source page itself can state; reason and link come from the system.
PAGE_FIELDS = FIELDS[:6]


def shown(results: Sequence[QueryResult]) -> list[Record]:
    return [result for query in results if not query.gold.abstain for result in query.top]


def filled(result: Record) -> dict[str, bool]:
    profile, fields = result["profile"], result["profile"]["fields"]
    return {
        "person": bool(profile["name"]["value"]),
        "role/affiliation": bool(fields["role"]),
        "unit": bool(fields["unit"]),
        "expertise": bool(fields["expertise"]),
        "projects": bool(fields["projects"]),
        "infrastructure/services": bool(fields["infrastructure"] or fields["services"]),
        "reason": bool(result["reason"]["text"]),
        "source link": bool(profile["source_url"]),
    }


def completeness(results: Sequence[QueryResult]) -> dict[str, object]:
    rows = [filled(result) for result in shown(results)]
    counts = {field: sum(row[field] for row in rows) for field in FIELDS}
    mean = sum(sum(row.values()) / len(FIELDS) for row in rows) / len(rows) if rows else None
    return {
        "results": len(rows),
        "filled": counts,
        "mean_share": mean,
        "status": "human check pending",
    }


def shares(slots: Counter[str], snapshot: Counter[str] | None) -> list[dict[str, object]]:
    total, profiles = sum(slots.values()), sum(snapshot.values()) if snapshot else 0
    names = sorted(set(slots) | set(snapshot or ()), key=lambda name: (-slots[name], name))
    return [
        {
            "name": name,
            "slots": slots[name],
            "slot_share": slots[name] / total if total else None,
            "profile_share": snapshot[name] / profiles if snapshot and profiles else None,
        }
        for name in names
    ]


def exposure(
    results: Sequence[QueryResult],
    profiles: Mapping[str, Record] | None,
    pages: Mapping[str, Record] | None,
) -> dict[str, object]:
    profiles_shown = [result["profile"] for result in shown(results)]

    def tally(key: Callable[[Record], str], pool: Sequence[Record]) -> Counter[str]:
        return Counter(key(profile) for profile in pool)

    def source(profile: Record) -> str:
        return profile["source_id"]

    snapshot = list(profiles.values()) if profiles is not None else None
    by_source = shares(tally(source, profiles_shown), snapshot and tally(source, snapshot))
    if pages is None:
        return {"slots": len(profiles_shown), "by_source": by_source, "by_unit": None}

    def unit(profile: Record) -> str:
        page = pages.get(profile["source_url"])
        return page["unit"] if page else "unknown"

    by_unit = shares(tally(unit, profiles_shown), snapshot and tally(unit, snapshot))
    return {"slots": len(profiles_shown), "by_source": by_source, "by_unit": by_unit}
