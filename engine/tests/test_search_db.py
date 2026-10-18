"""Search over the invented bundle in the migrated database, through the engine API.

Runs inside a rolled-back transaction on emptied tables, with the word-hashing encoder.
"""

import json
import tempfile
import threading
import unittest
import urllib.request
from pathlib import Path

from bernlife.database import connect
from bernlife.load_command import load
from bernlife.search import PostgresStore, search
from bernlife.serve_command import EngineApi
from bernlife.server import make_server
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from search_fakes import SOURCES, fake_embedder, truncate_all, write_bundle

from db import database_url

CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"


def result_validator() -> Draft202012Validator:
    resources = [
        (path.name, Resource.from_contents(json.loads(path.read_text())))
        for path in sorted(CONTRACTS.glob("*.schema.json"))
    ]
    registry = Registry().with_resources(resources)
    return Draft202012Validator(registry.contents("result.schema.json"), registry=registry)


class SearchDbTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.conn = connect(database_url())

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def setUp(self):
        folder = Path(tempfile.mkdtemp())
        write_bundle(folder)
        transaction = self.conn.transaction(force_rollback=True)
        transaction.__enter__()
        self.addCleanup(transaction.__exit__, None, None, None)
        truncate_all(self.conn)
        self.assertEqual(load(self.conn, folder, SOURCES), [])
        self.store = PostgresStore(self.conn)

    def ids(self, query: str, sources: list[str] | None = None) -> list[str]:
        response = search(query, sources, self.store, fake_embedder())
        return [result["profile"]["id"] for result in response["results"]]

    def test_api_search_validates_against_the_contract_and_repeats_byte_for_byte(self):
        server = make_server(EngineApi(self.conn, fake_embedder()), 0)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        url = f"http://127.0.0.1:{server.server_address[1]}/api/search"
        bodies = []
        for _ in range(2):
            request = urllib.request.Request(url, data=b'{"query": "glucose monitoring"}')
            with urllib.request.urlopen(request) as response:
                bodies.append(response.read())
        self.assertEqual(bodies[0], bodies[1])
        payload = json.loads(bodies[0])
        self.assertEqual(list(result_validator().iter_errors(payload)), [])
        self.assertEqual(payload["results"][0]["profile"]["id"], "person-example-ada-muster")
        self.assertEqual(payload["results"][0]["score"]["lexical_rank"], 1)
        self.assertEqual(
            (payload["mode"], payload["abstained"], payload["versions"]["prompts"]),
            ("mock", False, "none"),
        )

    def test_the_source_filter_applies_inside_the_scans(self):
        self.assertEqual(self.ids("glucose", ["demo"]), ["person-demo-cleo-beispiel"])

    def test_a_passage_credits_the_people_whose_evidence_it_holds(self):
        found = self.ids("skin-worn patch")
        self.assertEqual(
            found[:3],
            [
                "person-example-ada-muster",
                "person-example-ben-beispiel",
                "project-example-glucopatch",
            ],
        )

    def test_an_invented_titled_name_abstains(self):
        response = search(
            "What does Prof. Hugo Brandtner publish on glucose?", None, self.store, fake_embedder()
        )
        self.assertEqual(
            (response["abstained"], response["abstain_reason"], response["results"]),
            (True, "no_verifiable_source", []),
        )


if __name__ == "__main__":
    unittest.main()
