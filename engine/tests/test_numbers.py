import json
import lzma
import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path

from bernlife.cache import PACK
from bernlife.numbers import committed_eval, model_use, numbers_report, recorded_use
from contract_schemas import validator

SNAPSHOT = "local-0123456789ab"
EVAL = {
    "queries": 48,
    "recall_at_10": {"value": 0.36, "low": 0.22, "high": 0.51},
    "mrr": 0.43,
    "invented_abstained": {"n": 8, "of": 10},
    "false_abstention": {"n": 0, "of": 38},
    "traceable": {"n": 1674, "of": 1674},
    "invented_entities": 0,
    "slices": [{"name": "en", "recall_at_10": 0.42}],
}


def entry(role: str, latency_ms: int, model: str = "fake-70b") -> dict[str, object]:
    return {"role": role, "model": model, "latency_ms": latency_ms, "content": "[]"}


def write_pack(root: Path, entries: list[dict[str, object]]) -> None:
    root.mkdir(parents=True, exist_ok=True)
    with lzma.open(root / PACK, "wt", encoding="utf-8") as pack:
        for index, item in enumerate(entries):
            pack.write(json.dumps({"key": f"{index:064x}", **item}) + "\n")


def write_metrics(results: Path, snapshot: str) -> None:
    folder = results / snapshot
    folder.mkdir(parents=True)
    metrics = {"snapshot": snapshot, "generated_at": "2026-10-19T03:00:00Z", "eval": EVAL}
    (folder / "metrics.json").write_text(json.dumps(metrics))


class ModelUseTest(unittest.TestCase):
    def test_calls_and_nearest_rank_latencies_per_role_and_model(self):
        entries = [entry("explain", ms) for ms in (400, 100, 300, 200)]
        entries += [entry("expand", ms * 10) for ms in range(20, 0, -1)]
        entries += [entry("expand", 900, "fake-8b")]
        self.assertEqual(
            model_use(entries),
            [
                {
                    "role": "expand",
                    "model": "fake-70b",
                    "calls": 20,
                    "ok": 20,
                    "median_ms": 100,
                    "p95_ms": 190,
                },
                {
                    "role": "expand",
                    "model": "fake-8b",
                    "calls": 1,
                    "ok": 1,
                    "median_ms": 900,
                    "p95_ms": 900,
                },
                {
                    "role": "explain",
                    "model": "fake-70b",
                    "calls": 4,
                    "ok": 4,
                    "median_ms": 200,
                    "p95_ms": 400,
                },
            ],
        )

    def test_the_pack_is_read_once_per_process(self):
        root = Path(tempfile.mkdtemp())
        write_pack(root, [entry("brief", 50)])
        first = recorded_use(root)
        write_pack(root, [entry("brief", 50), entry("brief", 70)])
        self.assertEqual(recorded_use(root), first)
        self.assertEqual([row["calls"] for row in first], [1])


class CommittedEvalTest(unittest.TestCase):
    def setUp(self):
        self.results = Path(tempfile.mkdtemp()) / "results"
        write_metrics(self.results, SNAPSHOT)

    def test_the_loaded_snapshots_eval_or_none(self):
        self.assertEqual(committed_eval(self.results, SNAPSHOT), EVAL)
        self.assertIsNone(committed_eval(self.results, "local-ffffffffffff"))

    def test_a_version_that_is_not_one_plain_folder_name_reads_nothing(self):
        write_metrics(self.results / "inner", "x")
        write_metrics(self.results / "inner", ".hidden")
        for snapshot in (f"../{SNAPSHOT}", "x/../x", ".hidden"):
            with self.subTest(snapshot=snapshot):
                self.assertTrue((self.results / "inner" / snapshot / "metrics.json").exists())
                self.assertIsNone(committed_eval(self.results / "inner", snapshot))

    def test_the_report_validates_against_the_contract(self):
        root = Path(tempfile.mkdtemp())
        write_pack(root, [entry("explain", 120), entry("expand", 80)])
        now = datetime(2026, 10, 19, 4, 0, tzinfo=UTC)
        report = numbers_report(SNAPSHOT, now, root, self.results)
        self.assertEqual(
            {key: report[key] for key in ("snapshot", "generated_at", "eval")},
            {"snapshot": SNAPSHOT, "generated_at": "2026-10-19T04:00:00Z", "eval": EVAL},
        )
        self.assertEqual([row["role"] for row in report["models"]], ["expand", "explain"])
        self.assertEqual(list(validator("numbers.schema.json").iter_errors(report)), [])
        metrics = json.loads((self.results / SNAPSHOT / "metrics.json").read_text())
        self.assertEqual(list(validator("metrics.schema.json").iter_errors(metrics)), [])


if __name__ == "__main__":
    unittest.main()
