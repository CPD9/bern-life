"""What the app does on screen after a reply; every action points at one of the turn's results.

By default the map shows the last results that found anything, a brief's results offer a match
report, and a reply naming exactly one person opens that profile. The model may ask for actions in
its JSON answer: one is kept only if it is among those the turn's results offer, compared as JSON
so that 1.0 or true is no result number, and is written as the contract spells it. A map the model
asks for replaces the default one, since the app shows one set of results at a time.
"""

import json
from collections.abc import Mapping, Sequence
from typing import Any

MAX_ACTIONS = 6

Action = dict[str, Any]


def actions(
    responses: Sequence[Mapping[str, Any]],
    made_by: Sequence[str],
    mentioned: Sequence[str],
    proposed: Sequence[object] = (),
) -> list[Action]:
    found = [i for i, response in enumerate(responses) if response["results"]]
    asked = {_key(action) for action in proposed}
    chosen = [action for action in offered(responses, made_by) if _key(action) in asked]
    planned = [action for action in chosen if action["type"] == "show_on_map"] or [
        {"type": "show_on_map", "result": i} for i in found[-1:]
    ]
    planned += [{"type": "start_match_report", "result": i} for i in found if made_by[i] == "brief"]
    if len(mentioned) == 1:
        planned.append({"type": "open_profile", "profile_id": mentioned[0]})
    planned += [action for action in chosen if action not in planned]
    return planned[:MAX_ACTIONS]


def offered(responses: Sequence[Mapping[str, Any]], made_by: Sequence[str]) -> list[Action]:
    """Every action the turn's results allow: the map of a search or brief that found something,
    the match report of such a brief, and the card of any profile they found."""
    found = [i for i, response in enumerate(responses) if response["results"]]
    ids = dict.fromkeys(item["profile"]["id"] for i in found for item in responses[i]["results"])
    return [
        *({"type": "show_on_map", "result": i} for i in found),
        *({"type": "start_match_report", "result": i} for i in found if made_by[i] == "brief"),
        *({"type": "open_profile", "profile_id": profile_id} for profile_id in ids),
    ]


def _key(action: object) -> str:
    return json.dumps(action, sort_keys=True)
