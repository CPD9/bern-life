import io
import json
import shutil
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime, timedelta, timezone
from pathlib import Path

from evaluator.__main__ import main

FIXTURES = Path(__file__).resolve().parent / "fixtures"
GOLD = Path(__file__).resolve().parents[1] / "gold.jsonl"
INPUTS = ("predictions", "pages", "profiles")
VERSION = "bundle-20261018-9"
BERN_SUMMER_TIME = timezone(timedelta(hours=2))

FIXTURE_HEADLINE = {
    "snapshot": VERSION,
    "generated_at": "2026-10-19T04:00:05Z",
    "eval": {
        "queries": 48,
        "recall_at_10": {"value": 0.1298, "low": 0.0, "high": 0.2772},
        "mrr": 0.1184,
        "invented_abstained": {"n": 9, "of": 10},
        "false_abstention": {"n": 31, "of": 38},
        "traceable": {"n": 21, "of": 22},
        "invented_entities": 1,
        "slices": [
            {"name": "unibe", "recall_at_10": 0.1},
            {"name": "artorg", "recall_at_10": 0.1026},
            {"name": "dcb", "recall_at_10": 0.2778},
            {"name": "de", "recall_at_10": 0.0},
            {"name": "en", "recall_at_10": 0.2242},
            {"name": "fr", "recall_at_10": 0.0},
            {"name": "site", "recall_at_10": 0.1762},
            {"name": "synonym", "recall_at_10": 0.4889},
            {"name": "lay", "recall_at_10": 0.3333},
            {"name": "translation", "recall_at_10": 0.0},
            {"name": "control", "recall_at_10": 0.0},
        ],
    },
}


class HeadlineTest(unittest.TestCase):
    """The invented fixture copied into a bundle folder with a manifest, as make fetch lays out."""

    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.dir = Path(tmp.name)
        self.bundle = self.dir / "bundle"
        self.bundle.mkdir()
        for name in INPUTS:
            shutil.copyfile(FIXTURES / f"{name}.jsonl", self.bundle / f"{name}.jsonl")
        self.results = self.dir / "results"

    def manifest(self, version: object) -> None:
        manifest = {"version": version, "files": {}}
        (self.bundle / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

    def run_main(self, predictions: Path, snapshot: Path) -> tuple[int, str, str]:
        folders = {"predictions": predictions, "pages": snapshot, "profiles": snapshot}
        args = ["--gold", str(GOLD), "--out", str(self.dir / "out")]
        args += ["--results-dir", str(self.results)]
        for name, folder in folders.items():
            args += [f"--{name}", str(folder / f"{name}.jsonl")]
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            code = main(args, clock=lambda: datetime(2026, 10, 19, 6, 0, 5, 0, BERN_SUMMER_TIME))
        return code, out.getvalue(), err.getvalue()

    def test_a_run_on_one_bundle_writes_its_headline_in_utc_with_four_decimals(self) -> None:
        self.manifest(VERSION)
        code, report, _ = self.run_main(self.bundle, self.bundle)
        self.assertEqual(code, 0)
        written = (self.results / VERSION / "metrics.json").read_text(encoding="utf-8")
        self.assertEqual(json.loads(written), FIXTURE_HEADLINE)
        self.assertEqual(sorted(path.name for path in self.results.iterdir()), [VERSION])

        _, unwritten, _ = self.run_main(FIXTURES, FIXTURES)
        self.assertEqual(report.split("\n", 1)[1], unwritten.split("\n", 1)[1])
        self.assertIn("| pooled | 48 | 0.13 [0.00, 0.28] | 0.12 [0.00, 0.25] |", report)

    def test_without_a_manifest_nothing_is_written(self) -> None:
        for folder in (FIXTURES, self.bundle):
            with self.subTest(folder=folder.name):
                self.assertEqual(self.run_main(folder, folder)[0], 0)
                self.assertFalse(self.results.exists())

    def test_other_predictions_are_not_labelled_with_the_bundle(self) -> None:
        self.manifest(VERSION)
        self.assertEqual(self.run_main(FIXTURES, self.bundle)[0], 0)
        self.assertFalse(self.results.exists())

    def test_a_version_that_is_not_a_plain_folder_name_is_refused(self) -> None:
        manifest = self.bundle.resolve() / "manifest.json"
        for version in ("../escape", ".hidden", 7):
            with self.subTest(version=version):
                self.manifest(version)
                code, report, error = self.run_main(self.bundle, self.bundle)
                self.assertEqual((code, report), (2, ""))
                self.assertEqual(
                    error, f"eval: {manifest}: the bundle version is not a plain folder name\n"
                )
        self.assertFalse(self.results.exists())
        self.assertFalse((self.dir / "escape").exists())

    def test_a_manifest_without_a_version_is_refused(self) -> None:
        (self.bundle / "manifest.json").write_text("{not json", encoding="utf-8")
        code, _, error = self.run_main(self.bundle, self.bundle)
        manifest = self.bundle.resolve() / "manifest.json"
        self.assertEqual((code, error), (2, f"eval: {manifest}: no bundle version\n"))
        self.assertFalse(self.results.exists())


if __name__ == "__main__":
    unittest.main()
