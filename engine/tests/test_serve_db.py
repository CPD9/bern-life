"""Health, sources and numbers served from the migrated database over the invented bundle.

Runs inside a rolled-back transaction on emptied tables, with no model connected.
"""

import itertools
import json
import tempfile
import threading
import unittest
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

from bernlife.cache import append_audit
from bernlife.database import connect
from bernlife.embed import MODEL_ID
from bernlife.llm import MOCK_MODEL, ROLES, MockLLM
from bernlife.load_command import load
from bernlife.serve_command import EngineApi
from bernlife.server import make_server
from bernlife.store import PostgresStore
from contract_schemas import validator
from search_fakes import SOURCES, fake_embedder, truncate_all, write_bundle
from test_numbers import entry, write_pack

from db import database_url

NOW = datetime(2026, 10, 19, 4, 0, tzinfo=UTC)
AUDIT_LINES = [
    {"ts": "2026-10-18T14:00:00+00:00", "role": "extract", "outcome": "live", "ms": 1200},
    {"ts": "2026-10-19T03:00:00+00:00", "role": "expand", "outcome": "hit", "ms": 0},
    {"ts": "2026-10-19T03:00:01+00:00", "role": "explain", "outcome": "timeout", "ms": 60000},
]


class ServeDbTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.conn = connect(database_url())

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def setUp(self):
        folder = Path(tempfile.mkdtemp())
        write_bundle(folder / "bundle")
        write_pack(folder / "llm_cache", [entry("explain", 300), entry("explain", 100)])
        for line in AUDIT_LINES:
            append_audit(folder / "audit", {**line, "model": "fake-70b", "key": "ab" * 32})
        transaction = self.conn.transaction(force_rollback=True)
        transaction.__enter__()
        self.addCleanup(transaction.__exit__, None, None, None)
        truncate_all(self.conn)
        self.assertEqual(load(self.conn, folder / "bundle", SOURCES), [])
        self.snapshot = PostgresStore(self.conn).snapshot()
        api = EngineApi(
            self.conn,
            fake_embedder(),
            MockLLM(),
            configured=SOURCES,
            recorded=folder / "llm_cache",
            audit_root=folder / "audit",
            clock=itertools.count(100.0, 5.4).__next__,
            now=lambda: NOW,
        )
        server = make_server(api, 0)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        self.base = f"http://127.0.0.1:{server.server_address[1]}"

    def get(self, path: str) -> dict:
        with urllib.request.urlopen(self.base + path) as response:
            return json.loads(response.read())

    def test_health_adds_status_and_uptime_to_the_counts(self):
        self.assertEqual(
            self.get("/api/health"),
            {
                "mode": "mock",
                "models": {**dict.fromkeys(ROLES, MOCK_MODEL), "embed": MODEL_ID},
                "snapshot": self.snapshot,
                "counts": {"pages": 5, "profiles": 7, "sources": 2},
                "status": "ok",
                "uptime_s": 5,
                "failures_last_hour": {},
            },
        )

    def test_sources_and_numbers_of_the_loaded_snapshot(self):
        sources = self.get("/api/sources")
        self.assertEqual(
            (
                sources["snapshot"],
                [(s["id"], s["pages"], s["profiles"]) for s in sources["sources"]],
            ),
            (self.snapshot, [("demo", 2, 3), ("example", 3, 4)]),
        )
        self.assertEqual(
            self.get("/api/numbers"),
            {
                "snapshot": self.snapshot,
                "generated_at": "2026-10-19T04:00:00Z",
                "eval": None,
                "models": [
                    {
                        "role": "explain",
                        "model": "fake-70b",
                        "calls": 2,
                        "ok": 2,
                        "median_ms": 100,
                        "p95_ms": 300,
                    }
                ],
            },
        )

    def test_admin_activity_summarises_the_audit_with_no_budget_when_nothing_is_live(self):
        self.assertEqual(
            self.get("/api/admin/activity"),
            {
                "today": "2026-10-19",
                "live_today": 1,
                "budget": None,
                "days": [
                    {
                        "day": "2026-10-19",
                        "calls": 2,
                        "by_role": {"expand": 1, "explain": 1},
                        "by_outcome": {"hit": 1, "timeout": 1},
                        "failures": {"timeout": 1},
                    },
                    {
                        "day": "2026-10-18",
                        "calls": 1,
                        "by_role": {"extract": 1},
                        "by_outcome": {"live": 1},
                        "failures": {},
                    },
                ],
                "failures": {"timeout": 1},
            },
        )

    def test_admin_flagged_checks_every_person_of_the_snapshot(self):
        self.assertEqual(
            self.get("/api/admin/flagged"),
            {"snapshot": self.snapshot, "checked": 5, "people": []},
        )

    def test_an_agent_turn_without_a_model_answers_from_search(self):
        body = json.dumps({"messages": [{"role": "user", "content": "glucose monitoring"}]})
        request = urllib.request.Request(self.base + "/api/agent", data=body.encode())
        with urllib.request.urlopen(request) as response:
            reply = json.loads(response.read())
        self.assertEqual(list(validator("agent.schema.json").iter_errors(reply)), [])
        self.assertEqual(
            (reply["mode"], reply["results"][0]["results"][0]["profile"]["id"]),
            ("mock", "person-example-ada-muster"),
        )

    def test_a_place_lists_the_people_whose_page_is_on_its_host(self):
        body = self.get("/api/places/example/www.example-institute.test/people")
        self.assertEqual(list(validator("place-people.schema.json").iter_errors(body)), [])
        names = [person["name"]["value"] for person in body["people"]]
        self.assertIn("Ada Muster", names)
        self.assertEqual(names, sorted(names))
        self.assertEqual(
            {(person["kind"], person["source_id"]) for person in body["people"]},
            {("person", "example")},
        )
        self.assertTrue(
            all(
                p["source_url"].startswith("https://www.example-institute.test/")
                for p in body["people"]
            )
        )
        self.assertEqual((body["snapshot"], body["total"]), (self.snapshot, len(names)))

    def test_a_place_without_profiles_lists_nobody(self):
        self.assertEqual(
            self.get("/api/places/demo/www.example-institute.test/people"),
            {"snapshot": self.snapshot, "people": [], "total": 0},
        )

    def test_the_bodies_validate_against_their_contracts(self):
        for path, contract, requires in (
            ("/api/health", "health.schema.json", "status"),
            ("/api/sources", "sources.schema.json", None),
            ("/api/numbers", "numbers.schema.json", None),
            ("/api/admin/activity", "admin-activity.schema.json", None),
            ("/api/admin/flagged", "admin-flagged.schema.json", None),
        ):
            with self.subTest(path=path):
                errors = list(validator(contract, requires).iter_errors(self.get(path)))
                self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main()
