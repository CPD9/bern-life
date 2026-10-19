import unittest
from datetime import UTC, datetime

from bernlife.catalog import SourceStats, source_list
from bernlife.sources import Source
from contract_schemas import validator
from search_fakes import site

FETCHED = datetime(2026, 10, 18, 12, 0, 0, 250_000, tzinfo=UTC)
LOADED = [
    SourceStats(
        "example",
        "Example Institute",
        ("www.example-institute.test",),
        {"project": 1, "call": 1, "person": 3},
        4,
        FETCHED,
    ),
    SourceStats("demo", "Demo Centre (loaded)", (), {}, 0, None),
]
CONFIGURED = [
    Source("demo", "Demo Centre", (site("www.demo-centre.test", "demo", "Demo Centre"),)),
    Source(
        "later-lab",
        "Later Lab",
        (
            site("www.later-lab.test", "later-lab", "Later Lab"),
            site("data.later-lab.test", "later-lab", "Later Lab"),
        ),
    ),
]
EXPECTED = [
    {
        "id": "demo",
        "name": "Demo Centre (loaded)",
        "hosts": ["www.demo-centre.test"],
        "kinds": [],
        "pages": 0,
        "profiles": 0,
        "newest_fetched_at": None,
    },
    {
        "id": "example",
        "name": "Example Institute",
        "hosts": ["www.example-institute.test"],
        "kinds": ["person", "project", "call"],
        "pages": 4,
        "profiles": 5,
        "newest_fetched_at": "2026-10-18T12:00:00.250Z",
    },
    {
        "id": "later-lab",
        "name": "Later Lab",
        "hosts": ["data.later-lab.test", "www.later-lab.test"],
        "kinds": [],
        "pages": 0,
        "profiles": 0,
        "newest_fetched_at": None,
    },
]


class SourceListTest(unittest.TestCase):
    def test_loaded_values_win_and_configuration_fills_the_gaps(self):
        self.assertEqual(source_list(LOADED, CONFIGURED), EXPECTED)

    def test_without_configuration_only_loaded_sources_are_listed(self):
        self.assertEqual([entry["id"] for entry in source_list(LOADED, ())], ["demo", "example"])

    def test_the_list_validates_against_the_contract(self):
        body = {"snapshot": "local-abc", "sources": source_list(LOADED, CONFIGURED)}
        self.assertEqual(list(validator("sources.schema.json").iter_errors(body)), [])


if __name__ == "__main__":
    unittest.main()
