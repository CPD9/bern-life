"""The judge's path on a copy of the repo: `make fetch && make run`, one search, every step timed.

    python -m infra.clean_clone [--bundle <dir>] [--query <text>] [--web-port 3000] [--db-port 5434]

The copy holds exactly what `git add -A` would commit (tracked and untracked files, minus ignored
ones), so `.env`, `data/` and build output never reach it. It runs as its own compose project with
its own database, ports and volumes, and removes them afterwards. `--bundle` copies a local bundle
folder instead of fetching the release, for a run before a release exists.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = "bernlife-clean"
DEFAULT_QUERY = "diabetes technology"
# Settings a developer's shell may carry that would point the copy at their own data or database.
DROPPED_ENV = ("BERNLIFE_DATA_DIR", "BERNLIFE_BUNDLE_DIR", "DATABASE_URL", "COMPOSE_PROJECT_NAME")

Run = Callable[[Sequence[str], Path, Mapping[str, str]], int]
Search = Callable[[str, str], dict[str, object]]


@dataclass(frozen=True)
class Step:
    name: str
    seconds: float


def run_command(command: Sequence[str], cwd: Path, env: Mapping[str, str]) -> int:
    return subprocess.run(list(command), cwd=cwd, env=dict(env), check=False).returncode


def search_once(url: str, query: str) -> dict[str, object]:
    request = urllib.request.Request(
        f"{url}/api/search",
        data=json.dumps({"query": query}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def committable_files(repo: Path) -> list[str]:
    listed = subprocess.run(
        ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        cwd=repo,
        capture_output=True,
        check=True,
    ).stdout
    return sorted({name for name in listed.decode().split("\0") if (repo / name).is_file()})


def copy_files(repo: Path, names: Sequence[str], into: Path) -> None:
    for name in names:
        target = into / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(repo / name, target)


def clone_env(env: Mapping[str, str], web_port: int, db_port: int) -> dict[str, str]:
    kept = {key: value for key, value in env.items() if key not in DROPPED_ENV}
    return {
        **kept,
        "COMPOSE_PROJECT_NAME": PROJECT,
        "WEB_PORT": str(web_port),
        "DB_PORT": str(db_port),
    }


def report(steps: Sequence[Step], query: str, response: Mapping[str, object]) -> str:
    results = response.get("results")
    count = len(results) if isinstance(results, list) else 0
    lines = [f"{step.name:<7} {step.seconds:6.1f} s" for step in steps]
    total = sum(step.seconds for step in steps)
    lines.append(f"{'total':<7} {total:6.1f} s")
    abstained = response.get("abstained")
    lines.append(f"search  {count} results, abstained {abstained}, query {query!r}")
    return "\n".join(lines)


def judge_path(
    clone: Path,
    env: Mapping[str, str],
    web_port: int,
    query: str,
    fetch: bool,
    run: Run = run_command,
    search: Search = search_once,
    now: Callable[[], float] = time.monotonic,
) -> tuple[list[Step], dict[str, object]]:
    """fetch (unless the bundle is already in place), run, then one search through the web app."""
    steps = []
    commands = [("fetch", ["make", "fetch"])] if fetch else []
    commands.append(("run", ["make", "run"]))
    for name, command in commands:
        started = now()
        if run(command, clone, env) != 0:
            raise RuntimeError(f"make {name} failed in the clean copy")
        steps.append(Step(name, now() - started))
    started = now()
    response = search(f"http://127.0.0.1:{web_port}", query)
    steps.append(Step("search", now() - started))
    return steps, response


def tear_down(clone: Path, env: Mapping[str, str], run: Run = run_command) -> None:
    run(["docker", "compose", "--profile", "run", "down", "--volumes"], clone, env)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m infra.clean_clone")
    parser.add_argument("--bundle", type=Path, help="a local bundle folder instead of make fetch")
    parser.add_argument("--query", default=DEFAULT_QUERY)
    parser.add_argument("--web-port", type=int, default=3000)
    parser.add_argument("--db-port", type=int, default=5434)
    parser.add_argument("--keep", action="store_true", help="leave the copy and its services up")
    args = parser.parse_args(argv)
    clone = Path(tempfile.mkdtemp(prefix="bernlife-clean-"))
    env = clone_env(os.environ, args.web_port, args.db_port)
    try:
        copy_files(ROOT, committable_files(ROOT), clone)
        if args.bundle:
            shutil.copytree(args.bundle, clone / "data" / "bundle")
        fetch = args.bundle is None
        steps, response = judge_path(clone, env, args.web_port, args.query, fetch)
    except (RuntimeError, OSError, ValueError) as error:
        print(f"clean clone: {error}", file=sys.stderr)
        return 1
    finally:
        if args.keep:
            print(f"clean clone kept in {clone} (compose project {PROJECT})", file=sys.stderr)
        else:
            tear_down(clone, env)
            shutil.rmtree(clone, ignore_errors=True)
    print(report(steps, args.query, response))
    return 0


if __name__ == "__main__":
    sys.exit(main())
