import io
import json
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

from evaluator.__main__ import main
from evaluator.consistency import (
    WordingSet,
    consistency,
    load_responses,
    load_sets,
)
from evaluator.consistency import (
    main as queries_main,
)
from evaluator.load import LoadError
from records import profile, response, result

FIXTURES = Path(__file__).resolve().parent / "fixtures"
GOLD = Path(__file__).resolve().parents[1] / "gold.jsonl"
REPO_SETS = Path(__file__).resolve().parents[1] / "consistency.jsonl"


def shown(*ids: str, terms: int = 1, query: str = "invented") -> dict:
    """An invented response showing these profile ids, with or without expansion terms."""
    found = response(
        [
            result(rank, profile(f"person-{pid}", "person", pid, f"https://unibe.test/{pid}"))
            for rank, pid in enumerate(ids, 1)
        ]
    )
    found["query"] = query
    found["expanded_terms"] = [{"term": f"t{n}", "kind": "synonym"} for n in range(terms)]
    return found


class ConsistencyTest(unittest.TestCase):
    def test_pairwise_jaccard_and_the_share_the_first_wording_also_finds(self) -> None:
        sets = [WordingSet("need", ("first", "second", "third"))]
        responses = {
            "need:1": shown("a", "b", "c", "d"),
            "need:2": shown("a", "b", "x", "y"),
            "need:3": shown("e", terms=0),
        }
        measured = consistency(sets, responses)
        need = measured["sets"][0]
        # a-b: {a,b} of {a,b,c,d,x,y} = 1/3; a-c and b-c share nothing.
        self.assertAlmostEqual(need["jaccard_mean"], (1 / 3 + 0 + 0) / 3)
        self.assertEqual((need["pairs"], need["both_empty"]), (3, 0))
        shares = [q["found_by_first"] for q in need["queries"]]
        self.assertEqual(shares, [None, 0.5, 0.0])
        self.assertAlmostEqual(need["found_by_first_mean"], 0.25)
        self.assertEqual(measured["plain_search"], ["third"])
        self.assertEqual(measured["queries"], 3)

    def test_only_the_top_ten_count_and_empty_pairs_are_not_zero(self) -> None:
        sets = [WordingSet("need", ("first", "second", "third"))]
        many = [f"p{n}" for n in range(12)]
        responses = {
            "need:1": shown(*many),
            "need:2": shown("p10", "p11"),
            "need:3": shown(),
        }
        need = consistency(sets, responses)["sets"][0]
        self.assertEqual([q["shown"] for q in need["queries"]], [10, 2, 0])
        self.assertEqual([q["found_by_first"] for q in need["queries"]], [None, 0.0, None])
        self.assertEqual(need["both_empty"], 0)
        empty = consistency(
            [WordingSet("none", ("a", "b"))], {"none:1": shown(), "none:2": shown()}
        )["sets"][0]
        self.assertEqual((empty["jaccard_mean"], empty["both_empty"]), (None, 1))


class LoadTest(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.dir = Path(tmp.name)

    def write(self, name: str, lines: list[dict]) -> Path:
        path = self.dir / name
        path.write_text("".join(json.dumps(line) + "\n" for line in lines), encoding="utf-8")
        return path

    def test_the_repository_sets_are_valid_and_numbered_from_one(self) -> None:
        sets = load_sets(REPO_SETS)
        self.assertEqual(sets[0].id, "glucose-sensors")
        self.assertEqual(sets[0].queries[:2], ("glucose sensors", "CGM"))
        out = io.StringIO()
        with redirect_stdout(out):
            self.assertEqual(queries_main([str(REPO_SETS)]), 0)
        first = json.loads(out.getvalue().splitlines()[0])
        self.assertEqual(first, {"id": "glucose-sensors:1", "query": "glucose sensors"})

    def test_a_set_with_one_wording_is_refused(self) -> None:
        path = self.write("sets.jsonl", [{"id": "need", "queries": ["only"]}])
        with self.assertRaises(LoadError):
            load_sets(path)

    def test_predictions_must_answer_exactly_the_sets_wordings(self) -> None:
        sets = [WordingSet("need", ("first", "second"))]
        right = [
            {"id": "need:1", "response": shown("a", query="first")},
            {"id": "need:2", "response": shown("a", query="second")},
        ]
        self.assertEqual(len(load_responses(self.write("ok.jsonl", right), sets)), 2)
        cases = {
            "missing": right[:1],
            "unknown": [*right, {"id": "need:3", "response": shown(query="third")}],
            "other question": [right[0], {"id": "need:2", "response": shown(query="else")}],
            "twice": [*right, right[0]],
        }
        for name, lines in cases.items():
            with self.subTest(case=name), self.assertRaises(LoadError):
                load_responses(self.write(f"{name}.jsonl", lines), sets)


class CliTest(unittest.TestCase):
    def test_consistency_is_added_to_the_metrics_and_the_report(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        folder = Path(tmp.name)
        sets = folder / "sets.jsonl"
        sets.write_text(json.dumps({"id": "need", "queries": ["one", "two"]}) + "\n")
        predictions = folder / "predictions.jsonl"
        lines = [
            {"id": "need:1", "response": shown("a", "b", query="one")},
            {"id": "need:2", "response": shown("b", query="two", terms=0)},
        ]
        predictions.write_text("".join(json.dumps(line) + "\n" for line in lines))
        args = ["--gold", str(GOLD), "--predictions", str(FIXTURES / "predictions.jsonl")]
        args += ["--out", str(folder / "out"), "--consistency", str(sets)]
        out = io.StringIO()
        with redirect_stdout(out):
            code = main([*args, "--consistency-predictions", str(predictions)])
        self.assertEqual(code, 0)
        metrics = json.loads((folder / "out" / "metrics.json").read_text())
        self.assertEqual(metrics["consistency"]["sets"][0]["jaccard_mean"], 0.5)
        self.assertEqual(metrics["consistency"]["plain_search"], ["two"])
        self.assertIn("| need | 2 | 1 | 0.50 | 1.00 | 0 |", out.getvalue())
        self.assertIn("| two | 1 | 1.00 | plain search |", out.getvalue())

    def test_without_its_predictions_consistency_is_none_and_one_alone_is_refused(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        args = ["--gold", str(GOLD), "--predictions", str(FIXTURES / "predictions.jsonl")]
        args += ["--out", tmp.name]
        with redirect_stdout(io.StringIO()):
            self.assertEqual(main(args), 0)
        metrics = json.loads((Path(tmp.name) / "metrics.json").read_text())
        self.assertIsNone(metrics["consistency"])
        self.assertIsNone(metrics["labelled_completeness"])
        with redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            main([*args, "--consistency", str(REPO_SETS)])


if __name__ == "__main__":
    unittest.main()
