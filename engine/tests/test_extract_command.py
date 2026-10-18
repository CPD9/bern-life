import io
import json
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from dataclasses import asdict
from pathlib import Path

from bernlife.extract_command import main
from extract_fakes import PAGES, REPLIES
from fake_llm import FakeTransport, chat_body, models_body

MODEL_70B = "swiss-ai/Apertus-70B-Instruct-2509"


class ExtractCommandTest(unittest.TestCase):
    def setUp(self):
        self.data = Path(tempfile.mkdtemp())
        self.bundle = self.data / "bundle"
        self.bundle.mkdir()
        lines = "".join(json.dumps(asdict(page) | {"status": 200}) + "\n" for page in PAGES)
        (self.bundle / "pages.jsonl").write_text(lines)

    def env(self, **extra: str) -> dict[str, str]:
        return {"BERNLIFE_DATA_DIR": str(self.data), "LLM_MAX_CONCURRENCY": "1", **extra}

    def run_main(self, argv, env, transport=None) -> tuple[int, str, str]:
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            code = main(argv, env, transport or FakeTransport())
        return code, out.getvalue(), err.getvalue()

    def outputs(self) -> tuple[bytes, bytes]:
        return (self.bundle / "profiles.jsonl").read_bytes(), (
            self.bundle / "relations.jsonl"
        ).read_bytes()

    def test_mock_runs_selectors_only_and_writes_the_same_bytes_twice(self):
        code, out, _ = self.run_main([], self.env(BERNLIFE_BACKEND="mock"))
        first = self.outputs()
        self.assertEqual(code, 0)
        self.assertIn("model: MOCK, selectors only; 0 pages, 0 calls", out)
        profiles = [json.loads(line) for line in first[0].decode().splitlines()]
        self.assertEqual(
            [p["id"] for p in profiles],
            [
                "person-example-ada-muster",
                "person-example-dora-demo",
                "unit-example-example-institute-for-engineering",
                "unit-example-sensor-lab",
            ],
        )
        self.assertEqual(
            {c["method"] for p in profiles for f in p["fields"].values() for c in f}, {"selector"}
        )
        self.run_main([], self.env(BERNLIFE_BACKEND="mock"))
        self.assertEqual(self.outputs(), first)

    def test_other_sources_lines_are_kept(self):
        other = {"id": "person-other-zoe-zett", "source_id": "other"}
        (self.bundle / "profiles.jsonl").write_text(json.dumps(other) + "\n")
        self.run_main(["--source", "example"], self.env(BERNLIFE_BACKEND="mock"))
        ids = [json.loads(line)["id"] for line in self.outputs()[0].decode().splitlines()]
        self.assertEqual(
            ids,
            [
                "person-example-ada-muster",
                "person-example-dora-demo",
                "person-other-zoe-zett",
                "unit-example-example-institute-for-engineering",
                "unit-example-sensor-lab",
            ],
        )

    def test_live_refuses_a_model_that_is_not_the_70b(self):
        env = self.env(BERNLIFE_BACKEND="live", LLM_BASE_URL="http://127.0.0.1:9/v1")
        transport = FakeTransport(models_body("swiss-ai/Apertus-8B-Instruct-2509"))
        code, _, err = self.run_main([], env, transport)
        self.assertEqual(code, 2)
        self.assertEqual(
            err, "extract: needs the 70B, the endpoint serves swiss-ai/Apertus-8B-Instruct-2509\n"
        )
        self.assertFalse((self.bundle / "profiles.jsonl").exists())

    def test_live_call_is_cached_and_replayed_without_the_model(self):
        env = self.env(BERNLIFE_BACKEND="live", LLM_BASE_URL="http://127.0.0.1:9/v1")
        reply = json.dumps(REPLIES["Cara Probst"])
        live = FakeTransport(models_body(MODEL_70B), chat_body(reply))
        code, out, _ = self.run_main(["--kinds", "listing"], env, live)
        self.assertEqual(code, 0)
        self.assertIn(f"model: live {MODEL_70B}; 1 pages, 1 calls, 0 answered from the cache", out)
        self.assertIn('"value": "Lab Manager", "method": "model"', self.outputs()[0].decode())
        written = self.outputs()
        code, out, _ = self.run_main(["--kinds", "listing"], self.env(BERNLIFE_BACKEND="replay"))
        self.assertIn(
            f"model: replay {MODEL_70B}; 1 pages, 1 calls, 1 answered from the cache", out
        )
        self.assertEqual(self.outputs(), written)

    def test_no_pages_is_an_error(self):
        (self.bundle / "pages.jsonl").unlink()
        code, _, err = self.run_main([], self.env(BERNLIFE_BACKEND="mock"))
        self.assertEqual((code, err.startswith("extract: no pages in")), (2, True))


if __name__ == "__main__":
    unittest.main()
