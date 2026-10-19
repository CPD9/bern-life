"""The sources list read from the migrated database after loading the invented bundle.

Runs inside a rolled-back transaction on emptied tables.
"""

import tempfile
import unittest
from pathlib import Path

from bernlife.catalog import read_loaded, source_list
from bernlife.database import connect
from bernlife.load_command import load
from search_fakes import SOURCES, truncate_all, write_bundle

from db import database_url


class CatalogDbTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.conn = connect(database_url())

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def setUp(self):
        folder = Path(tempfile.mkdtemp())
        write_bundle(folder, opportunities=True)
        transaction = self.conn.transaction(force_rollback=True)
        transaction.__enter__()
        self.addCleanup(transaction.__exit__, None, None, None)
        truncate_all(self.conn)
        self.assertEqual(load(self.conn, folder, SOURCES), [])

    def test_every_loaded_source_with_its_counts(self):
        self.assertEqual(
            source_list(read_loaded(self.conn), ()),
            [
                {
                    "id": "demo",
                    "name": "Demo Centre",
                    "hosts": ["www.demo-centre.test"],
                    "kinds": ["person", "project"],
                    "pages": 2,
                    "profiles": 3,
                    "newest_fetched_at": "2026-10-18T12:00:00Z",
                },
                {
                    "id": "example",
                    "name": "Example Institute",
                    "hosts": ["www.example-institute.test"],
                    "kinds": ["person", "project", "call"],
                    "pages": 4,
                    "profiles": 5,
                    "newest_fetched_at": "2026-10-18T12:00:00Z",
                },
            ],
        )

    def test_a_source_without_rows_has_no_fetch_date(self):
        self.conn.execute("DELETE FROM page WHERE source_id = 'demo'")
        self.conn.execute("DELETE FROM site WHERE source_id = 'demo'")
        (demo,) = [s for s in source_list(read_loaded(self.conn), ()) if s["id"] == "demo"]
        self.assertEqual(
            demo,
            {
                "id": "demo",
                "name": "Demo Centre",
                "hosts": [],
                "kinds": ["person", "project"],
                "pages": 0,
                "profiles": 3,
                "newest_fetched_at": None,
            },
        )


if __name__ == "__main__":
    unittest.main()
