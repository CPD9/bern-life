"""Search over the invented bundle in the migrated database, through the engine API.

Runs inside a rolled-back transaction on emptied tables, with the word-hashing encoder.
"""

import json
import tempfile
import threading
import unittest
import urllib.request
from pathlib import Path

from bernlife.abstain import NO_SOURCE
from bernlife.brief_search import brief_search
from bernlife.database import connect
from bernlife.extract_records import PEOPLE_KINDS
from bernlife.llm import MockLLM
from bernlife.load_command import load
from bernlife.search import search
from bernlife.serve_command import EngineApi
from bernlife.server import make_server
from bernlife.store import PostgresStore
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from search_fakes import (
    KRYO_TERM,
    PATCH_PAGE,
    SOURCES,
    FakeChat,
    fake_embedder,
    truncate_all,
    write_bundle,
)

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
        server = make_server(EngineApi(self.conn, fake_embedder(), MockLLM()), 0)
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

    def test_a_passage_credits_only_profiles_with_a_matching_claim_or_own_page_passage(self):
        response = search("skin-worn patch, wearable", None, self.store, fake_embedder())
        ada, patch = response["results"]
        self.assertEqual(ada["profile"]["id"], "person-example-ada-muster")
        self.assertEqual(ada["reason"]["cites"], ["/fields/expertise/1"])
        self.assertEqual(ada["metrics"]["covers"], ["wearable"])
        self.assertNotIn("passage", ada)
        # The project's own page says it next to its name; Ben's line on that page does not.
        self.assertEqual(patch["profile"]["id"], "project-example-glucopatch")
        self.assertEqual(patch["reason"], {"text": "Name: GlucoPatch", "cites": ["/name"]})
        self.assertEqual(
            patch["passage"],
            {
                "kind": "own_page",
                "span": "GlucoPatch\nA skin",
                "page_url": "https://www.example-institute.test/projects/glucopatch",
                "page_sha256": PATCH_PAGE["sha256"],
                "start": 0,
                "fetched_at": "2026-10-18T12:00:00Z",
            },
        )
        self.assertEqual(list(result_validator().iter_errors(response)), [])

    def lexical(self, query: str) -> list[tuple[str, float]]:
        hits = self.store.hits(query, fake_embedder().query(query), None, PEOPLE_KINDS)
        return sorted({(h.profile_id, h.strength) for h in hits if h.signal == "lexical"})

    def test_full_text_finds_another_form_of_a_word_and_coverage_stays_exact(self):
        self.assertEqual(self.lexical("biosensor"), [("person-example-ada-muster", 0.0)])
        self.assertEqual(self.lexical("biosensors"), [("person-example-ada-muster", 1.0)])

    def test_a_bare_name_is_shown_only_when_the_query_names_it(self):
        response = search("Ben Beispiel skin-worn patch", None, self.store, fake_embedder())
        ben, patch = response["results"]
        self.assertEqual(
            (ben["profile"]["id"], "passage" in ben, patch["profile"]["id"], "passage" in patch),
            ("person-example-ben-beispiel", False, "project-example-glucopatch", True),
        )

    def test_nothing_that_can_explain_itself_abstains_whatever_its_own_page_says(self):
        response = search("skin-worn patch", None, self.store, fake_embedder())
        self.assertEqual((response["abstained"], response["abstain_reason"]), (True, NO_SOURCE))

    def test_an_invented_titled_name_abstains(self):
        response = search(
            "What does Prof. Hugo Brandtner publish on glucose?", None, self.store, fake_embedder()
        )
        self.assertEqual(
            (response["abstained"], response["abstain_reason"], response["results"]),
            (True, "no_verifiable_source", []),
        )

    def test_an_invented_term_finds_its_profile_only_through_enrichment(self):
        query = "Wer macht Kryo-Elektronenmikroskopie?"
        self.assertEqual(search(query, None, self.store, fake_embedder())["results"], [])
        folder = Path(tempfile.mkdtemp())
        write_bundle(folder, terms=[KRYO_TERM])
        self.assertEqual(load(self.conn, folder, SOURCES), [])
        response = search(query, None, self.store, fake_embedder())
        (only,) = response["results"]
        self.assertEqual(only["profile"]["id"], "person-example-dora-demo")
        self.assertEqual(only["reason"]["cites"], ["/fields/expertise/0"])
        self.assertNotIn("Kryo", json.dumps(only["profile"]))

    def test_expansion_terms_retrieve_label_the_mode_and_repeat_byte_for_byte(self):
        expansion = {
            "topics": [
                {
                    "topic": "Blutzucker",
                    "terms": [{"term": "glucose monitoring", "kind": "translation", "lang": "en"}],
                }
            ]
        }
        llm = FakeChat({"expand": expansion})
        query = "skin-worn Blutzucker"
        first = search(query, None, self.store, fake_embedder(), llm)
        second = search(query, None, self.store, fake_embedder(), llm)
        self.assertEqual(json.dumps(first), json.dumps(second))
        self.assertEqual(list(result_validator().iter_errors(first)), [])
        self.assertEqual(
            (first["mode"], first["versions"]["prompts"], first["versions"]["models"]["expand"]),
            ("replay", "expand-v1", "fake-70b"),
        )
        self.assertEqual(
            first["expanded_terms"],
            [{"term": "glucose monitoring", "kind": "translation", "lang": "en"}],
        )
        self.assertEqual(first["results"][0]["profile"]["id"], "person-example-ada-muster")
        self.assertEqual(first["results"][0]["metrics"]["covers"], ["Blutzucker"])
        plain = search(query, None, self.store, fake_embedder())
        self.assertEqual((plain["abstained"], plain["mode"]), (True, "mock"))

    def test_mock_runs_end_to_end_and_says_so(self):
        response = search("glucose monitoring", None, self.store, fake_embedder(), MockLLM())
        self.assertEqual(
            (response["mode"], response["expanded_terms"], response["versions"]["prompts"]),
            ("mock", [], "none"),
        )
        self.assertEqual(response["results"][0]["profile"]["id"], "person-example-ada-muster")

    def test_a_brief_finds_an_expert_per_verified_need_and_repeats_byte_for_byte(self):
        brief = (
            "Invented Demo AG builds a skin-worn patch. We need wearable sensors for continuous"
            " glucose monitoring. We also need cryogenic electron microscopy of membrane proteins."
        )
        llm = FakeChat(
            {
                "brief": {
                    "needs": [
                        {"term": "wearable glucose sensors", "span": "We need wearable sensors"},
                        {
                            "term": "cryo electron microscopy",
                            "span": "cryogenic electron microscopy",
                        },
                        {"term": "mass spectrometry", "span": "We need mass spectrometry."},
                    ]
                },
                "explain": {
                    "text": "Works on what the need asks.",
                    "claims": [1],
                },
            }
        )
        first = brief_search(brief, None, self.store, fake_embedder(), llm)
        second = brief_search(brief, None, self.store, fake_embedder(), llm)
        self.assertEqual(json.dumps(first), json.dumps(second))
        self.assertEqual(list(result_validator().iter_errors(first)), [])
        self.assertEqual(first["query"], "wearable glucose sensors; cryo electron microscopy")
        self.assertEqual(
            [t["span"] for t in first["brief_terms"]],
            ["We need wearable sensors", "cryogenic electron microscopy"],
        )
        self.assertEqual(
            [r["profile"]["id"] for r in first["results"]],
            ["person-example-ada-muster", "person-example-dora-demo", "person-demo-cleo-beispiel"],
        )
        self.assertEqual(first["results"][0]["reason"]["text"], "Works on what the need asks.")
        self.assertEqual(
            (first["mode"], first["versions"]["prompts"]), ("replay", "brief-v1+explain-v2")
        )

    def test_a_brief_with_no_model_abstains_and_says_mock(self):
        response = brief_search(
            "We need glucose sensors.", None, self.store, fake_embedder(), MockLLM()
        )
        self.assertEqual(
            (
                response["abstained"],
                response["abstain_reason"],
                response["mode"],
                response["brief_terms"],
            ),
            (True, "no_verifiable_source", "mock", []),
        )

    def test_a_team_member_named_only_on_a_matching_project_page_is_shown_through_it(self):
        response = search("carbohydrate estimation", None, self.store, fake_embedder())
        by_id = {r["profile"]["id"]: r for r in response["results"]}
        self.assertEqual(sorted(by_id), ["person-demo-emil-exempel", "project-demo-carb-counter"])
        emil = by_id["person-demo-emil-exempel"]
        self.assertEqual(emil["reason"], {"text": "Name: Emil Exempel", "cites": ["/name"]})
        self.assertEqual(
            (emil["via"]["kind"], emil["via"]["span"], emil["via"]["related_name"]),
            ("works_on", "Project team: Emil Exempel", "Carb Counter"),
        )
        self.assertEqual(
            [c["value"] for c in emil["via"]["related_claims"]],
            ["carbohydrate estimation from meal photos"],
        )
        self.assertNotIn("via", by_id["project-demo-carb-counter"])
        self.assertEqual(list(result_validator().iter_errors(response)), [])

    def test_people_search_reads_the_same_with_opportunities_loaded(self):
        before = json.dumps(search("glucose monitoring", None, self.store, fake_embedder()))
        folder = Path(tempfile.mkdtemp())
        write_bundle(folder, opportunities=True)
        self.assertEqual(load(self.conn, folder, SOURCES), [])
        after = search("glucose monitoring", None, self.store, fake_embedder())
        self.assertNotIn("call-", json.dumps([r["profile"]["id"] for r in after["results"]]))
        self.assertEqual(
            json.dumps(after).replace(after["versions"]["snapshot"], "S"),
            before.replace(json.loads(before)["versions"]["snapshot"], "S"),
        )

    def test_a_kinds_search_finds_the_call_with_its_verbatim_deadline(self):
        folder = Path(tempfile.mkdtemp())
        write_bundle(folder, opportunities=True)
        self.assertEqual(load(self.conn, folder, SOURCES), [])
        response = search("glucose monitoring", None, self.store, fake_embedder(), kinds=["call"])
        (only,) = response["results"]
        self.assertEqual(only["profile"]["id"], "call-example-glucose-monitoring-call-2027")
        self.assertEqual(
            only["profile"]["fields"]["deadline"][0]["evidence"]["span"], "Deadline: 31.03.2027"
        )
        self.assertEqual(list(result_validator().iter_errors(response)), [])


if __name__ == "__main__":
    unittest.main()
