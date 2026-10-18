"""Why it matches, without a model: the profile's claim values, each cited by its pointer.

A claim counts as matched when its value shares a word with the query. When none does (a match
on meaning only), the reason says who the profile is instead, from its role, unit and first
expertise, and still cites every value it shows. The text never says more than the cited values.
"""

import re
from collections.abc import Mapping
from typing import Any

from bernlife.names import fold

Profile = Mapping[str, Any]
ORDER = ("expertise", "projects", "infrastructure", "services", "role", "unit")
LABELS = {
    "expertise": "Expertise",
    "projects": "Projects",
    "infrastructure": "Infrastructure",
    "services": "Services",
    "role": "Role",
    "unit": "Unit",
}
FALLBACK = (("role", 0), ("unit", 0), ("expertise", 0))
MAX_CLAIMS = 4
MAX_TEXT = 400
WORD = re.compile(r"[a-z]{3,}")


def words(text: str) -> set[str]:
    return set(WORD.findall(fold(text)))


def matched_claims(query: str, profile: Profile) -> list[tuple[str, int]]:
    wanted = words(query)
    return [
        (field, index)
        for field in ORDER
        for index, claim in enumerate(profile["fields"][field])
        if words(claim["value"]) & wanted
    ]


def describing_claims(profile: Profile) -> list[tuple[str, int]]:
    return [(field, index) for field, index in FALLBACK if len(profile["fields"][field]) > index]


def render(profile: Profile, chosen: list[tuple[str, int]]) -> str:
    groups: dict[str, list[str]] = {}
    for field, index in chosen:
        groups.setdefault(field, []).append(profile["fields"][field][index]["value"])
    return "; ".join(f"{LABELS[field]}: {', '.join(values)}" for field, values in groups.items())


def reason(query: str, profile: Profile) -> dict[str, object]:
    chosen = (matched_claims(query, profile) or describing_claims(profile))[:MAX_CLAIMS]
    while chosen and len(render(profile, chosen)) > MAX_TEXT:
        chosen = chosen[:-1]
    if not chosen:
        return {"text": f"Name: {profile['name']['value']}", "cites": ["/name"]}
    return {
        "text": render(profile, chosen),
        "cites": [f"/fields/{field}/{index}" for field, index in chosen],
    }
