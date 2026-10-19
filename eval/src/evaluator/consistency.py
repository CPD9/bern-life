"""Criterion 2 as a number: does one need, worded differently, find the same results?

eval/consistency.jsonl holds sets of wordings of one need, each copied verbatim from the case, the
gold set or the dev set. Every wording goes through the engine's own `predict` (replay, the same
search the app serves) into a predictions file this module reads; nothing here imports the engine.
Per set: the mean Jaccard overlap of the top-10 profile ids over every pair of wordings, and for
each wording the share of its top 10 that the set's first wording also finds. A wording that got
no recorded query expansion was searched plain, and is listed as such, because replay answers a
question nobody recorded without the model's other wordings.

    python -m evaluator.consistency eval/consistency.jsonl > queries.jsonl

writes the wordings as `{"id", "query"}` lines, the input `python -m bernlife predict --gold` takes.
"""

import json
import sys
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from itertools import combinations
from pathlib import Path
from typing import Any

from .load import LoadError, check, rows
from .score import top_results

Record = dict[str, Any]


@dataclass(frozen=True)
class WordingSet:
    id: str
    queries: tuple[str, ...]

    @property
    def ids(self) -> tuple[str, ...]:
        """`<set id>:<n>`, numbered from 1 in the file's order; 1 is the set's first wording."""
        return tuple(f"{self.id}:{n}" for n in range(1, len(self.queries) + 1))


def load_sets(path: Path) -> list[WordingSet]:
    sets: dict[str, WordingSet] = {}
    for where, row in rows(path):
        check(where, row, "consistency.schema.json")
        if row["id"] in sets:
            raise LoadError(f"{where}: second set named {row['id']}")
        sets[row["id"]] = WordingSet(row["id"], tuple(row["queries"]))
    if not sets:
        raise LoadError(f"{path}: no wording sets")
    return list(sets.values())


def query_rows(sets: Sequence[WordingSet]) -> list[dict[str, str]]:
    return [
        {"id": qid, "query": query}
        for wording in sets
        for qid, query in zip(wording.ids, wording.queries, strict=True)
    ]


def load_responses(path: Path, sets: Sequence[WordingSet]) -> dict[str, Record]:
    """One response per wording, each for exactly the wording it is filed under: a predictions
    file for other sets, or an older version of these, is refused rather than scored."""
    expected = {row["id"]: row["query"] for row in query_rows(sets)}
    responses: dict[str, Record] = {}
    for where, row in rows(path):
        if set(row) != {"id", "response"}:
            raise LoadError(f'{where}: a prediction is {{"id", "response"}}')
        qid = row["id"]
        if qid not in expected:
            raise LoadError(f"{where}: {qid!r} is not a wording in the consistency sets")
        if qid in responses:
            raise LoadError(f"{where}: second prediction for {qid}")
        check(where, row["response"], "result.schema.json")
        if row["response"]["query"] != expected[qid]:
            raise LoadError(f"{where}: the response for {qid} answers another question")
        responses[qid] = row["response"]
    missing = sorted(expected.keys() - responses.keys())
    if missing:
        raise LoadError(f"{path}: no prediction for {', '.join(missing)}")
    return responses


def top_ids(response: Record) -> frozenset[str]:
    return frozenset(result["profile"]["id"] for result in top_results(response))


def jaccard(a: frozenset[str], b: frozenset[str]) -> float | None:
    return len(a & b) / len(a | b) if a | b else None


def mean(values: Sequence[float | None]) -> float | None:
    measured = [value for value in values if value is not None]
    return sum(measured) / len(measured) if measured else None


def wording_set(wording: WordingSet, responses: Mapping[str, Record]) -> dict[str, object]:
    tops = [top_ids(responses[qid]) for qid in wording.ids]
    pairs = [jaccard(a, b) for a, b in combinations(tops, 2)]
    first = tops[0]
    queries = []
    wordings = zip(wording.ids, wording.queries, tops, strict=True)
    for position, (qid, query, top) in enumerate(wordings):
        response = responses[qid]
        found_by_first = len(top & first) / len(top) if position and top else None
        queries.append(
            {
                "id": qid,
                "query": query,
                "shown": len(top),
                "abstained": bool(response["abstained"]),
                "expanded": bool(response["expanded_terms"]),
                "found_by_first": found_by_first,
            }
        )
    return {
        "id": wording.id,
        "queries": queries,
        "pairs": len(pairs),
        "both_empty": sum(value is None for value in pairs),
        "jaccard_mean": mean(pairs),
        "found_by_first_mean": mean([q["found_by_first"] for q in queries]),
    }


def consistency(sets: Sequence[WordingSet], responses: Mapping[str, Record]) -> dict[str, object]:
    measured = [wording_set(wording, responses) for wording in sets]
    every_pair = [
        jaccard(a, b)
        for wording in sets
        for a, b in combinations([top_ids(responses[qid]) for qid in wording.ids], 2)
    ]
    return {
        "sets": measured,
        "jaccard_mean": mean(every_pair),
        "plain_search": [
            q["query"] for wording in measured for q in wording["queries"] if not q["expanded"]
        ],
        "queries": sum(len(wording.queries) for wording in sets),
    }


def main(argv: Sequence[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if len(args) != 1:
        print("usage: python -m evaluator.consistency eval/consistency.jsonl", file=sys.stderr)
        return 2
    try:
        sets = load_sets(Path(args[0]))
    except LoadError as error:
        print(f"eval: {error}", file=sys.stderr)
        return 2
    sys.stdout.writelines(json.dumps(row, ensure_ascii=False) + "\n" for row in query_rows(sets))
    return 0


if __name__ == "__main__":
    sys.exit(main())
