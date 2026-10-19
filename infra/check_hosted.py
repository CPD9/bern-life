"""Check that the hosted app answers from the installed bundle, not from the DEMO fixtures.

    python3 -m infra.check_hosted --url https://<site-host>

Run on the VM from /opt/bernlife after a deploy (infra/exoscale.md). /api/health has then
travelled through Caddy, the web app, the engine and the database. It passes only when it reports
replay mode, the version in bundle.lock, and the page and profile counts that the bundle's
manifest lists; the fixtures answer with mode mock and snapshot fixture, so they fail. When the
engine fails, the web app answers HTTP 502 with {"error": "engine_error"}; that body is read and
named, where infra.wait_ready only sees no answer.
"""

import argparse
import json
import sys
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import IO, Any

ROOT = Path(__file__).resolve().parents[1]


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
    except OSError:
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
    counts = body.get("counts")
    counts = counts if isinstance(counts, dict) else {}
    found = [
        ("mode", body.get("mode"), "replay"),
        ("snapshot", body.get("snapshot"), expected.version),
        ("pages", counts.get("pages"), expected.pages),
        ("profiles", counts.get("profiles"), expected.profiles),
    ]
    return [
        f"{name} is {actual!r}, expected {want!r}" for name, actual, want in found if actual != want
    ]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python3 -m infra.check_hosted")
    parser.add_argument("--url", required=True)
    parser.add_argument("--bundle", type=Path, default=ROOT / "data" / "bundle")
    args = parser.parse_args(argv)
    try:
        expected = expected_from(ROOT / "bundle.lock", args.bundle / "manifest.json")
    except (OSError, ValueError, KeyError, TypeError):
        print(f"No readable bundle.lock and {args.bundle}/manifest.json.", file=sys.stderr)
        return 1
    url = args.url.rstrip("/")
    found = problems(ask(url), expected)
    if found:
        print(f"{url} is not serving {expected.version}:", file=sys.stderr)
        print("\n".join(f"  {line}" for line in found), file=sys.stderr)
        return 1
    print(
        f"{url} serves {expected.version} in replay mode"
        f" ({expected.pages} pages, {expected.profiles} profiles)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
