"""Loading the invented bundle into the migrated database.

Each test runs inside one transaction that is rolled back, starting from emptied tables, so the
database is left as it was found, whatever a lane had loaded into it.
"""

import copy
import json
import tempfile
import unittest
from pathlib import Path

from bernlife.load_command import load, table_counts
from bernlife.profiles_db import read_profiles
from search_fakes import PROFILES, SOURCES, truncate_all, write_bundle

from db import connect

COUNTS = {"page": 4, "profile": 5, "claim": 12, "entity_relation": 1, "chunk": 9, "term": 0}


class LoadTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.conn = connect()

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def setUp(self):
        self.folder = Path(tempfile.mkdtemp())
        write_bundle(self.folder)
        transaction = self.conn.transaction(force_rollback=True)
        transaction.__enter__()
        self.addCleanup(transaction.__exit__, None, None, None)
        truncate_all(self.conn)

    def test_loads_every_table_and_twice_gives_the_same_rows(self):
        self.assertEqual(load(self.conn, self.folder, SOURCES), [])
        first = table_counts(self.conn)
        self.assertEqual(load(self.conn, self.folder, SOURCES), [])
        self.assertEqual((first, table_counts(self.conn)), (COUNTS, COUNTS))
        versions = self.conn.execute("SELECT DISTINCT version, counts FROM bundle_load").fetchall()
        self.assertEqual(len(versions), 1)
        self.assertTrue(versions[0][0].startswith("local-"))
        self.assertEqual(versions[0][1], {key: value for key, value in COUNTS.items()})

    def test_profiles_read_back_as_the_same_bytes(self):
        load(self.conn, self.folder, SOURCES)
        stored = read_profiles(self.conn, [p["id"] for p in PROFILES])
        self.assertEqual(
            [json.dumps(stored[p["id"]]) for p in PROFILES], [json.dumps(p) for p in PROFILES]
        )

    def test_a_tampered_span_is_refused_by_the_database_and_rolls_back_its_source(self):
        tampered = copy.deepcopy(PROFILES)
        tampered[1]["name"]["evidence"]["span"] = "Dr. Ada Mustermann"
        write_bundle(self.folder, tampered)
        refusals = load(self.conn, self.folder, SOURCES)
        self.assertEqual(
            refusals,
            [
                "example: claim person-example-ada-muster/name refused"
                " (evidence span not found in page)"
            ],
        )
        rows = self.conn.execute(
            "SELECT source_id, count(*) FROM profile GROUP BY 1 ORDER BY 1"
        ).fetchall()
        self.assertEqual(rows, [("demo", 1)])
        self.assertEqual(self.conn.execute("SELECT count(*) FROM bundle_load").fetchone(), (0,))

    def test_a_chunk_without_a_vector_is_refused(self):
        (self.folder / "vectors.jsonl").write_text("")
        refusals = load(self.conn, self.folder, SOURCES)
        self.assertEqual(len(refusals), 2)
        self.assertTrue(refusals[0].startswith("demo: chunk "))
        self.assertTrue(refusals[0].endswith(" has no vector; run embed"))

    def test_pages_of_an_unknown_source_are_refused(self):
        self.assertEqual(
            load(self.conn, self.folder, SOURCES[:1]),
            ["bundle has pages of unknown sources: example"],
        )


if __name__ == "__main__":
    unittest.main()
