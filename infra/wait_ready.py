"""Wait until the web app answers with a loaded snapshot, then print one line with its URL.

    python -m infra.wait_ready [--url http://127.0.0.1:3000] [--timeout 300]

Ready means the web app's /api/health parses and names a snapshot: that answer has travelled
through the web app, the engine and the database, so a judge can open the URL and search.
"""

import argparse
import json
import sys
import time
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass

DEFAULT_URL = "http://127.0.0.1:3000"
POLL_SECONDS = 2.0

Probe = Callable[[str], dict[str, object] | None]


@dataclass(frozen=True)
class Clock:
    now: Callable[[], float] = time.monotonic
    sleep: Callable[[float], None] = time.sleep


SYSTEM_CLOCK = Clock()


def health(url: str) -> dict[str, object] | None:
    try:
        with urllib.request.urlopen(f"{url}/api/health", timeout=5) as response:
            body = json.load(response)
    except (OSError, ValueError):
        return None
    return body if isinstance(body, dict) else None


def ready_line(url: str, body: dict[str, object]) -> str | None:
    snapshot = body.get("snapshot")
    counts = body.get("counts")
    if not isinstance(snapshot, str) or snapshot == "none" or not isinstance(counts, dict):
        return None
    return f"Bern Life is ready on {url} (snapshot {snapshot}, {counts.get('profiles')} profiles)"


def wait(
    url: str, timeout: float, probe: Probe = health, clock: Clock = SYSTEM_CLOCK
) -> str | None:
    deadline = clock.now() + timeout
    while True:
        body = probe(url)
        line = ready_line(url, body) if body is not None else None
        if line is not None or clock.now() >= deadline:
            return line
        clock.sleep(POLL_SECONDS)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m infra.wait_ready")
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--timeout", type=float, default=300.0)
    args = parser.parse_args(argv)
    line = wait(args.url.rstrip("/"), args.timeout)
    if line is None:
        print(
            f"Bern Life did not answer on {args.url} within {args.timeout:.0f} s;"
            " see docker compose --profile run logs",
            file=sys.stderr,
        )
        return 1
    print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
