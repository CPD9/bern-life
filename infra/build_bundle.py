"""Build the snapshot bundle a clean clone needs to answer searches with no crawl, GPU or key.

    python -m infra.build_bundle --version bundle-YYYYMMDD-N [--created-at 2026-10-18T22:00:00Z]

Each file is copied from the data directory into a staging folder and checked there, so a crawl
running meanwhile cannot change what was checked. The checked files and manifest.json are packed
into `<data>/release/<version>.tar.gz`, the layout infra/fetch_bundle.py verifies. Only the files
in PARTS are packed: the raw HTML store, reports and anything else in the data folder never ride
along. The same files at the same created_at give the same bytes: members sorted, one fixed time
and owner, no file name in the gzip header.
"""

import argparse
import gzip
import io
import json
import os
import re
import shutil
import sys
import tarfile
import tempfile
import tomllib
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from bernlife import paths

from infra import bundle_checks as checks
from infra.fetch_bundle import ROOT, BundleError, line_count, sha256_of

REPO = "CPD9/bern-life"
VERSION = re.compile(r"^bundle-\d{8}-\d+$")


@dataclass(frozen=True)
class Part:
    name: str
    source: str
    check: checks.Check


PARTS = (
    Part("pages.jsonl", "bundle/pages.jsonl", checks.schema_check("page.schema.json")),
    Part("profiles.jsonl", "bundle/profiles.jsonl", checks.schema_check("profile.schema.json")),
    Part("relations.jsonl", "bundle/relations.jsonl", checks.relations),
    Part("terms.jsonl", "bundle/terms.jsonl", checks.terms),
    Part("vectors.jsonl", "bundle/vectors.jsonl", checks.vectors),
    Part("predictions.jsonl", "eval/predictions.jsonl", checks.predictions),
    Part("llm_cache/pack.jsonl.xz", "bundle/llm_cache/pack.jsonl.xz", checks.llm_pack),
    Part("llm_cache/models.json", "bundle/llm_cache/models.json", checks.models),
)


def stage(data_dir: Path, staging: Path) -> dict[str, Path]:
    staged = {}
    for part in PARTS:
        source = data_dir / part.source
        if not source.is_file():
            raise BundleError(f"Refusing to build: {part.name} is missing ({source}).")
        target = staging / part.name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        part.check(part.name, target)
        staged[part.name] = target
    return staged


def engine_version() -> str:
    return tomllib.loads((ROOT / "engine" / "pyproject.toml").read_text())["project"]["version"]


def manifest(staged: Mapping[str, Path], version: str, created_at: datetime) -> bytes:
    files: dict[str, dict[str, object]] = {}
    for name in sorted(staged):
        files[name] = {"sha256": sha256_of(staged[name])}
        if name.endswith((".jsonl", ".json")):
            files[name]["lines"] = line_count(staged[name])
    document = {
        "version": version,
        "created_at": created_at.isoformat(),
        "engine_version": engine_version(),
        "files": files,
    }
    return (json.dumps(document, indent=2, sort_keys=True) + "\n").encode("utf-8")


def member(name: str, size: int, mtime: int) -> tarfile.TarInfo:
    info = tarfile.TarInfo(name)
    info.size, info.mtime, info.mode = size, mtime, 0o644
    info.uid = info.gid = 0
    info.uname = info.gname = ""
    return info


def write_tarball(staged: Mapping[str, Path], manifest_bytes: bytes, out: Path, mtime: int) -> None:
    partial = out.with_name(f"{out.name}.partial")
    with (
        partial.open("wb") as raw,
        gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=mtime) as compressed,
        tarfile.open(fileobj=compressed, mode="w", format=tarfile.USTAR_FORMAT) as tar,
    ):
        tar.addfile(member("manifest.json", len(manifest_bytes), mtime), io.BytesIO(manifest_bytes))
        for name in sorted(staged):
            with staged[name].open("rb") as data:
                tar.addfile(member(name, staged[name].stat().st_size, mtime), data)
    os.replace(partial, out)


def build(data_dir: Path, version: str, created_at: datetime) -> Path:
    if not VERSION.match(version):
        raise BundleError(f"Refusing to build: {version!r} is not bundle-YYYYMMDD-N.")
    release = data_dir / "release"
    release.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix="bundle-build-", dir=release))
    try:
        staged = stage(data_dir, staging)
        out = release / f"{version}.tar.gz"
        write_tarball(
            staged, manifest(staged, version, created_at), out, int(created_at.timestamp())
        )
    finally:
        shutil.rmtree(staging, ignore_errors=True)
    return out


def created(value: str | None) -> datetime:
    if value is None:
        return datetime.now(UTC).replace(microsecond=0)
    moment = datetime.fromisoformat(value)
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


def main(argv: list[str] | None = None, env: Mapping[str, str] = os.environ) -> int:
    parser = argparse.ArgumentParser(prog="python -m infra.build_bundle")
    parser.add_argument("--version", required=True, help="bundle-YYYYMMDD-N")
    parser.add_argument("--created-at", help="ISO time recorded in the manifest (default: now)")
    args = parser.parse_args(argv)
    try:
        out = build(paths.data_dir(env), args.version, created(args.created_at))
    except BundleError as error:
        print(error, file=sys.stderr)
        return 1
    with tarfile.open(out) as tar:
        print("\n".join(tar.getnames()))
    digest = sha256_of(out)
    print(f"{out}: {out.stat().st_size / 1e6:.1f} MB, sha256 {digest}")
    lock = {"repo": REPO, "version": args.version, "asset": out.name, "sha256": digest}
    print("bundle.lock: " + json.dumps(lock))
    return 0


if __name__ == "__main__":
    sys.exit(main())
