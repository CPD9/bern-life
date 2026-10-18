import csv
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

from evaluator.__main__ import main
from evaluator.score import score_all
from evaluator.sheet import labeller, stratified
from records import gold, profile, response, result

FIXTURES = Path(__file__).resolve().parent / "fixtures"
GOLD = Path(__file__).resolve().parents[1] / "gold.jsonl"


class FixtureRunTest(unittest.TestCase):
    def run_main(self, *extra: str) -> tuple[int, str, Path]:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        out = io.StringIO()
        args = ["--gold", str(GOLD), "--predictions", str(FIXTURES / "predictions.jsonl")]
        with redirect_stdout(out):
            code = main([*args, *extra, "--out", tmp.name])
        return code, out.getvalue(), Path(tmp.name)

    def test_fixture_run_scores_every_check(self) -> None:
        code, report, out = self.run_main(
            "--pages", str(FIXTURES / "pages.jsonl"), "--profiles", str(FIXTURES / "profiles.jsonl")
        )
        self.assertEqual(code, 0)
        metrics = json.loads((out / "metrics.json").read_text())
        pooled = metrics["slices"]["pooled"]
        self.assertEqual(pooled["queries"], 48)
        self.assertEqual(
            (pooled["invented_abstained"]["k"], pooled["invented_abstained"]["n"]), (9, 10)
        )
        self.assertEqual(pooled["invented_entities"], 1)
        self.assertEqual(
            metrics["untraceable"],
            [
                {
                    "query": "q002",
                    "profile": "person-fixture-b",
                    "claim": "/fields/expertise/0",
                    "reason": "span_not_on_page",
                }
            ],
        )
        self.assertEqual(metrics["decisions"]["criterion_3"]["status"], "not met")
        self.assertIn("| pooled | 48 |", report)

    def test_without_the_snapshot_its_checks_say_not_computed(self) -> None:
        code, report, out = self.run_main()
        self.assertEqual(code, 0)
        self.assertIsNone(
            json.loads((out / "metrics.json").read_text())["slices"]["pooled"]["traceable_claims"]
        )
        self.assertIn("- criterion_3: **not computed**", report)

    def test_labelling_sheet_is_blind(self) -> None:
        _, _, out = self.run_main("--pages", str(FIXTURES / "pages.jsonl"))
        with (out / "labelling_sheet.csv").open(encoding="utf-8") as sheet:
            header = next(csv.reader(sheet))
        self.assertEqual(header[:6], ["item", "labeller", "query", "lang", "name", "page"])
        self.assertFalse({"rank", "score", "reason"} & {column.split()[0] for column in header})


class SheetTest(unittest.TestCase):
    def test_round_robin_across_sources_and_overlap_first(self) -> None:
        def shown(source: str, n: int) -> list[dict]:
            return [
                result(
                    i + 1,
                    profile(
                        f"person-{source}-{i}",
                        "person",
                        f"P {source} {i}",
                        f"https://{source}.test/{i}",
                        source=source,
                    ),
                )
                for i in range(n)
            ]

        queries = [gold("q100"), gold("q200")]
        responses = {
            "q100": response(shown("unibe", 3) + shown("artorg", 1)),
            "q200": response(shown("dcb", 2)),
        }
        picks = stratified(score_all(queries, responses, None, None), size=4)
        self.assertEqual(
            [r["profile"]["source_id"] for _, r in picks], ["artorg", "dcb", "unibe", "dcb"]
        )
        self.assertEqual(
            [labeller(row) for row in (0, 9, 10, 19, 20, 29)],
            ["Peter + Nik", "Peter + Nik", "Peter", "Peter", "Nik", "Nik"],
        )


if __name__ == "__main__":
    unittest.main()
