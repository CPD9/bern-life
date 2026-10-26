"""Why it matches, without a model: the claim values that match, each cited by its pointer.

The reason lists the claims that share a content word with the query (matching.py): those sharing
it as written when there are any, else those sharing its word form. A result shown through a
project (`via`, via.py) has no such claim of its own, so its reason is the relation sentence,
"Works on <project>: <the project's matching claims>", citing those claims where the result
carries them (`/via/related_claims/<n>`). Search shows a profile with neither only when the query
names it or its own page says the topic next to its name; then the reason says who the profile
is, from its role, unit and first expertise, and still cites every value it shows. The text never
says more than the cited values.
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
RELATIONS = {"leads": "Leads", "works_on": "Works on", "member_of": "Member of"}
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


def relation_reason(via: Mapping[str, Any]) -> dict[str, object]:
    """The relation sentence of a result shown through a project, shortened to the claims that
    fit MAX_TEXT; the relation alone, citing the first claim, when none does."""
    head = f"{RELATIONS[via['kind']]} {via['related_name']}"
    values = [claim["value"] for claim in via["related_claims"][:MAX_CLAIMS]]
    while values and len(f"{head}: {', '.join(values)}") > MAX_TEXT:
        values.pop()
    return {
        "text": f"{head}: {', '.join(values)}" if values else head,
        "cites": [f"/via/related_claims/{index}" for index in range(max(1, len(values)))],
    }


def reason(
    question: Asked,
    profile: Profile,
    enrichment: Mapping[str, Sequence[str]] | None = None,
    via: Mapping[str, Any] | None = None,
) -> dict[str, object]:
    """Why the result matches: its matching claims, or with `via` (the record search builds with
    via.via_record) the relation sentence."""
    if via is not None:
        return relation_reason(via)
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
