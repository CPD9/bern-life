"""The migrated schema, checked against the invented contract fixtures.

Every test runs in one transaction that is rolled back, so the database is left as it was found.
"""

import hashlib
import json
import unittest
from pathlib import Path

import psycopg
from psycopg import sql

from db import connect

FIXTURES = Path(__file__).resolve().parents[2] / "contracts" / "fixtures"
PAGE = json.loads((FIXTURES / "page.json").read_text())
PROFILE = json.loads((FIXTURES / "profile.json").read_text())
PAGE_COLUMNS = ("url", "source_id", "unit", "fetched_at", "sha256", "status", "lang", "kind")
SPAN_ERROR = "evidence span not found in page"


def insert(cur: psycopg.Cursor, table: str, row: dict[str, object]) -> None:
    statement = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
        sql.Identifier(table),
        sql.SQL(", ").join(map(sql.Identifier, row)),
        sql.SQL(", ").join(sql.Placeholder() * len(row)),
    )
    cur.execute(statement, tuple(row.values()))


def claim_row(field: str, position: int, claim: dict) -> dict[str, object]:
    evidence = claim["evidence"]
    return {
        "profile_id": PROFILE["id"],
        "field": field,
        "position": position,
        "value": claim["value"],
        "method": claim["method"],
        "page_url": evidence["page_url"],
        "page_sha256": evidence["page_sha256"],
        "span": evidence["span"],
        "start": evidence.get("start"),
    }


def fixture_claims() -> list[dict[str, object]]:
    rows = [claim_row("name", 0, PROFILE["name"])]
    for field, claims in sorted(PROFILE["fields"].items()):
        rows += [claim_row(field, position, claim) for position, claim in enumerate(claims)]
    return rows


def load_fixtures(cur: psycopg.Cursor) -> None:
    insert(cur, "source", {"id": PAGE["source_id"], "name": "Example"})
    page = {column: PAGE[column] for column in PAGE_COLUMNS}
    insert(cur, "page", {**page, "title": PAGE["title"], "text": PAGE["text"]})
    profile = {key: PROFILE[key] for key in ("id", "kind", "source_id", "source_url")}
    insert(cur, "profile", {**profile, "name": PROFILE["name"]["value"]})
    for row in fixture_claims():
        insert(cur, "claim", row)


def name_claim_with(span: str, start: int | None) -> dict[str, object]:
    return {**claim_row("services", 0, PROFILE["name"]), "span": span, "start": start}


def insert_long_page(cur: psycopg.Cursor) -> tuple[str, str, str]:
    """A page long and varied enough that Postgres stores it compressed out of line."""
    words = (hashlib.md5(str(i).encode()).hexdigest() for i in range(2000))
    text = "".join(f"{word} Universität für Gesundheit – " for word in words) + "Glucose Lab"
    url = PAGE["url"] + "/long"
    sha = hashlib.sha256(text.encode()).hexdigest()
    page = {column: PAGE[column] for column in PAGE_COLUMNS}
    insert(cur, "page", {**page, "url": url, "sha256": sha, "title": PAGE["title"], "text": text})
    return url, sha, text


def long_page_claim(url: str, sha: str, position: int, span: str, start: int | None):
    claim = claim_row("services", position, PROFILE["name"])
    return {**claim, "page_url": url, "page_sha256": sha, "span": span, "start": start}


class SchemaTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.conn = connect()

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def setUp(self):
        self.cur = self.conn.cursor()
        self.addCleanup(self.conn.rollback)

    def test_tables(self):
        self.cur.execute(
            "SELECT table_name FROM information_schema.tables"
            " WHERE table_schema = 'public' ORDER BY table_name"
        )
        tables = [row[0] for row in self.cur.fetchall()]
        self.assertEqual(
            tables,
            [
                "_prisma_migrations",
                "app_user",
                "bundle_load",
                "chunk",
                "claim",
                "conversation",
                "credential",
                "entity_relation",
                "invite",
                "member",
                "message",
                "page",
                "place",
                "profile",
                "rate_limit",
                "session",
                "site",
                "source",
                "term",
                "user_profile",
            ],
        )

    def test_search_indexes(self):
        self.cur.execute(
            "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'chunk'"
            " AND indexname IN ('chunk_embedding_hnsw_idx', 'chunk_tsv_gin_idx') ORDER BY 1"
        )
        (hnsw_name, hnsw_def), (gin_name, gin_def) = self.cur.fetchall()
        self.assertEqual((hnsw_name, gin_name), ("chunk_embedding_hnsw_idx", "chunk_tsv_gin_idx"))
        self.assertIn("USING hnsw (embedding vector_cosine_ops)", hnsw_def)
        self.assertIn("USING gin (tsv)", gin_def)

    def test_fixture_claims_are_accepted(self):
        load_fixtures(self.cur)
        self.cur.execute("SELECT field::text, count(*) FROM claim GROUP BY 1 ORDER BY 1")
        self.assertEqual(
            self.cur.fetchall(),
            [
                ("expertise", 2),
                ("infrastructure", 1),
                ("name", 1),
                ("projects", 1),
                ("role", 1),
                ("unit", 2),
            ],
        )

    def test_span_not_in_page_is_rejected(self):
        load_fixtures(self.cur)
        with self.assertRaises(psycopg.errors.CheckViolation) as caught:
            insert(self.cur, "claim", name_claim_with("Dr. Ada Mustermann", None))
        self.assertEqual(caught.exception.diag.message_primary, SPAN_ERROR)

    def test_span_at_the_wrong_start_is_rejected(self):
        load_fixtures(self.cur)
        with self.assertRaises(psycopg.errors.CheckViolation) as caught:
            insert(self.cur, "claim", name_claim_with("Sensor Lab", 0))
        self.assertEqual(caught.exception.diag.message_primary, SPAN_ERROR)

    def test_relation_span_is_checked_too(self):
        load_fixtures(self.cur)
        evidence = PROFILE["name"]["evidence"]
        relation = {
            "from_profile_id": PROFILE["id"],
            "to_profile_id": PROFILE["id"],
            "kind": "member_of",
            "method": "selector",
            "page_url": evidence["page_url"],
            "page_sha256": evidence["page_sha256"],
            "span": "Glucose Lab",
        }
        with self.assertRaises(psycopg.errors.CheckViolation) as caught:
            insert(self.cur, "entity_relation", relation)
        self.assertEqual(caught.exception.diag.message_primary, SPAN_ERROR)

    def test_spans_on_a_compressed_multibyte_page_are_accepted(self):
        load_fixtures(self.cur)
        url, sha, text = insert_long_page(self.cur)
        self.cur.execute("SELECT pg_column_compression(text) FROM page WHERE url = %s", (url,))
        self.assertEqual(self.cur.fetchone(), ("pglz",))
        near_start = text[5:15]
        insert(self.cur, "claim", long_page_claim(url, sha, 0, near_start, 5))
        insert(self.cur, "claim", long_page_claim(url, sha, 1, "Glucose Lab", len(text) - 11))
        insert(self.cur, "claim", long_page_claim(url, sha, 2, "Glucose Lab", None))
        self.cur.execute("SELECT count(*) FROM claim WHERE page_url = %s", (url,))
        self.assertEqual(self.cur.fetchone(), (3,))

    def test_span_at_the_wrong_start_on_a_compressed_page_is_rejected(self):
        load_fixtures(self.cur)
        url, sha, text = insert_long_page(self.cur)
        with self.assertRaises(psycopg.errors.CheckViolation) as caught:
            insert(self.cur, "claim", long_page_claim(url, sha, 0, text[5:15], 6))
        self.assertEqual(caught.exception.diag.message_primary, SPAN_ERROR)

    def test_page_text_must_hash_to_its_sha256(self):
        load_fixtures(self.cur)
        with self.assertRaises(psycopg.errors.CheckViolation) as caught:
            self.cur.execute("UPDATE page SET text = text || '!' WHERE url = %s", (PAGE["url"],))
        self.assertEqual(caught.exception.diag.constraint_name, "page_sha256_matches_text")

    def test_cited_page_cannot_change_version(self):
        load_fixtures(self.cur)
        text = PAGE["text"] + " extra"
        sha = hashlib.sha256(text.encode()).hexdigest()
        with self.assertRaises(psycopg.errors.ForeignKeyViolation) as caught:
            self.cur.execute(
                "UPDATE page SET text = %s, sha256 = %s WHERE url = %s", (text, sha, PAGE["url"])
            )
        self.assertEqual(caught.exception.diag.constraint_name, "claim_page_url_page_sha256_fkey")


if __name__ == "__main__":
    unittest.main()
