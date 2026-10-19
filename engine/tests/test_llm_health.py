import io
import json
import tempfile
import unittest
import urllib.error
from contextlib import redirect_stderr, redirect_stdout

from bernlife.health import main, service_health
from bernlife.llm import ROLES
from contract_schemas import validator
from fake_llm import FakeTransport, models_body

KEY = "sk-test-never-printed"
LARGE = "swiss-ai/Apertus-v1.5-70B"
SERVED = {
    "mode": "live",
    "models": {"explain": LARGE},
    "snapshot": "local-abc",
    "counts": {"pages": 4, "profiles": 5, "sources": 2},
}


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


class ServiceHealthTest(unittest.TestCase):
    def test_ok_without_failures_and_with_calls_left(self) -> None:
        health = service_health(SERVED, 42, {}, {"limit": 50, "used": 49})
        self.assertEqual(
            health,
            SERVED
            | {
                "status": "ok",
                "uptime_s": 42,
                "failures_last_hour": {},
                "budget": {"limit": 50, "used": 49},
            },
        )

    def test_degraded_while_a_call_failed_in_the_last_hour(self) -> None:
        replay = SERVED | {"mode": "replay"}
        failures = {"explain": {"timeout": 2}, "expand": {}}
        self.assertEqual(
            service_health(replay, 7, failures, None),
            replay
            | {
                "status": "degraded",
                "uptime_s": 7,
                "failures_last_hour": {"explain": {"timeout": 2}},
            },
        )

    def test_degraded_when_a_live_engine_used_up_todays_calls(self) -> None:
        self.assertEqual(
            service_health(SERVED, 0, {}, {"limit": 50, "used": 50})["status"], "degraded"
        )
        self.assertEqual(service_health(SERVED | {"mode": "mock"}, 0, {}, None)["status"], "ok")

    def test_the_added_fields_validate_against_the_contract(self) -> None:
        health = service_health(SERVED, 3, {"brief": {"budget": 1}}, {"limit": 5, "used": 5})
        schema = validator("health.schema.json", requires="status")
        self.assertEqual(list(schema.iter_errors(health)), [])


if __name__ == "__main__":
    unittest.main()
