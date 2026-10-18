import io
import json
import tempfile
import unittest
from collections import Counter
from contextlib import redirect_stderr
from pathlib import Path

from bernlife.enrich import batches, expertise_values, parse_enrichment, term_rows
from bernlife.enrich_command import enrich, main
from bernlife.llm_http import ModelUnavailable
from bernlife.terms import Term, enrichment_by_value
from search_fakes import PROFILES, FakeChat

VALUES = ["continuous glucose monitoring", "wearable biosensors"]


class EnrichTest(unittest.TestCase):
    def test_distinct_expertise_values_sorted_and_batched(self):
        values = expertise_values(PROFILES)
        self.assertEqual(
            values,
            [
                "continuous glucose monitoring",
                "cryogenic electron microscopy of membrane proteins",
                "glucose metabolism in mice",
                "wearable biosensors",
            ],
        )
        self.assertEqual(batches(values, size=3), [values[:3], values[3:]])

    def test_only_values_of_the_batch_copied_exactly_keep_their_terms(self):
        reply = {
            "items": [
                {
                    "value": "continuous glucose monitoring",
                    "terms": [
                        {"term": "CGM", "kind": "acronym", "lang": "en"},
                        {"term": "Blutzuckermessung", "kind": "translation", "lang": "de"},
                    ],
                },
                {
                    "value": "Wearable biosensors",
                    "terms": [{"term": "smart patches", "kind": "lay", "lang": "en"}],
                },
            ]
        }
        self.assertEqual(
            parse_enrichment(reply, VALUES),
            {
                "continuous glucose monitoring": [
                    Term("CGM", "acronym", "en"),
                    Term("Blutzuckermessung", "translation", "de"),
                ]
            },
        )

    def test_rows_are_the_term_table_columns_sorted(self):
        rows = term_rows({"b": [Term("z", "lay", "en")], "a": [Term("y", "synonym", "de")]}, "m")
        self.assertEqual(
            rows,
            [
                {
                    "value": "a",
                    "term": "y",
                    "kind": "synonym",
                    "lang": "de",
                    "model": "m",
                    "prompt_version": "enrich-v1",
                },
                {
                    "value": "b",
                    "term": "z",
                    "kind": "lay",
                    "lang": "en",
                    "model": "m",
                    "prompt_version": "enrich-v1",
                },
            ],
        )
        self.assertEqual(enrichment_by_value(rows), {"a": ["y"], "b": ["z"]})

    def test_a_failed_batch_is_counted_by_its_marker_and_the_run_goes_on(self):
        rows, failures = enrich(FakeChat({"enrich": ModelUnavailable("model_timeout")}), VALUES, 2)
        self.assertEqual((rows, failures), ([], Counter({"model_timeout": 1})))

    def test_mock_writes_nothing(self):
        data = Path(tempfile.mkdtemp())
        (data / "bundle").mkdir()
        (data / "bundle" / "profiles.jsonl").write_text(json.dumps(PROFILES[1]) + "\n")
        err = io.StringIO()
        with redirect_stderr(err):
            code = main([], {"BERNLIFE_DATA_DIR": str(data), "BERNLIFE_BACKEND": "mock"})
        self.assertEqual(code, 1)
        self.assertFalse((data / "bundle" / "terms.jsonl").exists())
        self.assertIn("MOCK", err.getvalue())


if __name__ == "__main__":
    unittest.main()
