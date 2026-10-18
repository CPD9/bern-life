"""Download the snapshot bundle named in bundle.lock, verify it and unpack it to data/bundle/.

    python3 infra/fetch_bundle.py [--archive <tarball copied by hand>]

The bundle is a release asset and never enters git (deletion path), so this is how pages, vectors
and the model cache reach a clean clone. A download is untrusted until its sha256 matches the lock
and every file matches manifest.json; the installed bundle is replaced only after both checks.
The hosted VM holds no GitHub token, so there the tarball arrives by scp and --archive puts it
through the same checks in place of the download.

The archive holds manifest.json and the bundle files at its root. The manifest lists every other
file with its sha256 and, for text files, its line count:
{"version": "bundle-20261018-1", "files": {"pages.jsonl": {"sha256": "...", "lines": 1234}}}
"""

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHUNK_BYTES = 1 << 20
SHA256_HEX = re.compile(r"^[0-9a-f]{64}$")
PLAIN_NAME = re.compile(r"^[A-Za-z0-9._-]+$")


class BundleError(Exception):
    """A refusal whose message is a plain sentence, fit to print as is."""


@dataclass(frozen=True)
class Lock:
    repo: str
    version: str
    asset: str
    sha256: str


Download = Callable[[Lock, Path], None]


def read_lock(path: Path) -> Lock:
    if not path.exists():
        raise BundleError("No snapshot bundle is published yet (bundle.lock is missing).")
    try:
        raw = json.loads(path.read_text())
        lock = Lock(raw["repo"], raw["version"], raw["asset"], raw["sha256"])
    except (ValueError, KeyError, TypeError) as err:
        raise BundleError("bundle.lock needs repo, version, asset and sha256.") from err
    if not (PLAIN_NAME.match(lock.asset) and SHA256_HEX.match(lock.sha256)):
        raise BundleError("bundle.lock needs a plain asset file name and a sha256 in hex.")
    return lock


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(CHUNK_BYTES):
            digest.update(chunk)
    return digest.hexdigest()


def line_count(path: Path) -> int:
    with path.open("rb") as f:
        return sum(chunk.count(b"\n") for chunk in iter(lambda: f.read(CHUNK_BYTES), b""))


def download_archive(lock: Lock, downloads: Path, download: Download) -> Path:
    archive = downloads / lock.asset
    if archive.exists() and sha256_of(archive) == lock.sha256:
        return archive
    downloads.mkdir(parents=True, exist_ok=True)
    partial = downloads / f"{lock.asset}.partial"
    partial.unlink(missing_ok=True)
    download(lock, partial)
    actual = sha256_of(partial)
    if actual != lock.sha256:
        partial.unlink()
        raise BundleError(
            f"Refusing {lock.asset}: its sha256 is {actual}, bundle.lock says {lock.sha256}."
        )
    partial.replace(archive)
    return archive


def unpack(archive: Path, into: Path) -> None:
    with tarfile.open(archive) as tar:
        members = tar.getmembers()
        if not all(m.isfile() or m.isdir() for m in members):
            raise BundleError(f"Refusing {archive.name}: it contains links or special files.")
        try:
            tar.extractall(into, members=members, filter="data")
        except tarfile.FilterError as err:
            raise BundleError(f"Refusing {archive.name}: it contains an unsafe path.") from err


def check_manifest(bundle: Path, version: str) -> None:
    try:
        manifest = json.loads((bundle / "manifest.json").read_text())
        listed: dict[str, dict[str, object]] = manifest["files"]
        manifest_version = manifest["version"]
    except (OSError, ValueError, KeyError, TypeError) as err:
        raise BundleError("Refusing the bundle: manifest.json is missing or malformed.") from err
    if manifest_version != version:
        raise BundleError(
            f"Refusing the bundle: manifest says {manifest_version}, lock says {version}."
        )
    present = sorted(p.relative_to(bundle).as_posix() for p in bundle.rglob("*") if p.is_file())
    if present != sorted([*listed, "manifest.json"]):
        raise BundleError(
            "Refusing the bundle: its files differ from the ones manifest.json lists."
        )
    for name in sorted(listed):
        path, expected = bundle / name, listed[name]
        if sha256_of(path) != expected.get("sha256"):
            raise BundleError(f"Refusing the bundle: {name} does not match its manifest sha256.")
        if "lines" in expected and line_count(path) != expected["lines"]:
            raise BundleError(f"Refusing the bundle: {name} does not have its manifest line count.")


def install(staged: Path, target: Path) -> None:
    previous = target.with_name(f"{target.name}.previous")
    shutil.rmtree(previous, ignore_errors=True)
    if target.exists():
        target.replace(previous)
    staged.replace(target)
    shutil.rmtree(previous, ignore_errors=True)


def fetch(lock: Lock, data_dir: Path, download: Download) -> Path:
    archive = download_archive(lock, data_dir / "downloads", download)
    staging = Path(tempfile.mkdtemp(prefix="bundle-staging-", dir=data_dir))
    try:
        staged = staging / "bundle"
        unpack(archive, staged)
        check_manifest(staged, lock.version)
        install(staged, data_dir / "bundle")
    finally:
        shutil.rmtree(staging, ignore_errors=True)
    return data_dir / "bundle"


def gh_download(lock: Lock, dest: Path) -> None:
    command = ["gh", "release", "download", lock.version, "-R", lock.repo, "-p", lock.asset]
    try:
        subprocess.run([*command, "-O", str(dest)], check=True)
    except (OSError, subprocess.CalledProcessError) as err:
        raise BundleError(f"gh could not download {lock.asset} from {lock.repo}.") from err


def public_download(lock: Lock, dest: Path) -> None:
    url = f"https://github.com/{lock.repo}/releases/download/{lock.version}/{lock.asset}"
    try:
        with urllib.request.urlopen(url, timeout=60) as response, dest.open("wb") as out:
            shutil.copyfileobj(response, out, CHUNK_BYTES)
    except OSError as err:
        raise BundleError(
            f"Could not download {lock.asset}; for a private repo install gh and run gh auth login."
        ) from err


def copy_archive(archive: Path) -> Download:
    def download(lock: Lock, dest: Path) -> None:
        try:
            shutil.copyfile(archive, dest)
        except OSError as err:
            raise BundleError(f"Could not read {archive}.") from err

    return download


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python3 infra/fetch_bundle.py")
    parser.add_argument("--archive", type=Path, help="a bundle tarball copied by hand")
    args = parser.parse_args(argv)
    data_dir = Path(os.environ.get("BERNLIFE_DATA_DIR") or ROOT / "data").expanduser()
    if args.archive is not None:
        download = copy_archive(args.archive.expanduser())
    else:
        download = gh_download if shutil.which("gh") else public_download
    try:
        lock = read_lock(ROOT / "bundle.lock")
        data_dir.mkdir(parents=True, exist_ok=True)
        target = fetch(lock, data_dir, download)
    except BundleError as err:
        print(err, file=sys.stderr)
        return 1
    print(f"{lock.version} verified and unpacked to {target}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
