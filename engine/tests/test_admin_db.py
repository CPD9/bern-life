"""Person profiles with a company's name shape, read from the migrated database after loading the
invented bundle and adding two invented company-shaped rows.

Runs inside a rolled-back transaction on emptied tables.
"""

import tempfile
import unittest
from pathlib import Path

from bernlife.admin import flagged_people
from bernlife.database import connect
from bernlife.load_command import load
from contract_schemas import validator
from search_fakes import SOURCES, truncate_all, write_bundle

from db import database_url

INSERT = """
INSERT INTO profile (id, kind, source_id, name, source_url) VALUES (%s, 'person', %s, %s, %s)
"""


class AdminDbTest(unittest.TestCase):
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

    def test_the_invented_people_all_read_as_people(self):
        self.assertEqual(flagged_people(self.conn), ([], 5))

    def test_company_shaped_names_are_listed_by_id_with_their_page(self):
        for row in (
            (
                "person-example-example-digital",
                "example",
                "Example Digital",
                "https://www.example-institute.test/partners",
            ),
            (
                "person-demo-sample-health",
                "demo",
                "Sample Health",
                "https://www.demo-centre.test/challenge/finalists",
            ),
        ):
            self.conn.execute(INSERT, row)
        people, checked = flagged_people(self.conn)
        self.assertEqual(
            (people, checked),
            (
                [
                    {
                        "id": "person-demo-sample-health",
                        "name": "Sample Health",
                        "source_id": "demo",
                        "source_name": "Demo Centre",
                        "page_url": "https://www.demo-centre.test/challenge/finalists",
                        "reason": "ends in Health",
                    },
                    {
                        "id": "person-example-example-digital",
                        "name": "Example Digital",
                        "source_id": "example",
                        "source_name": "Example Institute",
                        "page_url": "https://www.example-institute.test/partners",
                        "reason": "ends in Digital",
                    },
                ],
                7,
            ),
        )
        body = {"snapshot": "local-test", "checked": checked, "people": people}
        self.assertEqual(list(validator("admin-flagged.schema.json").iter_errors(body)), [])


if __name__ == "__main__":
    unittest.main()
