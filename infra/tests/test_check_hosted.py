import io
import json
import shutil
import tempfile
import unittest
import urllib.error
import urllib.response
from email.message import Message
from pathlib import Path

from infra.check_hosted import Answer, Expected, ask, expected_from, problems

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
URL = "https://demo.example.test"
# web/infrastructure/engine-response.ts answers an engine failure with this body and HTTP 502.
ENGINE_ERROR = b'{"error":"engine_error"}'


def served(status: int, body: bytes):
    """A fake urlopen: a response on 200, and the HTTPError urlopen raises for any other status."""
    opened: list[str] = []

    def open_url(url: str):
        opened.append(url)
        if status == 200:
            return urllib.response.addinfourl(io.BytesIO(body), Message(), url, status)
        raise urllib.error.HTTPError(url, status, "Bad Gateway", Message(), io.BytesIO(body))

    return open_url, opened


def unreachable(url: str):
    raise urllib.error.URLError("connection refused")


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


class AskTest(unittest.TestCase):
    def test_a_success_gives_its_status_and_body(self):
        open_url, opened = served(200, json.dumps(SERVING).encode())
        self.assertEqual(ask(URL, open_url), Answer(200, SERVING))
        self.assertEqual(opened, [URL])

    def test_an_engine_error_gives_the_502_and_the_web_routes_marker(self):
        open_url, _ = served(502, ENGINE_ERROR)
        self.assertEqual(ask(URL, open_url), Answer(502, {"error": "engine_error"}))

    def test_a_body_that_is_not_json_is_none(self):
        open_url, _ = served(502, b"<html>Bad Gateway</html>")
        self.assertEqual(ask(URL, open_url), Answer(502, None))

    def test_no_connection_is_no_answer(self):
        self.assertEqual(ask(URL, unreachable), Answer(None, None))


class ProblemsTest(unittest.TestCase):
    def test_the_installed_bundle_in_replay_passes(self):
        self.assertEqual(problems(Answer(200, SERVING), EXPECTED), [])

    def test_the_demo_fixtures_fail_on_every_field(self):
        self.assertEqual(
            problems(Answer(200, FIXTURES), EXPECTED),
            [
                "mode is 'mock', expected 'replay'",
                "snapshot is 'fixture', expected 'bundle-20261019-1'",
                "pages is 2, expected 120",
                "profiles is 2, expected 45",
            ],
        )

    def test_a_half_loaded_database_fails_on_its_counts(self):
        body = {**SERVING, "counts": {"pages": 120, "profiles": 44, "sources": 3}}
        self.assertEqual(problems(Answer(200, body), EXPECTED), ["profiles is 44, expected 45"])

    def test_the_web_routes_engine_error_fails_with_its_status_and_marker(self):
        open_url, _ = served(502, ENGINE_ERROR)
        self.assertEqual(
            problems(ask(URL, open_url), EXPECTED),
            ["/api/health answered HTTP 502 with error 'engine_error'"],
        )

    def test_an_error_status_without_json_fails(self):
        self.assertEqual(
            problems(Answer(502, None), EXPECTED),
            ["/api/health answered HTTP 502 with error None"],
        )

    def test_a_success_that_is_not_json_fails(self):
        self.assertEqual(
            problems(Answer(200, None), EXPECTED), ["/api/health did not answer with JSON"]
        )

    def test_no_answer_fails(self):
        self.assertEqual(problems(Answer(None, None), EXPECTED), ["/api/health did not answer"])


if __name__ == "__main__":
    unittest.main()
