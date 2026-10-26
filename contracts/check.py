"""Validate every contract fixture, every source config, the gold set, dev2 and the committed
evaluation metrics against contracts/.

Run by CI and `make test`. The schemas refer to each other by file name (result → profile), so
they are loaded into one registry rather than checked one file at a time.
"""

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parents[1]
CONTRACTS = ROOT / "contracts"

CHECKS = [
    ("source.schema.json", ["contracts/fixtures/source.json", "sources/*.json"]),
    ("page.schema.json", ["contracts/fixtures/page.json"]),
    ("profile.schema.json", ["contracts/fixtures/profile.json"]),
    ("result.schema.json", ["contracts/fixtures/result*.json"]),
    ("health.schema.json", ["contracts/fixtures/health.json"]),
    ("agent.schema.json", ["contracts/fixtures/agent.json"]),
    ("sources.schema.json", ["contracts/fixtures/sources.json"]),
    ("place-people.schema.json", ["contracts/fixtures/place-people.json"]),
    ("numbers.schema.json", ["contracts/fixtures/numbers.json"]),
    ("admin-activity.schema.json", ["contracts/fixtures/admin-activity.json"]),
    ("admin-flagged.schema.json", ["contracts/fixtures/admin-flagged.json"]),
    ("metrics.schema.json", ["eval/results/*/metrics.json"]),
    ("quest.schema.json", ["contracts/fixtures/story.json"]),
    ("gold.schema.json", ["contracts/fixtures/gold.jsonl", "eval/gold.jsonl", "eval/dev2.jsonl"]),
    ("consistency.schema.json", ["eval/consistency.jsonl"]),
]


def registry() -> Registry:
    resources = [
        (path.name, Resource.from_contents(json.loads(path.read_text())))
        for path in sorted(CONTRACTS.glob("*.schema.json"))
    ]
    return Registry().with_resources(resources)


def documents(path: Path) -> list[tuple[str, object]]:
    if path.suffix == ".jsonl":
        lines = path.read_text().splitlines()
        return [(f"{path}:{n}", json.loads(line)) for n, line in enumerate(lines, 1) if line]
    return [(str(path), json.loads(path.read_text()))]


def errors() -> list[str]:
    reg = registry()
    found = []
    for schema_name, patterns in CHECKS:
        schema = reg.contents(schema_name)
        validator = Draft202012Validator(schema, registry=reg)
        for pattern in patterns:
            for path in sorted(ROOT.glob(pattern)):
                for where, doc in documents(path):
                    found += [
                        f"{where}: {e.json_path}: {e.message}" for e in validator.iter_errors(doc)
                    ]
    return found


if __name__ == "__main__":
    problems = errors()
    print("\n".join(problems) or "contracts: all documents valid")
    sys.exit(1 if problems else 0)
