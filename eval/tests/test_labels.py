"""The labelling round trip on invented results and invented answers: nobody here is real."""

import csv
import io
import json
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

from evaluator.__main__ import main
from evaluator.labels import kappa, labelled_completeness
from evaluator.load import LoadError
from evaluator.score import score_all
from evaluator.sheet import read_sheet, write_sheets
from records import claim, gold, profile, response, result

FIXTURES = Path(__file__).resolve().parent / "fixtures"
GOLD = Path(__file__).resolve().parents[1] / "gold.jsonl"
SHA = "f" * 64
PETER_EXPERTISE = "yyyynnnn"
NIK_EXPERTISE = "yyynnnny"


def picks(count: int) -> list:
    """Invented results; the first five have an expertise claim filled."""
    chosen = []
    for n in range(count):
        url = f"https://unibe.test/{n}"
        shown = profile(f"person-unibe-invented-{n}", "person", f"Invented Person {n}", url)
        if n < 5:
            shown["fields"]["expertise"] = [claim("invented topic", url)]
        qid = f"q{100 + n}"
        query = score_all([gold(qid)], {qid: response([result(1, shown)])}, None, None)[0]
        chosen.append((query, query.top[0]))
    return chosen


def fill(path: Path, answers: dict[int, dict[str, str]], delimiter: str = ",") -> None:
    """Writes answers into a sheet the way a labeller would, keeping the instructions."""
    rows = list(csv.reader(path.read_text(encoding="utf-8").splitlines()))
    header = next(n for n, row in enumerate(rows) if row[:1] == ["item"])
    for row in rows[header + 1 :]:
        for field, value in answers.get(int(row[0]), {}).items():
            row[rows[header].index(field)] = value
    out = io.StringIO()
    csv.writer(out, delimiter=delimiter).writerows(rows)
    encoding = "utf-8-sig" if delimiter == ";" else "utf-8"
    path.write_text(out.getvalue(), encoding=encoding)


def answers_for(items: list[int], expertise: str) -> dict[int, dict[str, str]]:
    return {item: {"person": "y", "expertise": e} for item, e in zip(items, expertise, strict=True)}


class LabelsTest(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.folder = Path(tmp.name)
        about = {"bundle": "bundle-invented", "predictions_sha256": SHA}
        self.assertTrue(write_sheets(picks(10), self.folder, about))

    def fill_both(self, peter_delimiter: str = ",") -> None:
        peter = answers_for([1, 2, 3, 4, 5, 6, 7, 8, 9], PETER_EXPERTISE + "y")
        peter[9]["projects"] = "maybe"
        fill(self.folder / "sheet-peter.csv", peter, peter_delimiter)
        fill(
            self.folder / "sheet-nik.csv",
            answers_for([1, 2, 3, 4, 5, 6, 7, 8, 10], NIK_EXPERTISE + "n"),
        )

    def test_each_labeller_gets_the_overlap_and_every_other_row(self) -> None:
        items = {
            who: [int(row["item"]) for row in read_sheet(self.folder / f"sheet-{who}.csv")]
            for who in ("peter", "nik")
        }
        self.assertEqual(
            items, {"peter": [1, 2, 3, 4, 5, 6, 7, 8, 9], "nik": [1, 2, 3, 4, 5, 6, 7, 8, 10]}
        )
        sheets = "".join(path.read_text() for path in self.folder.glob("sheet-*.csv"))
        self.assertNotIn("invented topic", sheets)
        self.assertNotIn("q100", sheets)

    def test_completeness_counts_a_field_either_labeller_found(self) -> None:
        self.fill_both()
        scored = labelled_completeness(self.folder, SHA)
        self.assertEqual((scored["results"], scored["labelled"]), (10, 10))
        expertise = scored["fields"]["expertise"]
        # Stated on items 1-4 (Peter), 8 (Nik) and 9; filled on items 1-5.
        self.assertEqual(
            (
                expertise["stated"],
                expertise["filled_where_stated"],
                expertise["filled_page_silent"],
            ),
            (6, 4, 1),
        )
        self.assertAlmostEqual(expertise["completeness"]["value"], 4 / 6)
        self.assertEqual(scored["fields"]["person"]["completeness"]["k"], 10)
        self.assertEqual(scored["fields"]["projects"]["unanswered"], 10)
        self.assertEqual(scored["fields"]["role/affiliation"]["unanswered"], 10)
        pooled = scored["completeness"]
        self.assertEqual((pooled["filled_where_stated"], pooled["stated"]), (14, 16))
        self.assertAlmostEqual(pooled["value"], 14 / 16)
        self.assertIsNotNone(pooled["ci"])

    def test_kappa_on_the_overlap_rows(self) -> None:
        self.fill_both()
        agreement = labelled_completeness(self.folder, SHA)["agreement"]
        self.assertEqual(agreement["overlap"], 8)
        self.assertEqual(agreement["fields"]["expertise"]["pairs"], 8)
        self.assertAlmostEqual(agreement["fields"]["expertise"]["agreement"], 0.75)
        self.assertAlmostEqual(agreement["fields"]["expertise"]["kappa"], 0.5)
        # Both said yes to every name: chance agreement is 1, so kappa is undefined, not 1.
        self.assertIsNone(agreement["fields"]["person"]["kappa"])
        self.assertEqual(agreement["pooled"]["pairs"], 16)
        self.assertAlmostEqual(agreement["pooled"]["kappa"], (0.875 - 0.625) / 0.375)

    def test_a_sheet_saved_back_with_semicolons_and_a_bom_reads_the_same(self) -> None:
        self.fill_both()
        commas = labelled_completeness(self.folder, SHA)
        self.fill_both(peter_delimiter=";")
        self.assertTrue((self.folder / "sheet-peter.csv").read_bytes().startswith(b"\xef\xbb\xbf"))
        self.assertEqual(labelled_completeness(self.folder, SHA), commas)

    def test_sheets_from_other_predictions_or_with_foreign_rows_are_refused(self) -> None:
        self.fill_both()
        with self.assertRaises(LoadError):
            labelled_completeness(self.folder, "0" * 64)
        sheet = self.folder / "sheet-peter.csv"
        sheet.write_text(sheet.read_text() + "10,person,Invented,https://unibe.test/9,y\n")
        with self.assertRaises(LoadError):
            labelled_completeness(self.folder, SHA)

    def test_kappa_by_hand(self) -> None:
        self.assertIsNone(kappa([]))
        self.assertEqual(kappa([(True, True), (False, False)]), 1.0)
        self.assertEqual(kappa([(True, False), (False, True)]), -1.0)


class CliTest(unittest.TestCase):
    def test_filled_sheets_are_scored_into_the_metrics(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        folder = Path(tmp.name)
        args = ["--gold", str(GOLD), "--predictions", str(FIXTURES / "predictions.jsonl")]
        args += ["--out", str(folder / "out"), "--labelling-dir", str(folder / "sheets")]
        with redirect_stdout(io.StringIO()):
            self.assertEqual(main(args), 0)
        key = json.loads((folder / "sheets" / "key.json").read_text())
        for who in ("peter", "nik"):
            mine = [item["item"] for item in key["items"] if who in item["labellers"]]
            fill(folder / "sheets" / f"sheet-{who}.csv", {item: {"person": "y"} for item in mine})
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            self.assertEqual(main([*args, "--labels", str(folder / "sheets")]), 0)
        self.assertIn("holds answered sheets, left as they are", err.getvalue())
        metrics = json.loads((folder / "out" / "metrics.json").read_text())
        labelled = metrics["labelled_completeness"]
        self.assertEqual(labelled["status"], "labelled")
        self.assertEqual(labelled["labelled"], len(key["items"]))
        self.assertIn("labels_key", metrics["input_sha256"])
        self.assertIn("Labelled completeness:", out.getvalue())


if __name__ == "__main__":
    unittest.main()
