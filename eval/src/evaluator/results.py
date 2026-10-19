"""The headline numbers of one bundle, kept in git at eval/results/<bundle version>/metrics.json.

The file carries the bundle's version, so it is written only for a run on that bundle's own
predictions, pages and profiles: numbers from any other predictions would be mislabelled. The
version names a folder and comes from a downloaded manifest, so it must be a plain name. Floats
are rounded to four decimals, not to the printed table's two, so whoever shows them picks the
precision.
"""

import json
import re
from collections.abc import Mapping
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .load import LoadError

DECIMALS = 4
PLAIN_VERSION = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*")

Metrics = Mapping[str, Any]


def bundle_version(predictions: Path, pages: Path | None, profiles: Path | None) -> str | None:
    """The version in the manifest.json beside all three inputs; None for any other run, such as
    the invented fixture, which has no manifest."""
    if pages is None or profiles is None:
        return None
    folders = {path.expanduser().resolve().parent for path in (predictions, pages, profiles)}
    if len(folders) != 1:
        return None
    manifest = folders.pop() / "manifest.json"
    if not manifest.is_file():
        return None
    try:
        version = json.loads(manifest.read_text(encoding="utf-8"))["version"]
    except (ValueError, KeyError, TypeError):
        raise LoadError(f"{manifest}: no bundle version") from None
    if not isinstance(version, str) or not PLAIN_VERSION.fullmatch(version):
        raise LoadError(f"{manifest}: the bundle version is not a plain folder name")
    return version


def rounded(value: float) -> float:
    return round(value, DECIMALS)


def count(share: Metrics) -> dict[str, int]:
    return {"n": share["k"], "of": share["n"]}


def slice_name(name: str) -> str:
    """`source:unibe` → `unibe`; sources, languages and variants share no name."""
    return name.split(":", 1)[1]


def headline(
    snapshot: str, generated_at: datetime, slices: Mapping[str, Metrics]
) -> dict[str, object]:
    """Pooled numbers and recall@10 per slice; a slice with no recall to measure (the invented
    queries) is left out rather than written as 0."""
    pooled = slices["pooled"]
    recall = pooled["recall_at_10"]
    low, high = recall["ci"]
    return {
        "snapshot": snapshot,
        "generated_at": generated_at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "eval": {
            "queries": pooled["queries"],
            "recall_at_10": {
                "value": rounded(recall["value"]),
                "low": rounded(low),
                "high": rounded(high),
            },
            "mrr": rounded(pooled["mrr"]["value"]),
            "invented_abstained": count(pooled["invented_abstained"]),
            "false_abstention": count(pooled["false_abstention"]),
            "traceable": count(pooled["traceable_claims"]),
            "invented_entities": pooled["invented_entities"],
            "slices": [
                {"name": slice_name(name), "recall_at_10": rounded(s["recall_at_10"]["value"])}
                for name, s in slices.items()
                if name != "pooled" and s["recall_at_10"] is not None
            ],
        },
    }


def write_headline(results_dir: Path, numbers: Metrics) -> None:
    path = results_dir / numbers["snapshot"] / "metrics.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(numbers, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
