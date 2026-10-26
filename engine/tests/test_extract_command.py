import io
import json
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from dataclasses import asdict, replace
from pathlib import Path

from bernlife.extract_command import main, map_twins_last
from extract_fakes import ADA_PAGE, LAB_PAGE, PAGES, REPLIES, TEAM_PAGE, page
from fake_llm import FakeTransport, chat_body, models_body

MODEL_70B = "swiss-ai/Apertus-70B-Instruct-2509"
IFIK = "https://www.ifik.unibe.ch/forschung"
NEURO = "https://www.neuroscience.unibe.ch/research/research_groups"
LAB_TEXT = "Institut für Infektionskrankheiten\nForschung\nExample Lab - Ada Muster\nWe study."
EXAMPLE_LAB = page(
    f"{IFIK}/example_lab___ada_muster/index_ger.html",
    "Forschung: Example Lab - Ada Muster - Institut für Infektionskrankheiten",
    LAB_TEXT,
    "other",
    "de",
)
SEMINARS = page(f"{IFIK}/seminare/index_ger.html", "Forschung: Seminare", "Seminare\n2026", "other")
NEURO_LAB = page(f"{NEURO}/example_lab", "Research: Example Lab", "Example Lab\nSleep.", "other")
NEURO_TWIN = replace(NEURO_LAB, url=f"{NEURO}/example_lab/")


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

    def test_list_kinds_prints_what_the_source_files_would_change_and_calls_nothing(self):
        stored = (NEURO_TWIN, SEMINARS, EXAMPLE_LAB, NEURO_LAB)
        lines = "".join(json.dumps(asdict(p) | {"status": 200}) + "\n" for p in stored)
        (self.bundle / "pages.jsonl").write_text(lines)
        env = self.env(BERNLIFE_BACKEND="live", LLM_BASE_URL="http://127.0.0.1:9/v1")
        transport = FakeTransport()
        code, out, err = self.run_main(["--list-kinds"], env, transport)
        self.assertEqual((code, err), (0, ""))
        self.assertEqual(
            out,
            f"{EXAMPLE_LAB.url}  other -> unit\n"
            f"{NEURO_LAB.url}  other -> unit\n"
            f"{NEURO_TWIN.url}  other -> unit\n"
            "3 pages change kind: other -> unit 3\n"
            "model windows for them: 2 (2 distinct texts)\n",
        )
        self.assertEqual(transport.requests, [])
        self.assertFalse((self.bundle / "profiles.jsonl").exists())

    def test_a_page_with_the_text_of_an_earlier_one_is_mapped_in_a_second_round(self):
        rounds: list[list[str]] = []

        def map_round(call, pages):
            batch = list(pages)
            rounds.append([p.url for p in batch])
            return map(call, batch)

        pages = [ADA_PAGE, NEURO_LAB, NEURO_TWIN, LAB_PAGE, TEAM_PAGE]
        outcomes = list(map_twins_last(map_round, lambda p: p.url, pages))
        self.assertEqual(
            rounds,
            [[ADA_PAGE.url, NEURO_LAB.url, LAB_PAGE.url, TEAM_PAGE.url], [NEURO_TWIN.url]],
        )
        self.assertEqual(outcomes, rounds[0] + [NEURO_TWIN.url])


if __name__ == "__main__":
    unittest.main()
