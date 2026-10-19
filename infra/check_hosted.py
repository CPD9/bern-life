"""Check that the hosted app answers from the installed bundle, not from the DEMO fixtures.

    python3 -m infra.check_hosted --url https://<site-host>
    python3 -m infra.check_hosted --url https://<site-host> --watch --interval 30 --max-failures 3

Run on the VM from /opt/bernlife after a deploy (infra/exoscale.md). /api/health has then
travelled through Caddy, the web app, the engine and the database. It passes only when it reports
replay or live mode, the version in bundle.lock, and the page and profile counts that the bundle's
manifest lists; the fixtures answer with mode mock and snapshot fixture, so they fail. When the
engine fails, the web app answers HTTP 502 with {"error": "engine_error"}; that body is read and
named, where infra.wait_ready only sees no answer.

--watch repeats the same check as an uptime loop, one line per check, and exits 1 after
--max-failures failed checks in a row. A degraded status is shown, not counted as a failure: the
app still answers from the bundle.
"""

import argparse
import http.client
import json
import re
import sys
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from functools import partial
from pathlib import Path
from typing import IO, Any

ROOT = Path(__file__).resolve().parents[1]
SERVING_MODES = ("replay", "live")
# Only plain words from the answer reach a terminal line; anything else shows as "-".
PLAIN_WORD = re.compile(r"[a-z]+")


@dataclass(frozen=True)
class Expected:
    version: str
    pages: int
    profiles: int


def expected_from(lock_path: Path, manifest_path: Path) -> Expected:
    lock = json.loads(lock_path.read_text())
    files = json.loads(manifest_path.read_text())["files"]
    return Expected(
        lock["version"], files["pages.jsonl"]["lines"], files["profiles.jsonl"]["lines"]
    )


@dataclass(frozen=True)
class Answer:
    status: int | None  # None: no HTTP answer at all
    body: dict[str, object] | None  # None: not a JSON object


# urlopen's answer: a response with .status that reads and closes like a file. It raises
# HTTPError, which carries the status and the body, for anything but a success.
Open = Callable[[str], Any]


def open_health(url: str) -> Any:
    return urllib.request.urlopen(f"{url}/api/health", timeout=5)


def json_object(response: IO[bytes]) -> dict[str, object] | None:
    try:
        body = json.load(response)
    except ValueError:
        return None
    return body if isinstance(body, dict) else None


def ask(url: str, open_url: Open = open_health) -> Answer:
    """The status and JSON body of /api/health, an error status included."""
    try:
        with open_url(url) as response:
            return Answer(response.status, json_object(response))
    except urllib.error.HTTPError as err:
        with err:
            return Answer(err.code, json_object(err))
    # A connection cut mid-answer raises an HTTPException, not an OSError; --watch must outlive it.
    except (OSError, http.client.HTTPException):
        return Answer(None, None)


def problems(answer: Answer, expected: Expected) -> list[str]:
    body = answer.body
    if answer.status is None:
        return ["/api/health did not answer"]
    if answer.status != 200:
        error = body.get("error") if body is not None else None
        return [f"/api/health answered HTTP {answer.status} with error {error!r}"]
    if body is None:
        return ["/api/health did not answer with JSON"]
    mode = body.get("mode")
    wrong_mode = [] if mode in SERVING_MODES else [f"mode is {mode!r}, expected 'replay' or 'live'"]
    counts = body.get("counts")
    counts = counts if isinstance(counts, dict) else {}
    found = [
        ("snapshot", body.get("snapshot"), expected.version),
        ("pages", counts.get("pages"), expected.pages),
        ("profiles", counts.get("profiles"), expected.profiles),
    ]
    return wrong_mode + [
        f"{name} is {actual!r}, expected {want!r}" for name, actual, want in found if actual != want
    ]


def shown(value: object) -> str:
    return value if isinstance(value, str) and PLAIN_WORD.fullmatch(value) else "-"


def number(value: object) -> float | None:
    return float(value) if isinstance(value, int | float) and not isinstance(value, bool) else None


def runtime(body: dict[str, object]) -> list[str]:
    """Status, uptime and recent failures, for an engine whose health reports them."""
    notes: list[str] = []
    if (status := shown(body.get("status"))) != "-":
        notes.append(f"status {status}")
    if (uptime := number(body.get("uptime_s"))) is not None:
        notes.append(f"up {uptime:.0f} s")
    if (failures := number(body.get("failures_last_hour"))) is not None:
        notes.append(f"{failures:.0f} failures in the last hour")
    return notes


def serving_line(url: str, expected: Expected, body: dict[str, object]) -> str:
    line = (
        f"{url} serves {expected.version} in {shown(body.get('mode'))} mode"
        f" ({expected.pages} pages, {expected.profiles} profiles)"
    )
    notes = runtime(body)
    return f"{line}; {', '.join(notes)}" if notes else line


@dataclass(frozen=True)
class Clock:
    wall: Callable[[], datetime] = partial(datetime.now, UTC)
    monotonic: Callable[[], float] = time.monotonic
    sleep: Callable[[float], None] = time.sleep


@dataclass(frozen=True)
class Watch:
    interval: float
    max_failures: int


def watch_line(when: datetime, answer: Answer, seconds: float, found: list[str]) -> str:
    body = answer.body or {}
    fields = [
        when.strftime("%Y-%m-%dT%H:%M:%SZ"),
        f"http={'-' if answer.status is None else answer.status}",
        f"mode={shown(body.get('mode'))}",
        f"status={shown(body.get('status'))}",
        f"{seconds * 1000:.0f}ms",
    ]
    if found:
        fields.append(f"failed: {'; '.join(found)}")
    return " ".join(fields)


def watch_until_down(
    url: str,
    expected: Expected,
    watch: Watch,
    ask_url: Callable[[str], Answer],
    clock: Clock,
    emit: Callable[[str], None],
) -> None:
    """Check every interval seconds, one line each; return once max_failures fail in a row."""
    in_a_row = 0
    while True:
        when, started = clock.wall(), clock.monotonic()
        answer = ask_url(url)
        seconds = clock.monotonic() - started
        found = problems(answer, expected)
        in_a_row = in_a_row + 1 if found else 0
        emit(watch_line(when, answer, seconds, found))
        if in_a_row == watch.max_failures:
            return
        clock.sleep(max(0.0, watch.interval - seconds))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python3 -m infra.check_hosted")
    parser.add_argument("--url", required=True)
    parser.add_argument("--bundle", type=Path, default=ROOT / "data" / "bundle")
    parser.add_argument("--watch", action="store_true", help="check again until it keeps failing")
    parser.add_argument("--interval", type=float, default=30.0, help="seconds, with --watch")
    parser.add_argument("--max-failures", type=int, default=3, help="in a row, with --watch")
    args = parser.parse_args(argv)
    if args.interval <= 0 or args.max_failures < 1:
        parser.error("--interval must be above 0 and --max-failures at least 1")
    try:
        expected = expected_from(ROOT / "bundle.lock", args.bundle / "manifest.json")
    except (OSError, ValueError, KeyError, TypeError):
        print(f"No readable bundle.lock and {args.bundle}/manifest.json.", file=sys.stderr)
        return 1
    url = args.url.rstrip("/")
    if args.watch:
        watch = Watch(args.interval, args.max_failures)
        watch_until_down(url, expected, watch, ask, Clock(), partial(print, flush=True))
        print(f"{url} failed {watch.max_failures} checks in a row.", file=sys.stderr)
        return 1
    answer = ask(url)
    found = problems(answer, expected)
    if found:
        print(f"{url} is not serving {expected.version}:", file=sys.stderr)
        print("\n".join(f"  {line}" for line in found), file=sys.stderr)
        return 1
    print(serving_line(url, expected, answer.body or {}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
