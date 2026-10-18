import json
import shutil
import tarfile
import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path

from bernlife.cache import lookup
from bernlife.relations import COLUMNS

from infra.build_bundle import build
from infra.fetch_bundle import ROOT, BundleError, check_manifest, sha256_of, unpack
from infra.pack_cache import encode

VERSION = "bundle-20261018-1"
CREATED = datetime(2026, 10, 18, 22, 0, tzinfo=UTC)
KEY = "d" * 64
CALL = {"role": "expand", "model": "apertus-v1-5-70b", "content": "CGM"}
MEMBERS = [
    "manifest.json",
    "llm_cache/models.json",
    "llm_cache/pack.jsonl.xz",
    "pages.jsonl",
    "predictions.jsonl",
    "profiles.jsonl",
    "relations.jsonl",
    "terms.jsonl",
    "vectors.jsonl",
]


def line(document: object) -> str:
    return json.dumps(document, ensure_ascii=False) + "\n"


class BuildBundleTest(unittest.TestCase):
    """An invented data folder, laid out as the engine leaves it after crawl, extract, predict."""

    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.data = Path(tmp.name)
        bundle = self.data / "bundle"
        (bundle / "llm_cache").mkdir(parents=True)
        (self.data / "eval").mkdir()
        (self.data / "crawl").mkdir()
        fixtures = ROOT / "contracts" / "fixtures"
        profile = json.loads((fixtures / "profile.json").read_text())
        relation = dict.fromkeys(COLUMNS, "invented") | {"start": 0}
        files = {
            "pages.jsonl": line(json.loads((fixtures / "page.json").read_text())),
            "profiles.jsonl": line(profile),
            "relations.jsonl": line(relation),
            "terms.jsonl": line({"value": "glucose sensors", "term": "CGM", "kind": "acronym"}),
            "vectors.jsonl": line({"id": profile["id"], "kind": "profile", "vector": [0.25] * 384}),
            "llm_cache/models.json": line({"expand": "apertus-v1-5-70b"}),
        }
        for name, text in files.items():
            (bundle / name).write_text(text)
        (bundle / "llm_cache" / "pack.jsonl.xz").write_bytes(encode({KEY: CALL}))
        shutil.copyfile(
            ROOT / "eval/tests/fixtures/predictions.jsonl", self.data / "eval/predictions.jsonl"
        )
        (bundle / "stray.html").write_text("<html>raw page</html>")
        (self.data / "crawl" / "raw.jsonl.gz").write_bytes(b"raw html store")

    def test_bundle_round_trips_through_fetch_and_replay_reads_it(self) -> None:
        out = build(self.data, VERSION, CREATED)
        with tarfile.open(out) as tar:
            self.assertEqual(tar.getnames(), MEMBERS)
        unpacked = self.data / "unpacked"
        unpack(out, unpacked)
        check_manifest(unpacked, VERSION)
        manifest = json.loads((unpacked / "manifest.json").read_text())
        self.assertEqual(manifest["created_at"], "2026-10-18T22:00:00+00:00")
        self.assertEqual(manifest["files"]["predictions.jsonl"]["lines"], 48)
        self.assertEqual(lookup([unpacked / "llm_cache"], KEY), CALL)

    def test_two_builds_of_the_same_files_give_the_same_bytes(self) -> None:
        first = sha256_of(build(self.data, VERSION, CREATED))
        self.assertEqual(sha256_of(build(self.data, VERSION, CREATED)), first)

    def refused(self) -> str:
        with self.assertRaises(BundleError) as raised:
            build(self.data, VERSION, CREATED)
        return str(raised.exception)

    def test_a_line_that_breaks_its_contract_is_refused(self) -> None:
        (self.data / "bundle/profiles.jsonl").write_text(line({"id": "person-x"}))
        self.assertTrue(self.refused().startswith("Refusing profiles.jsonl:1: $: "))

    def test_a_missing_file_is_named(self) -> None:
        (self.data / "bundle/terms.jsonl").unlink()
        self.assertTrue(self.refused().startswith("Refusing to build: terms.jsonl is missing"))

    def test_predictions_must_cover_every_gold_id(self) -> None:
        predictions = self.data / "eval/predictions.jsonl"
        predictions.write_text("".join(predictions.read_text().splitlines(keepends=True)[1:]))
        self.assertIn("(47 lines for 48 gold ids)", self.refused())

    def test_a_short_vector_and_a_bad_version_are_refused(self) -> None:
        (self.data / "bundle/vectors.jsonl").write_text(
            line({"id": "x", "kind": "profile", "vector": [0.1]})
        )
        self.assertIn("Refusing vectors.jsonl:1", self.refused())
        with self.assertRaises(BundleError):
            build(self.data, "bundle-latest", CREATED)


if __name__ == "__main__":
    unittest.main()
