import json
import shutil
import tempfile
import unittest
from pathlib import Path

from infra.check_hosted import Expected, expected_from, problems

EXPECTED = Expected("bundle-20261019-1", 120, 45)
SERVING = {
    "mode": "replay",
    "models": {"embed": "intfloat/multilingual-e5-small"},
    "snapshot": "bundle-20261019-1",
    "counts": {"pages": 120, "profiles": 45, "sources": 3},
}
FIXTURES = {
    "mode": "mock",
    "models": {"expand": "MOCK-no-model"},
    "snapshot": "fixture",
    "counts": {"pages": 2, "profiles": 2, "sources": 1},
}


class ExpectedFromTest(unittest.TestCase):
    def test_reads_the_lock_version_and_the_manifest_line_counts(self):
        folder = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, folder, ignore_errors=True)
        (folder / "bundle.lock").write_text(json.dumps({"version": "bundle-20261019-1"}))
        files = {
            "pages.jsonl": {"sha256": "a" * 64, "lines": 120},
            "profiles.jsonl": {"sha256": "b" * 64, "lines": 45},
            "vectors.jsonl": {"sha256": "c" * 64, "lines": 300},
        }
        manifest = {"version": "bundle-20261019-1", "files": files}
        (folder / "manifest.json").write_text(json.dumps(manifest))

        self.assertEqual(expected_from(folder / "bundle.lock", folder / "manifest.json"), EXPECTED)


class ProblemsTest(unittest.TestCase):
    def test_the_installed_bundle_in_replay_passes(self):
        self.assertEqual(problems(SERVING, EXPECTED), [])

    def test_the_demo_fixtures_fail_on_every_field(self):
        self.assertEqual(
            problems(FIXTURES, EXPECTED),
            [
                "mode is 'mock', expected 'replay'",
                "snapshot is 'fixture', expected 'bundle-20261019-1'",
                "pages is 2, expected 120",
                "profiles is 2, expected 45",
            ],
        )

    def test_a_half_loaded_database_fails_on_its_counts(self):
        body = {**SERVING, "counts": {"pages": 120, "profiles": 44, "sources": 3}}
        self.assertEqual(problems(body, EXPECTED), ["profiles is 44, expected 45"])

    def test_an_engine_error_marker_fails(self):
        self.assertEqual(
            problems({"error": "engine_unavailable"}, EXPECTED),
            [
                "mode is None, expected 'replay'",
                "snapshot is None, expected 'bundle-20261019-1'",
                "pages is None, expected 120",
                "profiles is None, expected 45",
            ],
        )

    def test_no_answer_fails(self):
        self.assertEqual(problems(None, EXPECTED), ["/api/health did not answer with JSON"])


if __name__ == "__main__":
    unittest.main()
