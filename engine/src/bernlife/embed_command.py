"""`python -m bernlife embed`: a vector for every chunk text, written to the bundle's vectors.jsonl.

Only texts with no stored vector are encoded, so a re-extraction re-embeds what changed and a
clean clone never embeds at all: `load` reads this file and refuses when a vector is missing.
"""

import os
import sys
import time
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path

from bernlife import paths
from bernlife.bundle_files import read_bundle, read_vectors, write_vectors
from bernlife.chunks import Chunk, build_chunks, vector_key
from bernlife.embed import Embedder, e5_embedder
from bernlife.terms import enrichment_by_value

DECIMALS = 6


def vector_rows(
    chunks: Sequence[Chunk], stored: Mapping[str, list[float]], embedder: Embedder
) -> tuple[list[dict[str, object]], int]:
    """One row per distinct chunk text; returns the rows and how many texts were encoded now."""
    wanted: dict[str, tuple[str, str]] = {}
    for chunk in chunks:
        wanted.setdefault(vector_key(chunk.text), (chunk.kind, chunk.text))
    missing = sorted(key for key in wanted if key not in stored)
    fresh = embedder.passages([wanted[key][1] for key in missing])
    vectors = {**stored, **dict(zip(missing, fresh, strict=True))}
    rows = [
        {"id": key, "kind": kind, "vector": [round(x, DECIMALS) for x in vectors[key]]}
        for key, (kind, _) in wanted.items()
    ]
    return rows, len(missing)


def run(bundle_dir: Path, embedder: Embedder) -> str:
    bundle = read_bundle(bundle_dir)
    enrichment = enrichment_by_value(bundle.terms)
    chunks = build_chunks(bundle.pages, bundle.profiles, bundle.relations, enrichment)
    started = time.monotonic()
    rows, encoded = vector_rows(chunks, read_vectors(bundle_dir), embedder)
    write_vectors(bundle_dir, rows)
    seconds = time.monotonic() - started
    return f"embed: {len(chunks)} chunks, {len(rows)} vectors, {encoded} encoded in {seconds:.1f}s"


def main(
    argv: Sequence[str],
    env: Mapping[str, str] = os.environ,
    make_embedder: Callable[[Path], Embedder] = e5_embedder,
) -> int:
    if argv:
        print("usage: python -m bernlife embed", file=sys.stderr)
        return 2
    print(run(paths.data_dir(env) / "bundle", make_embedder(paths.data_dir(env))))
    return 0
