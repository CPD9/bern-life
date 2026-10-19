import csv
import hashlib
import io
import json
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

from evaluator.__main__ import main
from evaluator.score import score_all
from evaluator.sheet import labellers, read_sheet, stratified
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
        self.assertIn("| small | 4 | 4 | 1.00 | 10 | 1.00 | 0 |", report)
        self.assertIn("| unibe | small | 2 | 2 | 1.00 | 6 | 1.00 | 0 |", report)

    def test_records_the_sha256_of_every_file_it_scored(self) -> None:
        _, _, out = self.run_main("--pages", str(FIXTURES / "pages.jsonl"))
        hashes = json.loads((out / "metrics.json").read_text())["input_sha256"]
        files = {"gold": GOLD, "predictions": FIXTURES / "predictions.jsonl"}
        files["pages"] = FIXTURES / "pages.jsonl"
        self.assertEqual(
            hashes,
            {key: hashlib.sha256(path.read_bytes()).hexdigest() for key, path in files.items()},
        )

    def test_without_the_snapshot_its_checks_say_not_computed(self) -> None:
        code, report, out = self.run_main()
        self.assertEqual(code, 0)
        self.assertIsNone(
            json.loads((out / "metrics.json").read_text())["slices"]["pooled"]["traceable_claims"]
        )
        self.assertIn("- criterion_3: **not computed**", report)

    def test_labelling_sheets_are_blind_and_the_key_stays_apart(self) -> None:
        _, _, out = self.run_main("--pages", str(FIXTURES / "pages.jsonl"))
        folder = out / "labelling"
        self.assertEqual(
            sorted(path.name for path in folder.iterdir()),
            ["key.json", "sheet-nik.csv", "sheet-peter.csv"],
        )
        key = json.loads((folder / "key.json").read_text(encoding="utf-8"))
        predictions = hashlib.sha256((FIXTURES / "predictions.jsonl").read_bytes()).hexdigest()
        self.assertEqual(key["predictions_sha256"], predictions)
        for who in ("peter", "nik"):
            with self.subTest(labeller=who):
                text = (folder / f"sheet-{who}.csv").read_text(encoding="utf-8")
                self.assertTrue(text.startswith('"# Bern Life field check for'))
                rows = list(csv.reader(text.splitlines()))
                header = next(row for row in rows if row[:1] == ["item"])
                self.assertEqual(header[:4], ["item", "kind", "name", "source link"])
                for column in ("query", "rank", "score", "reason", "filled", "profile"):
                    self.assertNotIn(column, header)
                    self.assertNotIn(f'"{column}"', text)
                items = [int(row["item"]) for row in read_sheet(folder / f"sheet-{who}.csv")]
                mine = [i["item"] for i in key["items"] if who in i["labellers"]]
                self.assertEqual(items, mine)

    def test_answered_sheets_are_never_overwritten(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        folder = Path(tmp.name)
        args = ["--gold", str(GOLD), "--predictions", str(FIXTURES / "predictions.jsonl")]
        args += ["--out", str(folder / "out"), "--labelling-dir", str(folder / "sheets")]
        with redirect_stdout(io.StringIO()):
            self.assertEqual(main(args), 0)
        sheet = folder / "sheets" / "sheet-nik.csv"
        filled = sheet.read_text(encoding="utf-8").replace(",,,,,,,\n", ",y,n,,,,,\n", 1)
        sheet.write_text(filled, encoding="utf-8")
        before = {path.name: path.read_bytes() for path in (folder / "sheets").iterdir()}
        err = io.StringIO()
        with redirect_stdout(io.StringIO()), redirect_stderr(err):
            self.assertEqual(main(args), 0)
        after = {path.name: path.read_bytes() for path in (folder / "sheets").iterdir()}
        self.assertEqual(before, after)
        self.assertIn("holds answered sheets, left as they are", err.getvalue())


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
        both = ("peter", "nik")
        self.assertEqual(
            [labellers(row) for row in (0, 7, 8, 9, 10, 29)],
            [both, both, ("peter",), ("nik",), ("peter",), ("nik",)],
        )
        per_labeller = [sum(who in labellers(row) for row in range(30)) for who in both]
        self.assertEqual(per_labeller, [19, 19])

    def test_a_profile_shown_for_two_queries_is_labelled_once(self) -> None:
        same = profile("person-unibe-0", "person", "P 0", "https://unibe.test/0")
        other = profile("person-unibe-1", "person", "P 1", "https://unibe.test/1")
        queries = [gold("q100"), gold("q200")]
        responses = {
            "q100": response([result(1, same)]),
            "q200": response([result(1, same), result(2, other)]),
        }
        picks = stratified(score_all(queries, responses, None, None), size=4)
        self.assertEqual(
            sorted(r["profile"]["id"] for _, r in picks), ["person-unibe-0", "person-unibe-1"]
        )


if __name__ == "__main__":
    unittest.main()
