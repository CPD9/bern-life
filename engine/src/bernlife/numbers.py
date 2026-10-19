"""What GET /api/numbers reports: the committed evaluation of the loaded snapshot and the model
calls recorded in its bundle.

The cache pack holds answered calls only (a failure is never cached), so `ok` equals `calls` here
and failures show in health's `failures_last_hour`. The pack changes only with a new bundle, which
takes a new serve, so its numbers are worked out once per process.
"""

import json
import math
import re
from collections.abc import Iterable, Mapping
from datetime import datetime
from functools import cache
from pathlib import Path
from typing import Any

from bernlife import paths
from bernlife.cache import packed
from bernlife.profiles_db import timestamp

# The version comes from the bundle's manifest, which is data: it names a folder only if it is
# one plain path segment.
SNAPSHOT_FOLDER = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*")


def results_dir() -> Path:
    return paths.repo_root() / "eval" / "results"


def nearest_rank(ordered: list[int], percent: int) -> int:
    return ordered[math.ceil(percent * len(ordered) / 100) - 1]


def model_use(entries: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Calls per role and model, with the median and p95 latency by nearest rank."""
    latencies: dict[tuple[str, str], list[int]] = {}
    for entry in entries:
        latencies.setdefault((entry["role"], entry["model"]), []).append(entry["latency_ms"])
    rows = []
    for (role, model), values in sorted(latencies.items()):
        ordered = sorted(values)
        rows.append(
            {
                "role": role,
                "model": model,
                "calls": len(ordered),
                "ok": len(ordered),
                "median_ms": nearest_rank(ordered, 50),
                "p95_ms": nearest_rank(ordered, 95),
            }
        )
    return rows


@cache
def recorded_use(root: Path) -> tuple[dict[str, Any], ...]:
    return tuple(model_use(packed(root).values()))


def committed_eval(results: Path, snapshot: str) -> dict[str, Any] | None:
    if not SNAPSHOT_FOLDER.fullmatch(snapshot):
        return None
    try:
        text = (results / snapshot / "metrics.json").read_text(encoding="utf-8")
    except FileNotFoundError:
        return None
    return json.loads(text)["eval"]


def numbers_report(snapshot: str, now: datetime, recorded: Path, results: Path) -> dict[str, Any]:
    return {
        "snapshot": snapshot,
        "generated_at": timestamp(now),
        "eval": committed_eval(results, snapshot),
        "models": list(recorded_use(recorded)),
    }
