"""Fold the model calls stored as their own files into the bundle's one compressed pack.

    python -m infra.pack_cache [--prune]

Adapted from CPD9/apertus-redteam-graph, track_1a/scripts/pack_cache.py (Apache-2.0). A live run
writes each call to its own file under `<data>/llm_cache/`; the snapshot bundle carries them as
`<data>/bundle/llm_cache/pack.jsonl.xz`, which replay reads when a call has no file of its own.
The new pack holds every entry of the old one plus every own file (an own file wins, as it does
when the cache is read) and replaces the old one only after it reads back equal, entry by entry.
The same entries always give the same bytes: lines sorted by key, keys sorted within each line,
no timestamp. `models.json`, which replay needs to rebuild cache keys, travels with the pack.
With --prune, the own files the pack now holds are deleted; nothing is deleted otherwise.
"""

import argparse
import json
import lzma
import os
import sys
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from bernlife import paths
from bernlife.cache import MODELS, PACK, cache_roots, read_pack

Entry = dict[str, Any]


class PackError(Exception):
    """A refusal whose message is a plain sentence, fit to print as is."""


def own_files(root: Path) -> dict[str, Path]:
    """Every call stored as its own file, by key."""
    return {path.stem: path for path in sorted(root.glob("??/*.json"))}


def encode(entries: Mapping[str, Entry]) -> bytes:
    lines = (
        json.dumps({"key": key, **entries[key]}, ensure_ascii=False, sort_keys=True) + "\n"
        for key in sorted(entries)
    )
    return lzma.compress("".join(lines).encode("utf-8"))


def replace_checked(path: Path, data: bytes, entries: Mapping[str, Entry] | None = None) -> None:
    """Write next to the target and swap it in; a pack must first read back equal."""
    new = path.with_name(f"{path.name}.new")
    new.write_bytes(data)
    if entries is not None and read_pack(new) != entries:
        new.unlink()
        raise PackError(f"The new pack did not read back equal; {path} is unchanged.")
    os.replace(new, path)


def pack(live: Path, bundle: Path) -> tuple[dict[str, Entry], dict[str, Path]]:
    """Write the new pack into the bundle; returns its entries and the own files it took in."""
    target = bundle / PACK
    entries = read_pack(target) if target.exists() else {}
    files = own_files(live)
    entries.update(
        {key: json.loads(file.read_text(encoding="utf-8")) for key, file in files.items()}
    )
    bundle.mkdir(parents=True, exist_ok=True)
    replace_checked(target, encode(entries), entries)
    if (live / MODELS).exists():
        replace_checked(bundle / MODELS, (live / MODELS).read_bytes())
    return entries, files


def prune(entries: Mapping[str, Entry], files: Mapping[str, Path]) -> int:
    """Delete the own files whose entry the pack holds unchanged, then their emptied folders."""
    pruned = 0
    for key, file in files.items():
        if json.loads(file.read_text(encoding="utf-8")) == entries[key]:
            file.unlink()
            pruned += 1
    for folder in {file.parent for file in files.values()}:
        if not any(folder.iterdir()):
            folder.rmdir()
    return pruned


def main(argv: list[str] | None = None, env: Mapping[str, str] = os.environ) -> int:
    parser = argparse.ArgumentParser(prog="python -m infra.pack_cache")
    parser.add_argument("--prune", action="store_true", help="delete own files the pack now holds")
    args = parser.parse_args(argv)
    live, bundle = cache_roots(paths.data_dir(env))
    try:
        entries, files = pack(live, bundle)
    except PackError as error:
        print(error, file=sys.stderr)
        return 1
    size = (bundle / PACK).stat().st_size
    print(
        f"{bundle / PACK}: {len(entries)} calls, {len(files)} from own files, {size / 1e6:.1f} MB"
    )
    if args.prune:
        print(f"deleted {prune(entries, files)} own files now in the pack")
    return 0


if __name__ == "__main__":
    sys.exit(main())
