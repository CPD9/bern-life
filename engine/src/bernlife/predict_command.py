"""`python -m bernlife predict`: every gold query through the same search the API serves.

The output is what the evaluator scores, one `{"id", "response"}` per gold id, sorted by id. Only
the query text goes in: the gold `sources` say where the answer lives, so filtering on them would
hand search the answer. Latency per query is printed, not stored, so the file stays reproducible.
"""

import argparse
import json
import os
import statistics
import sys
import time
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path
from typing import Any

from bernlife import config, paths
from bernlife.database import connect
from bernlife.embed import e5_embedder
from bernlife.jsonl import read_jsonl, write_atomic
from bernlife.llm import connect as connect_model
from bernlife.search import search
from bernlife.store import PostgresStore

Search = Callable[[str], dict[str, Any]]


def predict(gold: list[dict[str, Any]], run: Search) -> tuple[list[dict[str, Any]], list[float]]:
    lines, latencies = [], []
    for row in sorted(gold, key=lambda r: str(r["id"])):
        started = time.monotonic()
        lines.append({"id": row["id"], "response": run(str(row["query"]))})
        latencies.append((time.monotonic() - started) * 1000)
    return lines, latencies


def summary(lines: list[dict[str, Any]], latencies: list[float]) -> str:
    abstained = sum(line["response"]["abstained"] for line in lines)
    ordered = sorted(latencies)
    p95 = ordered[max(0, round(0.95 * len(ordered)) - 1)]
    return (
        f"predict: {len(lines)} queries, {abstained} abstained; latency ms"
        f" p50 {statistics.median(ordered):.0f}, p95 {p95:.0f}, max {ordered[-1]:.0f}"
    )


def arguments(argv: Sequence[str], env: Mapping[str, str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="python -m bernlife predict")
    parser.add_argument("--gold", type=Path, default=paths.repo_root() / "eval" / "gold.jsonl")
    default_out = paths.data_dir(env) / "eval" / "predictions.jsonl"
    parser.add_argument("--out", type=Path, default=default_out)
    return parser.parse_args(argv)


def main(argv: Sequence[str], env: Mapping[str, str] = os.environ) -> int:
    args = arguments(argv, env)
    gold = read_jsonl(args.gold)
    with connect(config.database_url(env)) as conn:
        conn.autocommit = True
        store, embedder = PostgresStore(conn), e5_embedder(paths.data_dir(env))
        llm = connect_model(env)
        embedder.query("warm up")
        lines, latencies = predict(gold, lambda query: search(query, None, store, embedder, llm))
    text = "".join(json.dumps(line, ensure_ascii=False) + "\n" for line in lines)
    write_atomic(args.out, text.encode("utf-8"))
    print(f"{summary(lines, latencies)}; model: {llm.backend}", file=sys.stderr)
    return 0
