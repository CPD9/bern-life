"""`python -m bernlife health`: the model mode, the model id per role and the recorded calls.

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
