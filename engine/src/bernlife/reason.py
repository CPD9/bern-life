"""Why it matches, without a model: the profile's claim values, each cited by its pointer.

The reason lists the claims that share a content word with the query (matching.py): those sharing
it as written when there are any, else those sharing its word form. Search shows a profile
without such a claim only when the query names it; then the reason says who the profile is, from
its role, unit and first expertise, and still cites every value it shows. The text never says
more than the cited values.
"""

from collections.abc import Mapping, Sequence
from typing import Any

from bernlife.matching import Asked, matched_claims

Profile = Mapping[str, Any]
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


def describing_claims(profile: Profile) -> list[tuple[str, int]]:
    return [(field, index) for field, index in FALLBACK if len(profile["fields"][field]) > index]


def render(profile: Profile, chosen: list[tuple[str, int]]) -> str:
    groups: dict[str, list[str]] = {}
    for field, index in chosen:
        groups.setdefault(field, []).append(profile["fields"][field][index]["value"])
    return "; ".join(f"{LABELS[field]}: {', '.join(values)}" for field, values in groups.items())


def reason(
    question: Asked, profile: Profile, enrichment: Mapping[str, Sequence[str]] | None = None
) -> dict[str, object]:
    matched = matched_claims(question, profile, enrichment, exact=True) or matched_claims(
        question, profile, enrichment
    )
    chosen = (matched or describing_claims(profile))[:MAX_CLAIMS]
    while chosen and len(render(profile, chosen)) > MAX_TEXT:
        chosen = chosen[:-1]
    if not chosen:
        return {"text": f"Name: {profile['name']['value']}", "cites": ["/name"]}
    return {
        "text": render(profile, chosen),
        "cites": [f"/fields/{field}/{index}" for field, index in chosen],
    }
