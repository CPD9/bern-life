"""Reads the evaluator's inputs and checks each against contracts/ before anything is scored.

A predictions file that misses a gold id, names an unknown one, or holds a response the contract
rejects is refused: a partial run would report numbers for a different set of questions.
"""

import json
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

CONTRACTS = Path(__file__).resolve().parents[3] / "contracts"
TARGET_KINDS = (("person", "people"), ("unit", "units"))

Record = dict[str, Any]


class LoadError(ValueError):
    pass


@dataclass(frozen=True)
class Target:
    kind: str
    name: str
    proof_url: str


@dataclass(frozen=True)
class GoldQuery:
    id: str
    query: str
    lang: str
    variant: str
    base: str
    sources: tuple[str, ...]
    abstain: bool
    targets: tuple[Target, ...]


def gold_query(row: Record) -> GoldQuery:
    expect = row["expect"]
    targets = tuple(
        Target(kind, target["name"], target["proof_url"])
        for kind, key in TARGET_KINDS
        for target in expect.get(key, [])
    )
    return GoldQuery(
        id=row["id"],
        query=row["query"],
        lang=row["lang"],
        variant=row["variant"],
        base=row.get("variant_of", row["id"]),
        sources=tuple(row["sources"]),
        abstain=expect["abstain"],
        targets=targets,
    )


@cache
def validator(schema: str) -> Draft202012Validator:
    """The schemas refer to each other by file name (result → profile), so they share a registry."""
    resources = [
        (path.name, Resource.from_contents(json.loads(path.read_text(encoding="utf-8"))))
        for path in sorted(CONTRACTS.glob("*.schema.json"))
    ]
    registry = Registry().with_resources(resources)
    return Draft202012Validator(registry.contents(schema), registry=registry)


def rows(path: Path) -> Iterator[tuple[str, Record]]:
    try:
        lines = path.expanduser().read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        raise LoadError(f"{path} does not exist") from None
    for number, line in enumerate(lines, 1):
        if line.strip():
            yield f"{path}:{number}", parse_line(f"{path}:{number}", line)


def parse_line(where: str, line: str) -> Record:
    try:
        row = json.loads(line)
    except ValueError:
        raise LoadError(f"{where}: not JSON") from None
    if not isinstance(row, dict):
        raise LoadError(f"{where}: not a JSON object")
    return row


def check(where: str, document: Record, schema: str) -> None:
    error = next(iter(validator(schema).iter_errors(document)), None)
    if error is not None:
        raise LoadError(f"{where}: {error.json_path}: {error.message[:200]}")


def load_gold(path: Path) -> list[GoldQuery]:
    gold: dict[str, GoldQuery] = {}
    for where, row in rows(path):
        check(where, row, "gold.schema.json")
        if row["id"] in gold:
            raise LoadError(f"{where}: second gold line for {row['id']}")
        gold[row["id"]] = gold_query(row)
    return list(gold.values())


def load_predictions(path: Path, gold: Sequence[GoldQuery]) -> dict[str, Record]:
    ids = {query.id for query in gold}
    responses: dict[str, Record] = {}
    for where, row in rows(path):
        if set(row) != {"id", "response"}:
            raise LoadError(f'{where}: a prediction is {{"id", "response"}}')
        if row["id"] not in ids:
            raise LoadError(f"{where}: {row['id']!r} is not a gold id")
        if row["id"] in responses:
            raise LoadError(f"{where}: second prediction for {row['id']}")
        check(where, row["response"], "result.schema.json")
        responses[row["id"]] = row["response"]
    missing = sorted(ids - responses.keys())
    if missing:
        listed = ", ".join(missing[:5]) + (", …" if len(missing) > 5 else "")
        raise LoadError(f"{path}: no prediction for {len(missing)} gold ids ({listed})")
    return responses


def load_records(path: Path, schema: str, key: str) -> dict[str, Record]:
    """Snapshot records (pages by url, profiles by id), each checked against its contract."""
    records: dict[str, Record] = {}
    for where, row in rows(path):
        check(where, row, schema)
        records[row[key]] = row
    return records
