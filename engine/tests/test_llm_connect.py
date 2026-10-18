import json
import tempfile
import unittest
import urllib.error
from pathlib import Path

from bernlife.cache import CacheMiss, cache_roots, write_json
from bernlife.config import ConfigError, data_dir, llm_endpoint, max_concurrency
from bernlife.llm import ROLES, MockLLM, Router, connect
from bernlife.llm_http import ModelUnavailable
from fake_llm import FakeTransport, models_body

LARGE = "swiss-ai/Apertus-v1.5-70B"
SMALL = "swiss-ai/Apertus-v1.5-8B"
BOTH_ROUTES = {
    "LLM_BASE_URL": "https://small.example/v1",
    "LLM_API_KEY": "small-key",
    "LLM_MODEL": SMALL,
    "EXPAND_LLM_BASE_URL": "https://large.example/v1/",
    "EXPAND_LLM_API_KEY": "large-key",
    "EXPAND_LLM_MODEL": LARGE,
}


def unreachable() -> FakeTransport:
    return FakeTransport(urllib.error.URLError(ConnectionRefusedError()))


class ConnectTest(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.env = {"BERNLIFE_DATA_DIR": tmp.name}
        self.roots = cache_roots(Path(tmp.name))

    def test_every_role_takes_the_large_route_when_it_is_set(self) -> None:
        transport = FakeTransport(models_body(SMALL, LARGE))
        llm = connect(self.env | BOTH_ROUTES, transport)
        self.assertIsInstance(llm, Router)
        self.assertEqual((llm.backend, llm.models()), ("live", dict.fromkeys(ROLES, LARGE)))
        self.assertEqual(
            transport.requests, [("https://large.example/v1/models", "Bearer large-key")]
        )
        recorded = json.loads((self.roots[0] / "models.json").read_text())
        self.assertEqual(recorded, dict.fromkeys(ROLES, LARGE))

    def test_small_route_only_when_the_large_one_is_unset(self) -> None:
        small_only = {k: v for k, v in BOTH_ROUTES.items() if not k.startswith("EXPAND_")}
        transport = FakeTransport(models_body(SMALL, LARGE))
        llm = connect(self.env | small_only, transport)
        self.assertEqual(llm.models(), dict.fromkeys(ROLES, SMALL))
        self.assertEqual(
            transport.requests, [("https://small.example/v1/models", "Bearer small-key")]
        )

    def test_configured_model_must_be_served(self) -> None:
        with self.assertRaises(ModelUnavailable) as raised:
            connect(self.env | BOTH_ROUTES, FakeTransport(models_body(SMALL)))
        self.assertEqual(str(raised.exception), "model_not_served")

    def test_single_served_model_is_used_when_none_is_configured(self) -> None:
        env = self.env | {"LLM_BASE_URL": "http://127.0.0.1:8002/v1"}
        llm = connect(env, FakeTransport(models_body("apertus-70b-fp8")))
        self.assertEqual(llm.models(), dict.fromkeys(ROLES, "apertus-70b-fp8"))

    def test_unanswered_endpoint_falls_back_to_replay_then_mock(self) -> None:
        self.assertIsInstance(connect(self.env | BOTH_ROUTES, unreachable()), MockLLM)
        write_json(self.roots[1] / "models.json", dict.fromkeys(ROLES, LARGE))
        llm = connect(self.env | BOTH_ROUTES, unreachable())
        self.assertEqual((llm.backend, llm.models()), ("replay", dict.fromkeys(ROLES, LARGE)))

    def test_forced_live_never_falls_back(self) -> None:
        live = self.env | {"BERNLIFE_BACKEND": "live"}
        with self.assertRaises(ModelUnavailable) as raised:
            connect(live | BOTH_ROUTES, unreachable())
        self.assertEqual(str(raised.exception), "unreachable")
        with self.assertRaises(ConfigError):
            connect(live, FakeTransport())

    def test_forced_replay_without_a_record_raises(self) -> None:
        with self.assertRaises(CacheMiss):
            connect(self.env | {"BERNLIFE_BACKEND": "replay"}, FakeTransport())

    def test_forced_mock_makes_no_request(self) -> None:
        transport = FakeTransport()
        llm = connect(self.env | BOTH_ROUTES | {"BERNLIFE_BACKEND": "MOCK"}, transport)
        self.assertIsInstance(llm, MockLLM)
        self.assertEqual(transport.requests, [])


class ConfigTest(unittest.TestCase):
    def test_endpoint_repr_hides_the_key(self) -> None:
        endpoint = llm_endpoint(BOTH_ROUTES)
        self.assertEqual(
            repr(endpoint),
            f"Endpoint(base_url='https://large.example/v1', model='{LARGE}')",
        )

    def test_data_dir_is_the_setting_else_data_under_the_working_directory(self) -> None:
        self.assertEqual(data_dir({}), Path.cwd() / "data")
        self.assertEqual(
            data_dir({"BERNLIFE_DATA_DIR": "~/bern-life-data"}), Path.home() / "bern-life-data"
        )

    def test_bad_values_are_refused_by_name(self) -> None:
        with self.assertRaisesRegex(ConfigError, "BERNLIFE_BACKEND"):
            connect({"BERNLIFE_BACKEND": "gpu"}, FakeTransport())
        for raw in ("0", "four", "-1"):
            with self.subTest(raw=raw), self.assertRaisesRegex(ConfigError, "LLM_MAX_CONCURRENCY"):
                max_concurrency({"LLM_MAX_CONCURRENCY": raw})
        self.assertEqual(max_concurrency({}), 4)


if __name__ == "__main__":
    unittest.main()
