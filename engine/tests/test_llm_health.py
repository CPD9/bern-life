import io
import json
import tempfile
import unittest
import urllib.error
from contextlib import redirect_stderr, redirect_stdout

from bernlife.health import main
from bernlife.llm import ROLES
from fake_llm import FakeTransport, models_body

KEY = "sk-test-never-printed"
LARGE = "swiss-ai/Apertus-v1.5-70B"


class HealthTest(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.env = {"BERNLIFE_DATA_DIR": tmp.name, "LLM_API_KEY": KEY}

    def run_health(self, env: dict[str, str], transport: FakeTransport) -> tuple[int, str, str]:
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            code = main([], env, transport)
        return code, out.getvalue(), err.getvalue()

    def test_mock_health_works_offline(self) -> None:
        transport = FakeTransport()
        code, out, _ = self.run_health(self.env | {"BERNLIFE_BACKEND": "mock"}, transport)
        expected = {
            "cache": {"files": 0, "pack": 0},
            "mode": "mock",
            "models": dict.fromkeys(ROLES, "MOCK-no-model"),
        }
        self.assertEqual((code, out), (0, json.dumps(expected, indent=2, sort_keys=True) + "\n"))
        self.assertEqual(transport.requests, [])

    def test_live_health_names_models_never_keys_or_urls(self) -> None:
        env = self.env | {"LLM_BASE_URL": "https://gateway.example/v1", "LLM_MODEL": LARGE}
        code, out, _ = self.run_health(env, FakeTransport(models_body(LARGE)))
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out)["models"], dict.fromkeys(ROLES, LARGE))
        self.assertEqual(json.loads(out)["mode"], "live")
        self.assertNotIn(KEY, out)
        self.assertNotIn("gateway.example", out)

    def test_forced_live_without_an_answer_prints_the_marker(self) -> None:
        env = self.env | {"BERNLIFE_BACKEND": "live", "LLM_BASE_URL": "https://gateway.example/v1"}
        refused = FakeTransport(urllib.error.URLError(ConnectionRefusedError(KEY)))
        self.assertEqual(self.run_health(env, refused), (1, "", "health: unreachable\n"))

    def test_arguments_are_refused(self) -> None:
        err = io.StringIO()
        with redirect_stderr(err):
            code = main(["--verbose"], self.env, FakeTransport())
        self.assertEqual((code, err.getvalue()), (2, "usage: python -m bernlife health\n"))


if __name__ == "__main__":
    unittest.main()
