import hashlib
import io
import json
import shutil
import tarfile
import tempfile
import unittest
from pathlib import Path

from infra.fetch_bundle import BundleError, Lock, fetch, read_lock

VERSION = "bundle-20261018-1"
PAGES = b'{"url": "https://www.example-institute.test/team/ada-muster"}\n'
PROFILES = b'{"id": "person-example-ada-muster"}\n'


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def manifest(files: dict[str, bytes], version: str = VERSION) -> bytes:
    listed = {
        name: {"sha256": sha256(data), "lines": data.count(b"\n")} for name, data in files.items()
    }
    return json.dumps({"version": version, "files": listed}).encode()


def tar_bytes(members: dict[str, bytes], symlink: str | None = None) -> bytes:
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
        for name, data in members.items():
            info = tarfile.TarInfo(name)
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))
        if symlink:
            link = tarfile.TarInfo(symlink)
            link.type = tarfile.SYMTYPE
            link.linkname = "/etc/passwd"
            tar.addfile(link)
    return buffer.getvalue()


def good_archive() -> bytes:
    files = {"pages.jsonl": PAGES, "profiles.jsonl": PROFILES}
    return tar_bytes({**files, "manifest.json": manifest(files)})


class FakeRelease:
    def __init__(self, archive: bytes):
        self.archive = archive
        self.calls: list[str] = []

    def __call__(self, lock: Lock, dest: Path) -> None:
        self.calls.append(lock.asset)
        dest.write_bytes(self.archive)


class FetchBundleTest(unittest.TestCase):
    def setUp(self):
        self.data = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.data, ignore_errors=True)

    def lock_for(self, archive: bytes) -> Lock:
        return Lock("CPD9/bern-life", VERSION, "bundle.tar.gz", sha256(archive))

    def old_bundle(self) -> None:
        (self.data / "bundle").mkdir()
        (self.data / "bundle" / "pages.jsonl").write_text("old\n")

    def assert_refused(self, archive: bytes, message: str, lock: Lock | None = None) -> None:
        self.old_bundle()
        with self.assertRaises(BundleError) as caught:
            fetch(lock or self.lock_for(archive), self.data, FakeRelease(archive))
        self.assertEqual(str(caught.exception), message)
        self.assertEqual((self.data / "bundle" / "pages.jsonl").read_text(), "old\n")
        self.assertEqual(sorted(p.name for p in self.data.iterdir()), ["bundle", "downloads"])

    def test_missing_lock_says_no_bundle_is_published(self):
        with self.assertRaises(BundleError) as caught:
            read_lock(self.data / "bundle.lock")
        self.assertEqual(
            str(caught.exception), "No snapshot bundle is published yet (bundle.lock is missing)."
        )

    def test_lock_with_a_path_as_asset_is_refused(self):
        lock_path = self.data / "bundle.lock"
        lock_path.write_text(
            json.dumps(
                {"repo": "CPD9/bern-life", "version": VERSION, "asset": "../x", "sha256": "0" * 64}
            )
        )
        with self.assertRaises(BundleError) as caught:
            read_lock(lock_path)
        self.assertEqual(
            str(caught.exception), "bundle.lock needs a plain asset file name and a sha256 in hex."
        )

    def test_good_archive_replaces_the_bundle_and_is_cached(self):
        archive = good_archive()
        release = FakeRelease(archive)
        self.old_bundle()

        target = fetch(self.lock_for(archive), self.data, release)
        fetch(self.lock_for(archive), self.data, release)

        self.assertEqual(target, self.data / "bundle")
        self.assertEqual(
            sorted(p.name for p in target.iterdir()),
            ["manifest.json", "pages.jsonl", "profiles.jsonl"],
        )
        self.assertEqual((target / "pages.jsonl").read_bytes(), PAGES)
        self.assertEqual(release.calls, ["bundle.tar.gz"])
        self.assertEqual(sorted(p.name for p in self.data.iterdir()), ["bundle", "downloads"])

    def test_sha256_mismatch_is_refused_and_nothing_is_kept(self):
        archive = good_archive()
        wrong = "0" * 64
        lock = Lock("CPD9/bern-life", VERSION, "bundle.tar.gz", wrong)
        self.assert_refused(
            archive,
            f"Refusing bundle.tar.gz: its sha256 is {sha256(archive)}, bundle.lock says {wrong}.",
            lock,
        )
        self.assertEqual(list((self.data / "downloads").iterdir()), [])

    def test_path_outside_the_bundle_is_refused(self):
        archive = tar_bytes({"../escaped.txt": b"x\n", "manifest.json": manifest({})})
        self.assert_refused(archive, "Refusing bundle.tar.gz: it contains an unsafe path.")
        self.assertFalse((self.data / "escaped.txt").exists())

    def test_symlink_is_refused(self):
        files = {"pages.jsonl": PAGES}
        archive = tar_bytes({**files, "manifest.json": manifest(files)}, symlink="profiles.jsonl")
        self.assert_refused(archive, "Refusing bundle.tar.gz: it contains links or special files.")

    def test_file_that_differs_from_its_manifest_is_refused(self):
        listed = manifest({"pages.jsonl": PAGES})
        archive = tar_bytes({"pages.jsonl": b"tampered\n", "manifest.json": listed})
        self.assert_refused(
            archive, "Refusing the bundle: pages.jsonl does not match its manifest sha256."
        )

    def test_file_missing_from_the_manifest_is_refused(self):
        files = {"pages.jsonl": PAGES}
        archive = tar_bytes({**files, "extra.jsonl": b"{}\n", "manifest.json": manifest(files)})
        self.assert_refused(
            archive, "Refusing the bundle: its files differ from the ones manifest.json lists."
        )

    def test_manifest_for_another_version_is_refused(self):
        files = {"pages.jsonl": PAGES}
        archive = tar_bytes({**files, "manifest.json": manifest(files, "bundle-20261017-1")})
        self.assert_refused(
            archive,
            f"Refusing the bundle: manifest says bundle-20261017-1, lock says {VERSION}.",
        )


if __name__ == "__main__":
    unittest.main()
