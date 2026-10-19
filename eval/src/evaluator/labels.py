"""Scores the filled labelling sheets: field completeness against the page, and agreement.

A field counts as one the page states when a labeller answered y; on an overlap row it counts when
either labeller did, so a field one of them found is never dropped from what the system should
have filled. Completeness per field is the share of results whose page states the field that the
system filled (Wilson interval); pooled over fields, it is resampled by result (cluster
bootstrap), since one result's fields are not independent. A field the system filled although
the page is silent came from another page of the profile and is counted apart, not as an error.
Agreement is Cohen's kappa on the overlap rows, per field and over every field judged by both; a
blank or unreadable answer is left out and counted.
"""

import json
from collections import defaultdict
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from .load import LoadError
from .sheet import KEY, LABELLERS, read_sheet, sheet_name
from .stats import cluster_bootstrap, wilson

YES = frozenset({"y", "yes", "j", "ja"})
NO = frozenset({"n", "no", "nein"})

Record = dict[str, Any]
Answers = dict[str, bool | None]


def answer(cell: str) -> bool | None:
    word = cell.strip().casefold()
    return True if word in YES else False if word in NO else None


def load_key(folder: Path) -> Record:
    path = folder / KEY
    try:
        key = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise LoadError(f"{path} does not exist") from None
    except ValueError:
        raise LoadError(f"{path}: not JSON") from None
    if not isinstance(key, dict) or not isinstance(key.get("items"), list):
        raise LoadError(f"{path}: no items")
    return key


def load_answers(folder: Path, key: Record) -> dict[str, dict[int, Answers]]:
    """Each labeller's answers by item. A row for an item the key does not give that labeller,
    or a second row for one item, is refused: the sheets and the key must belong together."""
    fields = key["fields"]
    assigned = {
        labeller: {item["item"] for item in key["items"] if labeller in item["labellers"]}
        for labeller in LABELLERS
    }
    answers: dict[str, dict[int, Answers]] = {}
    for labeller in LABELLERS:
        path = folder / sheet_name(labeller)
        rows: dict[int, Answers] = {}
        for row in read_sheet(path):
            item = row["item"].strip()
            if not item.isdigit() or int(item) not in assigned[labeller]:
                raise LoadError(f"{path}: item {item!r} is not one of this sheet's rows")
            if int(item) in rows:
                raise LoadError(f"{path}: second row for item {item}")
            rows[int(item)] = {field: answer(row[field]) for field in fields}
        answers[labeller] = rows
    return answers


def stated(labels: Sequence[Answers], field: str) -> bool | None:
    given = [labels_of[field] for labels_of in labels if labels_of[field] is not None]
    return any(given) if given else None


def kappa(pairs: Sequence[tuple[bool, bool]]) -> float | None:
    """Cohen's kappa for two raters and yes/no; None with no pairs, or when chance agreement is
    1 (both gave one same answer throughout), where kappa is undefined."""
    if not pairs:
        return None
    n = len(pairs)
    observed = sum(a == b for a, b in pairs) / n
    first, second = sum(a for a, _ in pairs) / n, sum(b for _, b in pairs) / n
    chance = first * second + (1 - first) * (1 - second)
    return None if chance == 1 else (observed - chance) / (1 - chance)


def agreement(pairs: Sequence[tuple[bool, bool]]) -> dict[str, object]:
    agree = sum(a == b for a, b in pairs)
    return {
        "pairs": len(pairs),
        "agreement": agree / len(pairs) if pairs else None,
        "kappa": kappa(pairs),
    }


def proportion(k: int, n: int) -> dict[str, object]:
    return {"k": k, "n": n, "value": k / n if n else None, "ci": wilson(k, n) if n else None}


def score_labels(key: Record, answers: Mapping[str, Mapping[int, Answers]]) -> dict[str, object]:
    fields = key["fields"]
    per_field: dict[str, dict[str, int]] = {
        field: {"stated": 0, "filled_where_stated": 0, "filled_page_silent": 0, "unanswered": 0}
        for field in fields
    }
    clusters: dict[str, list[float]] = defaultdict(list)
    pairs: dict[str, list[tuple[bool, bool]]] = {field: [] for field in fields}
    labelled = 0
    for item in key["items"]:
        number = item["item"]
        given = [answers[who][number] for who in item["labellers"] if number in answers[who]]
        if not any(value is not None for labels_of in given for value in labels_of.values()):
            for field in fields:
                per_field[field]["unanswered"] += 1
            continue
        labelled += 1
        for field in fields:
            on_page, system = stated(given, field), item["filled"][field]
            counts = per_field[field]
            if on_page is None:
                counts["unanswered"] += 1
            elif on_page:
                counts["stated"] += 1
                counts["filled_where_stated"] += system
                clusters[str(number)].append(float(system))
            else:
                counts["filled_page_silent"] += system
        if len(given) == len(LABELLERS) == len(item["labellers"]):
            for field in fields:
                a, b = given[0][field], given[1][field]
                if a is not None and b is not None:
                    pairs[field].append((a, b))
    stated_total = sum(counts["stated"] for counts in per_field.values())
    filled_total = sum(counts["filled_where_stated"] for counts in per_field.values())
    return {
        "status": "labelled",
        "bundle": key.get("bundle"),
        "results": len(key["items"]),
        "labelled": labelled,
        "fields": {
            field: {
                **counts,
                "completeness": proportion(counts["filled_where_stated"], counts["stated"]),
            }
            for field, counts in per_field.items()
        },
        "completeness": {
            "value": filled_total / stated_total if stated_total else None,
            "ci": cluster_bootstrap(clusters),
            "stated": stated_total,
            "filled_where_stated": filled_total,
        },
        "agreement": {
            "overlap": sum(len(item["labellers"]) == len(LABELLERS) for item in key["items"]),
            "fields": {field: agreement(pairs[field]) for field in fields},
            "pooled": agreement([pair for field in fields for pair in pairs[field]]),
        },
    }


def labelled_completeness(folder: Path, predictions_sha256: str) -> dict[str, object]:
    """The scored sheets in `folder`; refused when the key was drawn from other predictions."""
    key = load_key(folder)
    if key.get("predictions_sha256") != predictions_sha256:
        raise LoadError(
            f"{folder / KEY}: the sheets were drawn from other predictions than these"
        )
    return score_labels(key, load_answers(folder, key))
