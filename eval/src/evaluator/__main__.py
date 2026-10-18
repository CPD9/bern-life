"""`python -m evaluator`: score a predictions file against the frozen gold set.

Separate code from the search: nothing here imports the engine, so a bug in ranking cannot hide
in the scoring. Writes metrics.json and the blind labelling sheet to --out and prints the report.
"""

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

from .coverage import completeness, exposure
from .load import LoadError, load_gold, load_predictions, load_records
from .report import markdown
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
    return parser.parse_args(argv)


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


def main(argv: list[str] | None = None) -> int:
    args = arguments(argv)
    try:
        gold = load_gold(args.gold)
        responses = load_predictions(args.predictions, gold)
        pages = load_records(args.pages, "page.schema.json", "url") if args.pages else None
        profiles = (
            load_records(args.profiles, "profile.schema.json", "id") if args.profiles else None
        )
    except LoadError as error:
        print(f"eval: {error}", file=sys.stderr)
        return 2
    results = score_all(gold, responses, pages, profiles)
    slices = by_slice(results)
    metrics = {
        "inputs": {key: str(value) for key, value in vars(args).items() if value is not None},
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
    print(markdown(metrics), end="")
    return 0


if __name__ == "__main__":
    sys.exit(main())
