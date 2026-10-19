"""The live gate end to end: the server's handler, EngineApi and a Router from connect(serving=True)
over a temporary cache, with a fake model endpoint behind it.

Search runs for real on the invented bundle, so its expansion and explain's worker threads are on
the path. Runs inside a rolled-back transaction on emptied tables.
"""

import json
import tempfile
import threading
import unittest
import urllib.request
from pathlib import Path

from bernlife.cache import audit_records, cache_roots
from bernlife.database import connect
from bernlife.llm import connect as connect_model
from bernlife.load_command import load
from bernlife.serve_command import EngineApi
from bernlife.server import make_server
from fake_llm import FakeTransport, chat_body, models_body
from search_fakes import SOURCES, fake_embedder, truncate_all, write_bundle

from db import database_url

MODEL = "swiss-ai/Apertus-v1.5-70B"
EXPANSION = {
    "topics": [
        {
            "topic": "glucose monitoring",
            "terms": [{"term": "Glukosemessung", "kind": "translation", "lang": "de"}],
        }
    ]
}
EXPLAINED = 2


class ServeGateTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.conn = connect(database_url())

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        data = Path(folder.name)
        write_bundle(data / "snapshot")
        transaction = self.conn.transaction(force_rollback=True)
        transaction.__enter__()
        self.addCleanup(transaction.__exit__, None, None, None)
        truncate_all(self.conn)
        self.assertEqual(load(self.conn, data / "snapshot", SOURCES), [])
        self.transport = FakeTransport(models_body(MODEL), chat_body(json.dumps(EXPANSION)))
        env = {
            "BERNLIFE_DATA_DIR": str(data),
            "LLM_BASE_URL": "https://gateway.example/v1",
            "LLM_MODEL": MODEL,
            "LLM_CALL_BUDGET": "1",
        }
        self.cache = cache_roots(data)[0]
        llm = connect_model(env, self.transport, serving=True)
        api = EngineApi(self.conn, fake_embedder(), llm, recorded=cache_roots(data)[1])
        server = make_server(api, 0)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        self.base = f"http://127.0.0.1:{server.server_address[1]}"

    def search(self, query: str, headers: dict[str, str]) -> dict:
        """The search's request log line; the response itself must be a 200."""
        body = json.dumps({"query": query}).encode()
        request = urllib.request.Request(self.base + "/api/search", data=body, headers=headers)
        with (
            self.assertLogs("bernlife.server", "INFO") as logs,
            urllib.request.urlopen(request) as response,
        ):
            self.assertEqual(response.status, 200)
        (line,) = [json.loads(record.getMessage()) for record in logs.records]
        return line

    def model_calls(self) -> int:
        return sum(url.endswith("/chat/completions") for url, _ in self.transport.requests)

    def audit(self) -> list[tuple[str, str]]:
        return [(record["role"], record["outcome"]) for record in audit_records(self.cache)]

    def health(self) -> dict:
        with urllib.request.urlopen(self.base + "/api/health") as response:
            return json.loads(response.read())

    def test_a_request_not_marked_live_never_reaches_the_model(self):
        line = self.search("glucose monitoring", {})
        self.assertEqual(self.model_calls(), 0)
        self.assertEqual(self.audit(), [("expand", "miss"), *[("explain", "miss")] * EXPLAINED])
        self.assertEqual(
            (line["mode"], line["live_allowed"], line["cache"]),
            ("replay", False, {"hits": 0, "misses": 1 + EXPLAINED, "live": 0, "failures": 0}),
        )
        self.assertEqual(self.health()["budget"], {"limit": 1, "used": 0})

    def test_a_live_request_spends_the_budget_and_the_next_miss_is_refused(self):
        line = self.search("glucose monitoring", {"X-Bernlife-Live": "1"})
        self.assertEqual(self.model_calls(), 1)
        self.assertEqual(self.audit(), [("expand", "live"), *[("explain", "budget")] * EXPLAINED])
        self.assertEqual(
            (line["mode"], line["live_allowed"], line["cache"]),
            ("live", True, {"hits": 0, "misses": EXPLAINED, "live": 1, "failures": 0}),
        )
        self.search("insulin pumps", {"X-Bernlife-Live": "1"})
        self.assertEqual(self.model_calls(), 1)
        self.assertEqual(self.audit()[1 + EXPLAINED], ("expand", "budget"))
        health = self.health()
        self.assertEqual(
            (health["status"], health["budget"]), ("degraded", {"limit": 1, "used": 1})
        )


if __name__ == "__main__":
    unittest.main()
