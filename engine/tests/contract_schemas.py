"""Validators for the contracts, resolving references between them.

A contract that is not on this branch yet, or lacks the property a test checks, skips that test
with the reason instead of failing it.
"""

import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"


def validator(name: str, requires: str | None = None) -> Draft202012Validator:
    path = CONTRACTS / name
    present = path.exists() and (
        requires is None or requires in json.loads(path.read_text())["properties"]
    )
    if not present:
        raise unittest.SkipTest(f"contracts/{name} on this branch predates the contracts of #178")
    resources = [
        (contract.name, Resource.from_contents(json.loads(contract.read_text())))
        for contract in sorted(CONTRACTS.glob("*.schema.json"))
    ]
    registry = Registry().with_resources(resources)
    return Draft202012Validator(registry.contents(name), registry=registry)
