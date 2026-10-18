"""The check each bundle file passes before it is packed.

Pages, profiles and predictions are checked against contracts/; relations against the columns the
engine writes; terms and vectors, which have no schema yet, against the keys contracts/api.md and
the `term` table name. Checks read line by line, so the pages file never sits in memory whole.
"""

import json
import lzma
import math
from collections.abc import Callable, Iterator, Sequence
from functools import cache
from pathlib import Path
from typing import Any

from bernlife.cache import read_pack
from bernlife.llm import ROLES
from bernlife.relations import COLUMNS
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from infra.fetch_bundle import ROOT, SHA256_HEX, BundleError

TERM_KEYS = ("value", "term", "kind")
VECTOR_KINDS = ("profile", "chunk")
VECTOR_SIZE = 384

Check = Callable[[str, Path], None]
Row = dict[str, Any]


@cache
def validator(schema: str) -> Draft202012Validator:
    """The schemas refer to each other by file name (result → profile), so they share a registry."""
    resources = [
        (path.name, Resource.from_contents(json.loads(path.read_text(encoding="utf-8"))))
        for path in sorted((ROOT / "contracts").glob("*.schema.json"))
    ]
    registry = Registry().with_resources(resources)
    return Draft202012Validator(registry.contents(schema), registry=registry)


def rows(name: str, path: Path) -> Iterator[tuple[str, Row]]:
    with path.open(encoding="utf-8") as lines:
        for number, line in enumerate(lines, 1):
            where = f"{name}:{number}"
            try:
                row = json.loads(line)
            except ValueError:
                raise BundleError(f"Refusing {where}: not JSON.") from None
            if not isinstance(row, dict):
                raise BundleError(f"Refusing {where}: not a JSON object.")
            yield where, row


def refuse_invalid(where: str, document: Row, schema: str) -> None:
    error = next(iter(validator(schema).iter_errors(document)), None)
    if error is not None:
        raise BundleError(f"Refusing {where}: {error.json_path}: {error.message[:200]}")


def schema_check(schema: str) -> Check:
    def check(name: str, path: Path) -> None:
        for where, row in rows(name, path):
            refuse_invalid(where, row, schema)

    return check


def keys_check(keys: Sequence[str]) -> Check:
    def check(name: str, path: Path) -> None:
        for where, row in rows(name, path):
            missing = [key for key in keys if key not in row]
            if missing:
                raise BundleError(f"Refusing {where}: missing {', '.join(missing)}.")

    return check


def relations(name: str, path: Path) -> None:
    keys_check(COLUMNS)(name, path)


def terms(name: str, path: Path) -> None:
    keys_check(TERM_KEYS)(name, path)


def vectors(name: str, path: Path) -> None:
    for where, row in rows(name, path):
        vector = row.get("vector")
        numbers = (
            isinstance(vector, list)
            and len(vector) == VECTOR_SIZE
            and all(
                isinstance(x, int | float) and not isinstance(x, bool) and math.isfinite(x)
                for x in vector
            )
        )
        if not (isinstance(row.get("id"), str) and row.get("kind") in VECTOR_KINDS and numbers):
            raise BundleError(
                f"Refusing {where}: a vector line is id, kind (profile or chunk)"
                f" and {VECTOR_SIZE} numbers."
            )


def predictions(name: str, path: Path) -> None:
    """One response per gold id, sorted by id, each valid against result.schema.json."""
    gold = (ROOT / "eval" / "gold.jsonl").read_text(encoding="utf-8").splitlines()
    gold_ids = sorted({json.loads(line)["id"] for line in gold if line.strip()})
    seen = []
    for where, row in rows(name, path):
        if set(row) != {"id", "response"}:
            raise BundleError(f'Refusing {where}: a prediction is {{"id", "response"}}.')
        refuse_invalid(where, row["response"], "result.schema.json")
        seen.append(row["id"])
    if seen != gold_ids:
        raise BundleError(
            f"Refusing {name}: it needs one line per gold id, sorted by id "
            f"({len(seen)} lines for {len(gold_ids)} gold ids)."
        )


def llm_pack(name: str, path: Path) -> None:
    try:
        entries = read_pack(path)
    except (OSError, EOFError, lzma.LZMAError, ValueError, KeyError, TypeError):
        raise BundleError(f"Refusing {name}: not a readable cache pack.") from None
    for key, entry in entries.items():
        cached = isinstance(entry.get("content"), str) and isinstance(entry.get("model"), str)
        if not (SHA256_HEX.match(key) and cached):
            raise BundleError(f"Refusing {name}: entry {key[:12]} is not a cached model call.")


def models(name: str, path: Path) -> None:
    try:
        mapping = json.loads(path.read_text(encoding="utf-8"))
    except ValueError:
        mapping = None
    by_role = isinstance(mapping, dict) and mapping and set(mapping) <= set(ROLES)
    if not (by_role and all(isinstance(model, str) for model in mapping.values())):
        raise BundleError(f"Refusing {name}: it maps the model roles to model ids.")
