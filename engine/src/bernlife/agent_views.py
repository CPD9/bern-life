"""What the Navigator agent's model reads of a tool's answer, and the summary that stands in for a
reply that cannot be kept.

Both hold only verified claims with their evidence on the page: a result's name, the claims its
reason cites, the claims of the project a result is shown through, and on a profile call all of
that profile's claims. The summary names no one the results do not show.
"""

from collections.abc import Mapping, Sequence
from typing import Any

from bernlife.explain import claim_at

SHOWN_TO_MODEL = 5
SUMMARY_RESULTS = 4
MAX_FACTS = 3
MAX_LINE = 180
NO_SOURCE_REPLY = "I found no verifiable source for that."
SUMMARY_HEAD = "Here is what the sources show:"


def summary(responses: Sequence[Mapping[str, Any]]) -> str:
    """The first results, each with the claims its reason cites; only names the results show."""
    lines: dict[str, str] = {}
    for response in responses:
        for item in response["results"]:
            lines.setdefault(item["profile"]["id"], _summary_line(item))
    if not lines:
        return NO_SOURCE_REPLY
    return "\n".join([SUMMARY_HEAD, *list(lines.values())[:SUMMARY_RESULTS]])


def results_view(response: Mapping[str, Any]) -> list[dict[str, Any]]:
    """What the model reads of a search: the top results, each with the claims its reason cites."""
    return [_result_view(item) for item in response["results"][:SHOWN_TO_MODEL]]


def profile_view(profile: Mapping[str, Any]) -> dict[str, Any]:
    facts = {field: [c["value"] for c in claims] for field, claims in profile["fields"].items()}
    return {
        "id": profile["id"],
        "kind": profile["kind"],
        "name": profile["name"]["value"],
        "source": profile["source_id"],
        "facts": {field: values for field, values in facts.items() if values},
    }


def _cited_facts(item: Mapping[str, Any]) -> list[str]:
    profile = item["profile"]
    claims = [
        claim_at(profile, pointer) for pointer in item["reason"]["cites"] if pointer != "/name"
    ]
    return [claim["value"] for claim in claims if claim is not None]


def _result_view(item: Mapping[str, Any]) -> dict[str, Any]:
    profile = item["profile"]
    view = {
        "id": profile["id"],
        "kind": profile["kind"],
        "name": profile["name"]["value"],
        "source": profile["source_id"],
        "facts": _cited_facts(item),
    }
    if "via" in item:
        via = item["via"]
        view["through"] = {
            "id": via["related_profile_id"],
            "name": via["related_name"],
            "facts": [claim["value"] for claim in via["related_claims"]],
        }
    return view


def _summary_line(item: Mapping[str, Any]) -> str:
    name, facts = item["profile"]["name"]["value"], _cited_facts(item)
    if "via" in item:
        name = f"{name}, through {item['via']['related_name']}"
        facts = [claim["value"] for claim in item["via"]["related_claims"]]
    line = f"- {name}: {'; '.join(facts[:MAX_FACTS])}" if facts else f"- {name}"
    return line if len(line) <= MAX_LINE else line[: MAX_LINE - 1] + "…"
