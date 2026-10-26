import io
import json
import tempfile
import unittest
from collections import Counter
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

from bernlife.cache import cache_key, entry_path, write_json
from bernlife.enrich import (
    MAX_TOKENS,
    batches,
    expertise_values,
    parse_enrichment,
    prompt,
    term_rows,
)
from bernlife.enrich_command import enrich, main, stored_terms
from bernlife.llm import ROLES
from bernlife.llm_http import ModelUnavailable
from bernlife.terms import Term, enrichment_by_value
from search_fakes import PROFILES, FakeChat

VALUES = ["continuous glucose monitoring", "wearable biosensors"]
MISSING = [
    "carbohydrate estimation from meal photos",
    "cryogenic electron microscopy of membrane proteins",
    "glucose metabolism in mice",
]


def row(value: str, term: str, kind: str = "lay", model: str = "old-model") -> dict[str, str]:
    return {
        "value": value,
        "term": term,
        "kind": kind,
        "lang": "en",
        "model": model,
        "prompt_version": "enrich-v1",
    }


class EnrichTest(unittest.TestCase):
    def test_distinct_expertise_values_sorted_and_batched(self):
        values = expertise_values(PROFILES)
        self.assertEqual(
            values,
            [
                "carbohydrate estimation from meal photos",
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

    def test_values_with_stored_terms_are_skipped_and_stale_rows_dropped(self):
        stored = [row("wearable biosensors", "smart patches"), row("gone value", "x")]
        stored.append(row("continuous glucose monitoring", "CGM", "acronym"))
        kept, asked = stored_terms(stored, expertise_values(PROFILES))
        self.assertEqual(kept, [stored[0], stored[2]])
        self.assertEqual(asked, MISSING)

    def test_replay_asks_only_for_the_values_without_terms_and_keeps_the_stored_rows(self):
        data = Path(tempfile.mkdtemp())
        (data / "bundle").mkdir()
        lines = "".join(json.dumps(p) + "\n" for p in PROFILES)
        (data / "bundle" / "profiles.jsonl").write_text(lines)
        stored = [row("continuous glucose monitoring", "CGM", "acronym"), row("gone value", "x")]
        stored.append(row("wearable biosensors", "smart patches"))
        (data / "bundle" / "terms.jsonl").write_text("".join(json.dumps(r) + "\n" for r in stored))
        root = data / "llm_cache"
        write_json(root / "models.json", dict.fromkeys(ROLES, "m"))
        messages = [{"role": "user", "content": prompt(MISSING)}]
        key = cache_key("m", messages, 0.0, None, MAX_TOKENS, "enrich-v1")
        items = [
            {"value": v, "terms": [{"term": f"t{i}", "kind": "lay", "lang": "en"}]}
            for i, v in enumerate(MISSING)
        ]
        write_json(entry_path(root, key), {"content": json.dumps({"items": items})})
        env = {"BERNLIFE_DATA_DIR": str(data), "BERNLIFE_BACKEND": "replay"}
        out = io.StringIO()
        with redirect_stdout(out):
            code = main([], env)
        self.assertEqual(code, 0)
        self.assertEqual(
            out.getvalue(),
            "enrich: replay, 5 values, 2 with stored terms, 3 asked, 3 enriched now, 5 terms;"
            " failed batches: none\n",
        )
        lines = (data / "bundle" / "terms.jsonl").read_text().splitlines()
        written = [json.loads(line) for line in lines]
        self.assertEqual(
            written,
            [
                row(MISSING[0], "t0", model="m"),
                stored[0],
                row(MISSING[1], "t1", model="m"),
                row(MISSING[2], "t2", model="m"),
                stored[2],
            ],
        )

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
