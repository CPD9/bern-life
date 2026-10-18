"""`python -m bernlife calibrate`: the abstention signals of every dev query, as a table.

The thresholds in abstain.py are read off this table for eval/dev.jsonl and nothing else, so
anyone can rerun it and see why they are where they are. It is never pointed at the gold set.
"""

import argparse
import os
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path

from bernlife import config, paths
from bernlife.abstain import unmatched_person
from bernlife.database import connect
from bernlife.embed import e5_embedder
from bernlife.jsonl import read_jsonl
from bernlife.search import assess
from bernlife.store import PostgresStore

HEADER = "| id | variant | expect abstain | best coverage | best similarity | unmatched name |"


def row_line(row: dict, coverage: float, similarity: float, unmatched: bool) -> str:
    expect = "yes" if row["expect"]["abstain"] else "no"
    flag = "yes" if unmatched else ""
    cells = [row["id"], row["variant"], expect, f"{coverage:.3f}", f"{similarity:.3f}", flag]
    return "| " + " | ".join(cells) + " |"


def main(argv: Sequence[str], env: Mapping[str, str] = os.environ) -> int:
    parser = argparse.ArgumentParser(prog="python -m bernlife calibrate")
    parser.add_argument("--dev", type=Path, default=paths.repo_root() / "eval" / "dev.jsonl")
    args = parser.parse_args(argv)
    if args.dev.resolve().name == "gold.jsonl":
        print("calibrate: thresholds are set on the dev set only", file=sys.stderr)
        return 2
    lines = [HEADER, "|---|---|---|---|---|---|"]
    with connect(config.database_url(env)) as conn:
        conn.autocommit = True
        store, embedder = PostgresStore(conn), e5_embedder(paths.data_dir(env))
        for row in sorted(read_jsonl(args.dev), key=lambda r: str(r["id"])):
            found = assess(str(row["query"]), None, store, embedder).found
            coverage = max((c.coverage for c in found), default=0.0)
            similarity = max((c.similarity for c in found), default=0.0)
            unmatched = unmatched_person(str(row["query"]), found)
            lines.append(row_line(row, coverage, similarity, unmatched))
    print("\n".join(lines))
    return 0
