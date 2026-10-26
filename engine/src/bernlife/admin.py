"""What the Admin app reads: the engine's audit of model calls summarised per UTC day, and the
person profiles whose name has the shape of a company or group.

The audit (cache.py) holds one line per model call: when, role, model, cache key, outcome and
latency. An outcome is one of the cache's words (hit, miss, budget, live) or a failure marker,
never error text; a value off that shape is counted as `other`, so a line nothing here wrote can
never reach a screen. The name rule reads word shapes, not a list of names: extraction now and
then takes a company from a partner list for a person, and a person checks the page.
"""

import re
from collections import Counter
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from datetime import date
from typing import Any

import psycopg

from bernlife.llm_gate import NO_CALL, day_of, is_failure
from bernlife.names import display_name, fold

KEPT_DAYS = 30
MARKER = re.compile(r"^[a-z0-9_]{1,32}$")
OTHER = "other"
# The last word of a company or group name: what it does, what it is, or its legal form.
GROUP_WORDS = frozenset(
    {"digital", "health", "medical", "photonics", "lab", "labs", "laboratory", "group"}
    | {"center", "centre", "zentrum", "institute", "institut", "foundation", "stiftung"}
    | {"technologies", "technology", "solutions", "systems", "software", "analytics"}
    | {"therapeutics", "diagnostics", "biotech", "pharma", "robotics", "devices", "medtech"}
    | {"partners", "consulting", "ventures", "capital", "network", "association", "verein"}
    | {"clinic", "klinik", "hospital", "spital", "university", "universitat", "universite"}
    | {"sciences", "engineering", "research", "team", "department", "office"}
    | {"ag", "gmbh", "ltd", "inc", "llc", "sa", "sarl", "plc", "kg", "co", "corp"}
)

PEOPLE = """
SELECT p.id, p.name, p.source_id, s.name, p.source_url
  FROM profile p
  JOIN source s ON s.id = p.source_id
 WHERE p.kind = 'person'
 ORDER BY p.id
"""


def company_shape(name: str) -> str | None:
    """Why `name` reads as a company or group, or None when it reads as a person's name."""
    words = display_name(name).split()
    if not words:
        return None
    return f"ends in {words[-1]}" if fold(words[-1]) in GROUP_WORDS else None


def flagged_people(conn: psycopg.Connection) -> tuple[list[dict[str, str]], int]:
    """The person profiles whose name reads as a company or group, by id, and how many person
    profiles were checked."""
    rows = conn.execute(PEOPLE).fetchall()
    people = []
    for profile_id, name, source_id, source_name, page_url in rows:
        reason = company_shape(name)
        if reason is not None:
            people.append(
                {
                    "id": profile_id,
                    "name": name,
                    "source_id": source_id,
                    "source_name": source_name,
                    "page_url": page_url,
                    "reason": reason,
                }
            )
    return people, len(rows)


@dataclass
class _Day:
    calls: int = 0
    by_role: Counter[str] = field(default_factory=Counter)
    by_outcome: Counter[str] = field(default_factory=Counter)
    failures: Counter[str] = field(default_factory=Counter)


def _marker(value: object) -> str:
    return value if isinstance(value, str) and MARKER.match(value) else OTHER


def _counts(counter: Counter[str]) -> dict[str, int]:
    return dict(sorted(counter.items()))


def activity_summary(
    records: Iterable[Mapping[str, Any]],
    today: date,
    budget: Mapping[str, int] | None,
    kept_days: int = KEPT_DAYS,
) -> dict[str, Any]:
    """The audit per UTC day, newest first, at most `kept_days`; a record without a readable
    time is left out. `budget` is what the router reports, the same object /api/health shows."""
    days: dict[date, _Day] = {}
    for record in records:
        day = day_of(record)
        if day is None:
            continue
        outcome = _marker(record.get("outcome"))
        entry = days.setdefault(day, _Day())
        entry.calls += 1
        entry.by_role[_marker(record.get("role"))] += 1
        entry.by_outcome[outcome] += 1
        if is_failure(outcome):
            entry.failures[outcome] += 1
    newest = sorted(days, reverse=True)[:kept_days]
    reached_model = days[today].by_outcome if today in days else Counter()
    return {
        "today": today.isoformat(),
        "live_today": sum(n for outcome, n in reached_model.items() if outcome not in NO_CALL),
        "budget": None if budget is None else {"limit": budget["limit"], "used": budget["used"]},
        "days": [
            {
                "day": day.isoformat(),
                "calls": days[day].calls,
                "by_role": _counts(days[day].by_role),
                "by_outcome": _counts(days[day].by_outcome),
                "failures": _counts(days[day].failures),
            }
            for day in newest
        ],
        "failures": _counts(sum((days[day].failures for day in newest), Counter())),
    }
