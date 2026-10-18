"""Disk cache of every model call, keyed by the request.

Adapted from CPD9/apertus-redteam-graph, track_1a/src/redteam/cache.py (Apache-2.0).

Live runs fill it; replay answers only from it, so a judge reproduces every model answer on a
machine without a GPU. A live call is its own file, <root>/<key[:2]>/<key>.json. A snapshot bundle
folds them into one <root>/pack.jsonl.xz, read only when a call has no file of its own, then whole
and once per process; a call's own file wins over the pack.
"""

import hashlib
import json
import lzma
import os
import threading
from collections.abc import Sequence
from pathlib import Path
from typing import Any

PACK = "pack.jsonl.xz"
MODELS = "models.json"
AUDIT = "audit.jsonl"

Message = dict[str, str]
Entry = dict[str, Any]

_packs: dict[Path, tuple[int, dict[str, Entry]]] = {}
_packs_lock = threading.Lock()
_audit_lock = threading.Lock()


class CacheMiss(LookupError):
    pass


def cache_roots(data_dir: Path) -> tuple[Path, Path]:
    """Where live calls are written, then the bundle's recorded calls."""
    return data_dir / "llm_cache", data_dir / "bundle" / "llm_cache"


def cache_key(
    model: str,
    messages: Sequence[Message],
    temperature: float,
    seed: int | None,
    max_tokens: int,
    prompt_version: str,
) -> str:
    request = {
        "model": model,
        "messages": list(messages),
        "temperature": temperature,
        "seed": seed,
        "max_tokens": max_tokens,
        "prompt_version": prompt_version,
    }
    return hashlib.sha256(
        json.dumps(request, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()


def entry_path(root: Path, key: str) -> Path:
    return root / key[:2] / f"{key}.json"


def read_pack(path: Path) -> dict[str, Entry]:
    with lzma.open(path, "rt", encoding="utf-8") as lines:
        return {entry.pop("key"): entry for entry in map(json.loads, lines)}


def packed(root: Path) -> dict[str, Entry]:
    """The pack of a cache root, read on first use and again only if the file changes."""
    path = root / PACK
    try:
        mtime = path.stat().st_mtime_ns
    except FileNotFoundError:
        return {}
    with _packs_lock:
        if path not in _packs or _packs[path][0] != mtime:
            _packs[path] = (mtime, read_pack(path))
        return _packs[path][1]


def lookup(roots: Sequence[Path], key: str) -> Entry | None:
    for root in roots:
        try:
            return json.loads(entry_path(root, key).read_text(encoding="utf-8"))
        except FileNotFoundError:
            pass
    for root in roots:
        if key in (pack := packed(root)):
            return pack[key]
    return None


def write_json(path: Path, value: object) -> None:
    """Write the file whole or not at all, so a run stopped mid-write leaves no cut-off file to
    fail every later replay. The temporary name is unique per process and thread because a batch
    writes from several threads at once."""
    path.parent.mkdir(parents=True, exist_ok=True)
    # Not mkstemp: its files are owner-only, and the engine container writes the cache as root.
    tmp = path.with_name(f"{path.name}.{os.getpid()}-{threading.get_ident()}.tmp")
    try:
        tmp.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True), encoding="utf-8")
        os.replace(tmp, path)
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise


def read_models(roots: Sequence[Path]) -> dict[str, str] | None:
    """The model id per role of the last live run, which replay needs to rebuild cache keys."""
    for root in roots:
        try:
            return json.loads((root / MODELS).read_text(encoding="utf-8"))
        except FileNotFoundError:
            pass
    return None


def append_audit(root: Path, record: dict[str, object]) -> None:
    root.mkdir(parents=True, exist_ok=True)
    line = json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n"
    with _audit_lock, (root / AUDIT).open("a", encoding="utf-8") as audit:
        audit.write(line)


def count_entries(roots: Sequence[Path]) -> dict[str, int]:
    return {
        "files": sum(len(list(root.glob("??/*.json"))) for root in roots),
        "pack": sum(len(packed(root)) for root in roots),
    }
