"""The blind labelling sheets for field completeness (criterion 4), one per labeller.

The pre-registration compares filled fields with what the source page could fill, judged by people
on 30 results. A sheet shows each result's kind, name and source page only: no query, rank, score,
reason or filled values, so the labeller judges the page, not the system. Results are drawn
round-robin across sources with seed 1, each profile once. The first OVERLAP results go to both
labellers, so their agreement can be measured; the others alternate between them, so each has
OVERLAP + (SIZE - OVERLAP) / 2 rows, about 20 minutes of work. What the system filled stays in
key.json, never in a sheet, for scoring once the sheets come back (labels.py).

The sheets name people from public pages, so they and the key go to eval/out/labelling/ (ignored
by git) or another folder of the labeller's choice, and are never committed. A folder whose sheets
already hold answers, or cannot be read, is left as it is.
"""

import csv
import json
import random
from collections import defaultdict
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from .coverage import PAGE_FIELDS, filled
from .load import LoadError
from .score import QueryResult

SIZE, OVERLAP, SEED = 30, 8, 1
LABELLERS = ("peter", "nik")
DISPLAY = {"peter": "Peter", "nik": "Nik"}
KEY = "key.json"
ENCODINGS = ("utf-8-sig", "cp1252")
HEADER = ["item", "kind", "name", "source link", *PAGE_FIELDS, "notes"]
DEFINITIONS = {
    "person": "the page names this person, unit, project or infrastructure",
    "role/affiliation": "a person's role, position or title (professor, PhD student, head of,"
    " …); n for a unit, project or infrastructure",
    "unit": "the group, lab, institute or department it belongs to",
    "expertise": "a research topic, method or field it works on",
    "projects": "a named project or activity it works on",
    "infrastructure/services": "a facility, instrument, platform or service it runs, uses or"
    " offers",
}

Record = dict[str, Any]
Pick = tuple[QueryResult, Record]


def sheet_name(labeller: str) -> str:
    return f"sheet-{labeller}.csv"


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
    profiles: set[str] = set()
    while len(chosen) < size and any(queues):
        for queue in queues:
            while queue and queue[0][1]["profile"]["id"] in profiles:
                queue.pop(0)
            if queue and len(chosen) < size:
                pick = queue.pop(0)
                chosen.append(pick)
                profiles.add(pick[1]["profile"]["id"])
    return chosen


def labellers(row: int) -> tuple[str, ...]:
    """Who labels the row-th pick (from 0): both for the overlap, then each in turn."""
    if row < OVERLAP:
        return LABELLERS
    return (LABELLERS[(row - OVERLAP) % len(LABELLERS)],)


def instructions(labeller: str, rows: int) -> list[str]:
    lines = [
        f"Bern Life field check for {DISPLAY[labeller]}: {rows} rows, about 20 minutes.",
        "For each row open the page in 'source link' and answer y or n in each field column:"
        " does THIS page state that field for the result in 'name'? 'kind' says whether it is"
        " a person, unit, project or infrastructure.",
        *(f"{field}: {meaning}." for field, meaning in DEFINITIONS.items()),
        "Judge only this one page, not other pages or what you know. Leave a cell empty if you"
        " cannot tell, and use 'notes' for anything odd.",
        "Keep the item column as it is, and save as CSV under the same name.",
    ]
    return [f"# {line}" for line in lines]


def sheet_text(path: Path) -> str:
    """The sheet as text: UTF-8 with or without a byte-order mark, else Windows-1252, which Excel's
    plain "CSV" save writes on Windows (with semicolons in Switzerland)."""
    try:
        data = path.read_bytes()
    except FileNotFoundError:
        raise LoadError(f"{path} does not exist") from None
    for encoding in ENCODINGS:
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise LoadError(f"{path}: neither UTF-8 nor Windows-1252 text; save it as CSV UTF-8")


def read_sheet(path: Path) -> list[dict[str, str]]:
    """The rows under the header, by column name. The instructions above the header are skipped,
    and a sheet saved back by a spreadsheet with a byte-order mark, in Windows-1252 or with
    semicolons (as Excel does in Switzerland) reads the same."""
    lines = sheet_text(path).splitlines()
    for delimiter in (",", ";", "\t"):
        parsed = list(csv.reader(lines, delimiter=delimiter))
        start = next((n for n, row in enumerate(parsed) if row[:1] == ["item"]), None)
        if start is not None and parsed[start][: len(HEADER) - 1] == HEADER[:-1]:
            header = parsed[start]
            return [
                {name: (row[n] if n < len(row) else "") for n, name in enumerate(header)}
                for row in parsed[start + 1 :]
                if any(cell.strip() for cell in row)
            ]
    raise LoadError(f"{path}: no header row starting {', '.join(HEADER[:4])}")


def answered(path: Path) -> bool:
    """Whether a sheet already holds any answer, so a rerun never overwrites someone's work; a
    sheet that cannot be read counts as answered."""
    if not path.is_file():
        return False
    try:
        rows = read_sheet(path)
    except LoadError:
        return True
    return any(row[field].strip() for row in rows for field in PAGE_FIELDS)


def write_sheets(picks: Sequence[Pick], folder: Path, about: Mapping[str, object]) -> bool:
    """One sheet per labeller and the key; nothing is written when a sheet there has answers or
    cannot be read. `about` names the predictions the picks were drawn from, so labels are never
    scored against other ones."""
    if any(answered(folder / sheet_name(labeller)) for labeller in LABELLERS):
        return False
    folder.mkdir(parents=True, exist_ok=True)
    assigned = [labellers(row) for row in range(len(picks))]
    for labeller in LABELLERS:
        rows = [row for row in range(len(picks)) if labeller in assigned[row]]
        with (folder / sheet_name(labeller)).open("w", newline="", encoding="utf-8") as out:
            writer = csv.writer(out)
            writer.writerows([line] for line in instructions(labeller, len(rows)))
            writer.writerow([])
            writer.writerow(HEADER)
            for row in rows:
                profile = picks[row][1]["profile"]
                writer.writerow(
                    [row + 1, profile["kind"], profile["name"]["value"], profile["source_url"]]
                    + [""] * (len(PAGE_FIELDS) + 1)
                )
    items = [
        {
            "item": row + 1,
            "labellers": list(assigned[row]),
            "query": query.gold.id,
            "profile": result["profile"]["id"],
            "kind": result["profile"]["kind"],
            "source": result["profile"]["source_id"],
            "filled": {field: filled(result)[field] for field in PAGE_FIELDS},
        }
        for row, (query, result) in enumerate(picks)
    ]
    key = {**about, "fields": list(PAGE_FIELDS), "overlap": OVERLAP, "items": items}
    text = json.dumps(key, indent=2, ensure_ascii=False) + "\n"
    (folder / KEY).write_text(text, encoding="utf-8")
    return True
