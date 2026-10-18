"""The blind labelling sheet for field completeness.

The pre-registration compares filled fields with what the source page could fill, judged by people
on 30 results. The sheet shows each result's name and page only: no rank, score, reason or filled
values, so the labeller judges the page, not the system. Results are drawn round-robin across
sources with seed 1. The first OVERLAP rows go to both labellers, so agreement can be measured;
the key file keeps what the system filled, for scoring once the sheet comes back.
"""

import csv
import json
import random
from collections import defaultdict
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from .coverage import PAGE_FIELDS, filled
from .score import QueryResult

SIZE, OVERLAP, SEED = 30, 10, 1
LABELLERS = ("Peter", "Nik")

Record = dict[str, Any]
Pick = tuple[QueryResult, Record]


def stratified(results: Sequence[QueryResult], size: int = SIZE, seed: int = SEED) -> list[Pick]:
    by_source: dict[str, list[Pick]] = defaultdict(list)
    for query in results:
        if not query.gold.abstain:
            for result in query.top:
                by_source[result["profile"]["source_id"]].append((query, result))
    rng = random.Random(seed)
    for picks in by_source.values():
        picks.sort(key=lambda pick: (pick[0].gold.id, pick[1]["rank"]))
        rng.shuffle(picks)
    queues = [by_source[source] for source in sorted(by_source)]
    chosen: list[Pick] = []
    while len(chosen) < size and any(queues):
        for queue in queues:
            if queue and len(chosen) < size:
                chosen.append(queue.pop(0))
    return chosen


def labeller(row: int) -> str:
    if row < OVERLAP:
        return " + ".join(LABELLERS)
    return LABELLERS[(row - OVERLAP) * len(LABELLERS) // (SIZE - OVERLAP)]


def write_sheet(picks: Sequence[Pick], sheet: Path, key: Path) -> None:
    sheet.parent.mkdir(parents=True, exist_ok=True)
    columns = ["item", "labeller", "query", "lang", "name", "page"]
    columns += [f"page states {field} (y/n)" for field in PAGE_FIELDS] + ["notes"]
    with sheet.open("w", newline="", encoding="utf-8") as out:
        writer = csv.writer(out)
        writer.writerow(columns)
        for row, (query, result) in enumerate(picks):
            profile = result["profile"]
            writer.writerow(
                [row + 1, labeller(row), query.gold.query, query.gold.lang]
                + [profile["name"]["value"], profile["source_url"]]
                + [""] * (len(PAGE_FIELDS) + 1)
            )
    entries = [
        {"item": row + 1, "query": q.gold.id, "profile": r["profile"]["id"], "filled": filled(r)}
        for row, (q, r) in enumerate(picks)
    ]
    key.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
