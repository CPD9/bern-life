"""What the app does on screen after a reply; every action points at one of the turn's results.

By default the map shows the last results that found anything, a brief's results offer a match
report, and a reply naming exactly one person opens that profile. The model may ask for actions in
its JSON answer: one is kept only if it is among those the turn's results offer, compared as JSON
so that 1.0 or true is no result number, and is written as the contract spells it. The app runs
the actions in order and shows one set of results and one card at a time, so the last map the
model asks for replaces the default one, and a card it asks for is kept only when the reply names
no single person: otherwise it could open over the card of the one the reply is about.
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
    chosen = _chosen(proposed, offered(responses, made_by))
    maps = [action for action in chosen if action["type"] == "show_on_map"]
    planned = maps[-1:] or [{"type": "show_on_map", "result": i} for i in found[-1:]]
    planned += [{"type": "start_match_report", "result": i} for i in found if made_by[i] == "brief"]
    if len(mentioned) == 1:
        planned.append({"type": "open_profile", "profile_id": mentioned[0]})
    else:
        planned += [action for action in chosen if action["type"] == "open_profile"]
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


def _chosen(proposed: Sequence[object], offers: Sequence[Action]) -> list[Action]:
    """The offered actions the model asked for, each once, in the order it asked."""
    by_key = {_key(action): action for action in offers}
    return [by_key[key] for key in dict.fromkeys(map(_key, proposed)) if key in by_key]


def _key(action: object) -> str:
    return json.dumps(action, sort_keys=True)
