"""One JSON object out of a chat reply, with a single repair round.

Adapted from CPD9/apertus-redteam-graph, track_1a/src/redteam/llm_json.py (Apache-2.0). A reply
that stays unparsable after the repair is the `bad_json` marker, like any other model failure.
"""

import json
import re
from typing import Any

from .llm import Chat
from .llm_http import ModelUnavailable

REPAIR = (
    "That was not valid JSON. Reply again with the same content as one valid JSON object, "
    "nothing else. Keep it short."
)


def parse_json(text: str) -> dict[str, Any]:
    """The first JSON object in a reply; models often wrap it in prose or code fences."""
    match = re.search(r"\{.*\}", text, re.S)
    if match is None:
        raise ValueError("no JSON object in reply")
    return json.loads(match.group(0))


def lenient_json(*replies: str) -> dict[str, Any]:
    """Accept raw newlines inside strings and trailing text after the object."""
    decoder = json.JSONDecoder(strict=False)
    for text in replies:
        start = text.find("{")
        if start != -1:
            try:
                return decoder.raw_decode(text, start)[0]
            except ValueError:
                continue
    raise ValueError("no parseable JSON object in reply")


def ask_json(
    llm: Chat, message: str, *, role: str, prompt_version: str, max_tokens: int = 1500
) -> dict[str, Any]:
    """One call, plus one repair round if the model's JSON is broken or cut off."""
    messages = [{"role": "user", "content": message}]
    reply = llm.chat(messages, role=role, prompt_version=prompt_version, max_tokens=max_tokens)
    try:
        return parse_json(reply)
    except ValueError:
        pass
    retry = [
        *messages,
        {"role": "assistant", "content": reply},
        {"role": "user", "content": REPAIR},
    ]
    repaired = llm.chat(retry, role=role, prompt_version=prompt_version, max_tokens=max_tokens)
    try:
        return parse_json(repaired)
    except ValueError:
        pass
    try:
        # Last resort only, so replies that parsed before keep their path and replay stays exact.
        return lenient_json(repaired, reply)
    except ValueError:
        pass
    raise ModelUnavailable("bad_json")
