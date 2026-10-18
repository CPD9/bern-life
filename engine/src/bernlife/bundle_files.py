"""The bundle files that embedding and loading read, and the bundle's identity.

A released bundle names its version in manifest.json. A bundle built locally has none yet, so its
version is derived from the files' hashes: two loads of the same files always record the same one.
"""

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from bernlife.jsonl import read_jsonl, write_atomic

Record = dict[str, Any]
IDENTITY_FILES = ("pages.jsonl", "profiles.jsonl", "relations.jsonl", "vectors.jsonl")


@dataclass(frozen=True)
class Bundle:
    pages: list[Record]
    profiles: list[Record]
    relations: list[Record]


@dataclass(frozen=True)
class Identity:
    version: str
    sha256: str


def read_bundle(folder: Path) -> Bundle:
    return Bundle(
        pages=read_jsonl(folder / "pages.jsonl"),
        profiles=read_jsonl(folder / "profiles.jsonl"),
        relations=read_jsonl(folder / "relations.jsonl"),
    )


def read_vectors(folder: Path) -> dict[str, list[float]]:
    return {str(row["id"]): row["vector"] for row in read_jsonl(folder / "vectors.jsonl")}


def write_vectors(folder: Path, rows: list[Record]) -> None:
    ordered = sorted(rows, key=lambda row: str(row["id"]))
    lines = "".join(json.dumps(row, separators=(",", ":")) + "\n" for row in ordered)
    write_atomic(folder / "vectors.jsonl", lines.encode())


def identity(folder: Path) -> Identity:
    digest = hashlib.sha256()
    for name in IDENTITY_FILES:
        path = folder / name
        file_hash = hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else "absent"
        digest.update(f"{name} {file_hash}\n".encode())
    sha = digest.hexdigest()
    manifest = folder / "manifest.json"
    if manifest.exists():
        return Identity(str(json.loads(manifest.read_text())["version"]), sha)
    return Identity(f"local-{sha[:12]}", sha)
