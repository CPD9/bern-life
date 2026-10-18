import json
import tempfile
import unittest
from pathlib import Path

from evaluator.load import LoadError, load_gold, load_predictions
from records import response

GOLD = [
    {
        "id": "q100",
        "query": "invented one",
        "lang": "en",
        "variant": "site",
        "sources": ["unibe"],
        "expect": {"abstain": False},
    },
    {
        "id": "q101",
        "query": "invented two",
        "lang": "de",
        "variant": "invented",
        "sources": ["dcb"],
        "expect": {"abstain": True},
    },
]


class LoadTest(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.dir = Path(tmp.name)
        self.gold = load_gold(self.write("gold.jsonl", GOLD))

    def write(self, name: str, rows: list) -> Path:
        path = self.dir / name
        path.write_text("".join(json.dumps(row) + "\n" for row in rows))
        return path

    def refused(self, rows: list) -> str:
        with self.assertRaises(LoadError) as raised:
            load_predictions(self.write("predictions.jsonl", rows), self.gold)
        return str(raised.exception)

    def test_complete_predictions_load(self) -> None:
        rows = [
            {"id": "q100", "response": response([])},
            {"id": "q101", "response": response([], True)},
        ]
        self.assertEqual(
            sorted(load_predictions(self.write("p.jsonl", rows), self.gold)), ["q100", "q101"]
        )

    def test_missing_gold_id_is_refused(self) -> None:
        message = self.refused([{"id": "q100", "response": response([])}])
        self.assertTrue(message.endswith("no prediction for 1 gold ids (q101)"))

    def test_unknown_id_duplicate_and_bad_response_are_refused(self) -> None:
        ok = {"id": "q100", "response": response([])}
        broken = {"id": "q101", "response": {"query": "no other fields"}}
        self.assertIn(
            "'q999' is not a gold id", self.refused([ok, {"id": "q999", "response": response([])}])
        )
        self.assertIn("second prediction for q100", self.refused([ok, ok]))
        self.assertIn("is a required property", self.refused([ok, broken]))

    def test_missing_file_is_named(self) -> None:
        with self.assertRaises(LoadError) as raised:
            load_gold(self.dir / "absent.jsonl")
        self.assertEqual(str(raised.exception), f"{self.dir / 'absent.jsonl'} does not exist")


if __name__ == "__main__":
    unittest.main()
