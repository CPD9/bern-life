"""`python -m evaluator`: score a predictions file against the frozen gold set.

Separate code from the search: nothing here imports the engine, so a bug in ranking cannot hide
in the scoring. Writes metrics.json and the blind labelling sheet to --out and prints the report.
A run on one bundle's own files also writes its headline numbers to
--results-dir/<bundle version>/metrics.json, which is kept in git.
"""

import argparse
import hashlib
import json
import sys
from collections.abc import Callable
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path

from .coverage import completeness, exposure
from .load import LoadError, load_gold, load_predictions, load_records
from .report import markdown
from .results import bundle_version, headline, write_headline
from .score import QueryResult, score_all
from .sheet import stratified, write_sheet
from .summary import by_slice, decisions, variant_agreement


def arguments(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="python -m evaluator")
    parser.add_argument("--gold", type=Path, default=Path("eval/gold.jsonl"))
    parser.add_argument("--predictions", type=Path, required=True)
    parser.add_argument("--pages", type=Path, help="snapshot pages.jsonl, for traceability")
    parser.add_argument(
        "--profiles", type=Path, help="snapshot profiles.jsonl, for invented entities"
    )
    parser.add_argument("--out", type=Path, default=Path("eval/out"))
    parser.add_argument(
        "--results-dir",
        type=Path,
        default=Path("eval/results"),
        help="headline numbers per bundle version, for a run on one bundle's own files",
    )
    return parser.parse_args(argv)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def input_hashes(args: argparse.Namespace) -> dict[str, str]:
    """The sha256 of every file scored, so the numbers can be tied to one bundle's files."""
    files = {"gold": args.gold, "predictions": args.predictions}
    files |= {"pages": args.pages, "profiles": args.profiles}
    return {key: file_sha256(path) for key, path in files.items() if path is not None}


def per_query(result: QueryResult) -> dict[str, object]:
    return {
        "id": result.gold.id,
        "variant": result.gold.variant,
        "lang": result.gold.lang,
        "abstained": result.abstained,
        "recall_at_10": result.recall,
        "reciprocal_rank": result.reciprocal_rank,
        "url_only_hits": result.url_only_hits,
        "claims": result.claims,
        "untraceable": len(result.misses),
        "invented_entities": None if result.invented is None else list(result.invented),
    }


def utc_now() -> datetime:
    return datetime.now(UTC)


def main(argv: list[str] | None = None, clock: Callable[[], datetime] = utc_now) -> int:
    args = arguments(argv)
    try:
        gold = load_gold(args.gold)
        responses = load_predictions(args.predictions, gold)
        pages = load_records(args.pages, "page.schema.json", "url") if args.pages else None
        profiles = (
            load_records(args.profiles, "profile.schema.json", "id") if args.profiles else None
        )
        snapshot = bundle_version(args.predictions, args.pages, args.profiles)
    except LoadError as error:
        print(f"eval: {error}", file=sys.stderr)
        return 2
    results = score_all(gold, responses, pages, profiles)
    slices = by_slice(results)
    metrics = {
        "inputs": {key: str(value) for key, value in vars(args).items() if value is not None},
        "input_sha256": input_hashes(args),
        "slices": slices,
        "variant_agreement": variant_agreement(results),
        "exposure": exposure(results, profiles, pages),
        "completeness": completeness(results),
        "decisions": decisions(slices["pooled"], results),
        "url_only_hits": sum(result.url_only_hits for result in results),
        "untraceable": None if pages is None else [asdict(m) for r in results for m in r.misses],
        "per_query": [per_query(result) for result in results],
    }
    args.out.mkdir(parents=True, exist_ok=True)
    metrics_text = json.dumps(metrics, indent=2, ensure_ascii=False, sort_keys=True) + "\n"
    (args.out / "metrics.json").write_text(metrics_text, encoding="utf-8")
    write_sheet(
        stratified(results), args.out / "labelling_sheet.csv", args.out / "labelling_key.json"
    )
    if snapshot is not None:
        write_headline(args.results_dir, headline(snapshot, clock(), slices))
    print(markdown(metrics), end="")
    return 0


if __name__ == "__main__":
    sys.exit(main())
