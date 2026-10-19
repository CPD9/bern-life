"""`python -m bernlife health`: the model mode, the model id per role and the recorded calls; and
the status that GET /api/health adds to the served snapshot's counts.

It names models, never endpoints or keys, so its output is safe to paste into a PR or a report.
"""

import json
import os
import sys
from collections.abc import Mapping, Sequence

from . import config, paths
from .cache import CacheMiss, cache_roots, count_entries
from .llm import connect
from .llm_http import ModelUnavailable, Transport, urlopen_transport


def report(env: Mapping[str, str], transport: Transport) -> dict[str, object]:
    llm = connect(env, transport)
    roots = cache_roots(paths.data_dir(env))
    return {"mode": llm.backend, "models": llm.models(), "cache": count_entries(roots)}


def service_health(
    base: Mapping[str, object],
    uptime_s: int,
    failures: Mapping[str, Mapping[str, int]],
    budget: Mapping[str, int] | None,
) -> dict[str, object]:
    """Degraded while a model call failed in the last hour, or while a live engine has used up
    today's calls. Only a live router has a budget to show."""
    spent = base["mode"] == "live" and budget is not None and budget["used"] >= budget["limit"]
    failed = {role: dict(markers) for role, markers in failures.items() if markers}
    health = {
        **base,
        "status": "degraded" if failed or spent else "ok",
        "uptime_s": uptime_s,
        "failures_last_hour": failed,
    }
    if budget is not None:
        health["budget"] = {"limit": budget["limit"], "used": budget["used"]}
    return health


def main(
    argv: Sequence[str],
    env: Mapping[str, str] = os.environ,
    transport: Transport = urlopen_transport,
) -> int:
    if argv:
        print("usage: python -m bernlife health", file=sys.stderr)
        return 2
    try:
        summary = report(env, transport)
    except (ModelUnavailable, CacheMiss, config.ConfigError) as error:
        print(f"health: {error}", file=sys.stderr)
        return 1
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0
