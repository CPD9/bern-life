"""Who gets shown, and how complete each shown result is.

Exposure counts top-10 slots per source and per unit over the queries that should find someone,
next to each one's share of profiles in the snapshot, so a large unit crowding out small ones is
visible. A profile's unit is the unit of the page it links to (from the snapshot pages).

Exposure by unit size puts the same slots into two groups by the rule in docs/metrics.md: the units
of the three case sources, sized by how many profiles of the snapshot link to a page of the unit; a
unit with more profiles than the median unit is large, and the median one and every unit below it
are small. The same groups are also split by source, because ARTORG and the Diabetes Center Berne
are one unit each: within one source, small and large units compete for the same slots.
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


Unit = tuple[str, str]


def size_groups(
    units: Sequence[Unit],
    group: Mapping[Unit, str],
    sizes: Mapping[Unit, int],
    slots: Mapping[Unit, int],
) -> list[dict[str, object]]:
    """Small and large among these units, each with its profiles and top-10 slots as a share of
    these units' own; a group with no unit here is left out."""
    total_profiles = sum(sizes[unit] for unit in units)
    total_slots = sum(slots.get(unit, 0) for unit in units)
    rows = []
    for name in ("small", "large"):
        members = [unit for unit in units if group[unit] == name]
        if not members:
            continue
        profiles = sum(sizes[unit] for unit in members)
        shown_slots = sum(slots.get(unit, 0) for unit in members)
        rows.append(
            {
                "name": name,
                "units": len(members),
                "profiles": profiles,
                "profile_share": profiles / total_profiles,
                "slots": shown_slots,
                "slot_share": shown_slots / total_slots if total_slots else None,
                "units_never_shown": sum(not slots.get(unit) for unit in members),
            }
        )
    return rows


def exposure_by_size(
    results: Sequence[QueryResult],
    profiles: Mapping[str, Record] | None,
    pages: Mapping[str, Record] | None,
) -> dict[str, object] | None:
    """Top-10 slots of small and large units next to their share of profiles, over all three
    sources and within each; None without the snapshot. Slots on a unit outside the case sources,
    or on a page not stored, are counted apart and in neither group."""
    if profiles is None or pages is None:
        return None
    sizes: Counter[Unit] = Counter()
    for profile in profiles.values():
        unit = page_unit(profile, pages)
        if unit is not None and unit[0] in SOURCES:
            sizes[unit] += 1
    if not sizes:
        return None
    middle = median(sizes.values())
    group = {unit: "large" if size > middle else "small" for unit, size in sizes.items()}
    slots: Counter[Unit] = Counter()
    outside = 0
    for profile in (result["profile"] for result in shown(results)):
        unit = page_unit(profile, pages)
        if unit in group:
            slots[unit] += 1
        else:
            outside += 1
    units = sorted(sizes)
    return {
        "sources": list(SOURCES),
        "median_profiles": middle,
        "groups": size_groups(units, group, sizes, slots),
        "by_source": [
            {"source": source, "groups": size_groups(mine, group, sizes, slots)}
            for source in SOURCES
            if (mine := [unit for unit in units if unit[0] == source])
        ],
        "slots_outside": outside,
    }
