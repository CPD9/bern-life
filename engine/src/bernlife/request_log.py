"""One JSON line per API request: the route, the outcome, the time, and what the model cache did.

A request names its route by template and its input by length and a keyed hash prefix only:
repeats of one question within one serve run can be matched in the log, while the log holds no
question, message or profile handle that a person typed or looked up. The key is a secret the
process draws at start, so a guessed text, such as a profile's name, cannot be tested against it.
"""

import hmac
import json
import secrets
from typing import Protocol

PROCESS_KEY = secrets.token_bytes(16)


class Tally(Protocol):
    """The model calls one request made, by how each was answered."""

    hits: int
    misses: int
    live: int
    failures: int


def new_request_id() -> str:
    return secrets.token_hex(4)


def fingerprint(text: str, key: bytes = PROCESS_KEY) -> dict[str, object]:
    digest = hmac.new(key, text.encode("utf-8"), "sha256").hexdigest()
    return {"chars": len(text), "sha256": digest[:12]}


def access_line(
    *,
    request_id: str,
    route: str,
    method: str,
    status: int,
    ms: int,
    mode: str,
    live_allowed: bool,
    tally: Tally,
    text: str | None,
) -> str:
    line: dict[str, object] = {
        "id": request_id,
        "route": route,
        "method": method,
        "status": status,
        "ms": ms,
        "mode": mode,
        "live_allowed": live_allowed,
        "cache": {
            "hits": tally.hits,
            "misses": tally.misses,
            "live": tally.live,
            "failures": tally.failures,
        },
    }
    if text is not None:
        line["input"] = fingerprint(text)
    return json.dumps(line)
