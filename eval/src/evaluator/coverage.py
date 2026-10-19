"""Who gets shown, and how complete each shown result is.

Exposure counts top-10 slots per source and per unit over the queries that should find someone,
next to each one's share of profiles in the snapshot, so a large unit crowding out small ones is
visible. A profile's unit is the unit of the page it links to (from the snapshot pages).

Exposure by unit size puts the same slots into two groups whose rule is fixed before any slot is
counted (docs/metrics.md): the units of the three case sources, sized by how many profiles of the
snapshot link to a page of the unit; a unit with more profiles than the median unit is large, and
the median one and every unit below it are small.
"""

from collections import Counter
from collections.abc import Callable, Mapping, Sequence
from statistics import median
from typing import Any

from .score import QueryResult
from .summary import SOURCES

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


def page_unit(profile: Record, pages: Mapping[str, Record]) -> tuple[str, str] | None:
    """The source and unit of the page a profile links to; None when the page is not stored."""
    page = pages.get(profile["source_url"])
    return None if page is None else (page["source_id"], page["unit"])


def exposure_by_size(
    results: Sequence[QueryResult],
    profiles: Mapping[str, Record] | None,
    pages: Mapping[str, Record] | None,
) -> dict[str, object] | None:
    """Top-10 slots of small and large units next to their share of profiles; None without the
    snapshot. Slots on a unit outside the case sources, or on a page not stored, are counted
    apart and in neither group."""
    if profiles is None or pages is None:
        return None
    sizes: Counter[tuple[str, str]] = Counter()
    for profile in profiles.values():
        unit = page_unit(profile, pages)
        if unit is not None and unit[0] in SOURCES:
            sizes[unit] += 1
    if not sizes:
        return None
    middle = median(sizes.values())
    group = {unit: "large" if size > middle else "small" for unit, size in sizes.items()}
    slots: Counter[str] = Counter()
    seen: dict[str, set[tuple[str, str]]] = {"small": set(), "large": set()}
    outside = 0
    for profile in (result["profile"] for result in shown(results)):
        unit = page_unit(profile, pages)
        if unit not in group:
            outside += 1
            continue
        slots[group[unit]] += 1
        seen[group[unit]].add(unit)
    total_slots, total_profiles = sum(slots.values()), sum(sizes.values())
    rows = []
    for name in ("small", "large"):
        units = [unit for unit, g in group.items() if g == name]
        count = sum(sizes[unit] for unit in units)
        rows.append(
            {
                "name": name,
                "units": len(units),
                "profiles": count,
                "profile_share": count / total_profiles,
                "slots": slots[name],
                "slot_share": slots[name] / total_slots if total_slots else None,
                "units_never_shown": len(units) - len(seen[name]),
            }
        )
    return {
        "sources": list(SOURCES),
        "median_profiles": middle,
        "groups": rows,
        "slots_outside": outside,
    }
