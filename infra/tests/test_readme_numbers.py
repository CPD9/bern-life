import ast
import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from infra import readme_numbers
from infra.readme_numbers import END, START, main, percent, percent_interval, render

SNAPSHOT = "bundle-20990101-1"
# Invented sha256 values of the bundle's scored files, as its manifest lists them.
HASHES = {"predictions": "a" * 64, "pages": "b" * 64, "profiles": "c" * 64}


def mean(value, low, high, queries):
    return {"value": value, "ci": [low, high], "queries": queries}


def share(k, n, low, high):
    return {"k": k, "n": n, "value": k / n, "ci": [low, high]}


def recall_only(value):
    return {"recall_at_10": value}


def exposure_row(name, slots, slot_share, profile_share):
    return {"name": name, "slots": slots, "slot_share": slot_share, "profile_share": profile_share}


# Invented numbers: one claim untraceable, a variant with nothing to measure, a source the README
# does not list, agreement missing for one variant, and a false abstention that is not on the
# site's wording.
def invented_metrics(predictions: Path) -> dict:
    return {
        "inputs": {"gold": "eval/gold.jsonl", "predictions": str(predictions)},
        "input_sha256": {"gold": "d" * 64, **HASHES},
        "slices": {
            "pooled": {
                "queries": 12,
                "recall_at_10": mean(0.5, 0.25, 0.75, 9),
                "mrr": mean(0.625, 0.4, 0.8125, 9),
                "invented_abstained": share(2, 3, 0.2077, 0.9385),
                "false_abstention": share(1, 9, 0.0199, 0.4350),
                "traceable_claims": share(1234, 1235, 0.9954, 0.9999),
                "invented_entities": 0,
            },
            "variant:site": recall_only(mean(0.6, 0.3, 0.9, 4)),
            "variant:synonym": recall_only(mean(1.0, 1.0, 1.0, 2)),
            "variant:lay": recall_only(None),
            "variant:translation": recall_only(mean(0.3333, 0.0, 0.6667, 3)),
            "lang:en": recall_only(mean(0.75, 0.5, 1.0, 5)),
            "lang:de": recall_only(mean(0.125, 0.0, 0.25, 2)),
            "lang:fr": recall_only(mean(0.0, 0.0, 0.0, 2)),
            "source:unibe": recall_only(mean(0.2, 0.0, 0.4, 5)),
            "source:artorg": recall_only(mean(0.7, 0.4, 1.0, 2)),
            "source:dcb": recall_only(mean(0.9, 0.8, 1.0, 2)),
        },
        "variant_agreement": {
            "synonym": {"pairs": 2, "jaccard_mean": 0.4, "both_empty": 0},
            "translation": {"pairs": 3, "jaccard_mean": None, "both_empty": 3},
        },
        "exposure": {
            "slots": 30,
            "by_source": [
                exposure_row("unibe", 15, 0.5, 0.8),
                exposure_row("artorg", 9, 0.3, 0.1),
                exposure_row("dcb", 6, 0.2, 0.05),
                exposure_row("fundinghost", 0, 0.0, 0.05),
            ],
        },
        "completeness": {
            "filled": {
                "expertise": 20,
                "infrastructure/services": 2,
                "person": 30,
                "projects": 1,
                "reason": 30,
                "role/affiliation": 12,
                "source link": 30,
                "unit": 25,
            },
            "mean_share": 0.625,
            "results": 30,
            "status": "human check pending",
        },
        "decisions": {
            "criterion_1": {"status": "not met", "recall_at_10": 0.5, "ci": [0.25, 0.75]},
            "criterion_3": {"status": "not met", "untraceable": 1, "invented_entities": 0},
            "abstention": {
                "status": "not met",
                "invented_abstained": 2,
                "invented": 3,
                "site_false_abstentions": 0,
            },
        },
    }


EXPECTED = """
<!-- Written by infra/readme_numbers.py from eval/out/metrics.json: change the script, not this block. -->

| What the case asks | Where it shows | Measured (95% interval) |
|---|---|---|
| 1. Finds the right people: ≥ 80% of expected experts and units in the top 10 | The result list in Ask | recall@10 **0.50** [0.25, 0.75] against the case's **0.80**: **not met**. MRR 0.62 [0.40, 0.81]. |
| 2. Different wording finds the same experts | "Also searched for" on every answer: synonyms, lay terms, translations, acronyms | recall@10 on the site's own wording 0.60 [0.30, 0.90] (4 questions); synonyms 1.00 [1.00, 1.00] (2); lay terms —; translations 0.33 [0.00, 0.67] (3). By language: en 0.75 [0.50, 1.00] (5), de 0.12 [0.00, 0.25] (2), fr 0.00 [0.00, 0.00] (2). Top-10 overlap with the site's wording (mean Jaccard): synonyms 0.40, lay terms —, translations —. |
| 3. Every result traceable, nothing invented | The evidence panel behind every claim: verbatim sentence, source link, fetch date | Claims whose sentence is verbatim on their stored page: 1,234 / 1,235, **99.9%** [99.5%, 100%]. Results not in the snapshot (invented entities): **0**. Pre-registered rule: **not met**. |
| Ethics: says so when no reliable source exists | "No verifiable source" instead of results | Invented questions abstained **2 / 3** [0.21, 0.94]; the pre-registered rule asks ≥ 3 / 3, and at most 1 false abstention on the site's own wording, where there are **0**: **not met**. False abstentions on all answerable questions **1 / 9** [0.02, 0.43]. |
| 4. Structured results | Result card fields: person, role, unit, expertise, projects, infrastructure and services, why it matches, source link | Mean share of the 8 fields filled: 0.62 over 30 shown results. Filled per field: person 30, role/affiliation 12, unit 25, expertise 20, projects 1, infrastructure/services 2, reason 30, source link 30. No interval: the pre-registered human check of what each page could fill is still to do. |
| 5. Covers UniBE, ARTORG and Diabetes Center Berne | Places on the map; the source on every card | recall@10 UniBE 0.20 [0.00, 0.40], ARTORG 0.70 [0.40, 1.00], DCB 0.90 [0.80, 1.00]. Share of top-10 slots 0.50 / 0.30 / 0.20 against share of profiles in the snapshot 0.80 / 0.10 / 0.05. |
| 6. Easy to extend | One JSON file in [`sources/`](sources/) and one command ([playbook](docs/playbooks/add-a-source.md)) | Not a measured number. `python -m bernlife crawl --source <id>` crawls a new file, and only that source's records are replaced. |

Snapshot `bundle-20990101-1`, 12 gold questions. To reproduce: `make fetch && make eval && python3 infra/readme_numbers.py`. CI fails when this block differs from the evaluator's output.
"""  # noqa: E501

HEAD = "# Invented project\n\n## Against the case\n\nText kept as it is.\n\n"
TAIL = "\n\n## Limits\n\nAlso kept.\n"


class Workspace:
    """A bundle folder with its manifest, a lock file, metrics and a README, all invented."""

    def __init__(self, root: Path, pinned: str = SNAPSHOT, block: str = "\nold numbers\n"):
        bundle = root / "bundle"
        bundle.mkdir()
        self.manifest = bundle / "manifest.json"
        self.write_manifest(HASHES)
        self.metrics, self.lock, self.readme = root / "metrics.json", root / "lock", root / "README"
        self.write_metrics(invented_metrics(bundle / "predictions.jsonl"))
        self.lock.write_text(json.dumps({"version": pinned}), encoding="utf-8")
        self.readme.write_text(HEAD + START + block + END + TAIL, encoding="utf-8")

    def write_manifest(self, hashes: dict) -> None:
        files = {f"{name}.jsonl": {"sha256": sha} for name, sha in hashes.items()}
        manifest = {"version": SNAPSHOT, "files": files}
        self.manifest.write_text(json.dumps(manifest), encoding="utf-8")

    def write_metrics(self, metrics: object) -> None:
        self.metrics.write_text(json.dumps(metrics), encoding="utf-8")

    def stored_metrics(self) -> dict:
        return json.loads(self.metrics.read_text(encoding="utf-8"))

    def run(self, *flags: str) -> tuple[int, str, str]:
        out, err = io.StringIO(), io.StringIO()
        paths = ["--metrics", self.metrics, "--readme", self.readme, "--lock", self.lock]
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = main([*flags, *map(str, paths)])
        return code, out.getvalue(), err.getvalue()

    def text(self) -> str:
        return self.readme.read_text(encoding="utf-8")


class RenderTest(unittest.TestCase):
    def test_every_number_comes_from_the_metrics(self):
        with tempfile.TemporaryDirectory() as tmp:
            metrics = invented_metrics(Path(tmp) / "predictions.jsonl")
        self.assertEqual(render(metrics, SNAPSHOT), EXPECTED)

    def test_a_single_untraceable_claim_never_shows_as_100_percent(self):
        self.assertEqual(percent(4818, 4819), "99.9%")
        self.assertEqual(percent(4819, 4819), "100%")

    def test_interval_bounds_round_outward(self):
        self.assertEqual(percent_interval([0.999204, 1.0]), " [99.9%, 100%]")
        self.assertEqual(percent_interval([0.995, 0.99941]), " [99.5%, 100%]")
        self.assertEqual(percent_interval([0.5, 0.75]), " [50.0%, 75.0%]")
        self.assertEqual(percent_interval(None), "")

    def test_the_bars_are_the_evaluators(self):
        summary = Path(readme_numbers.ROOT, "eval/src/evaluator/summary.py")
        constants = {
            target.id: ast.literal_eval(node.value)
            for node in ast.parse(summary.read_text(encoding="utf-8")).body
            if isinstance(node, ast.Assign)
            for target in node.targets
            if isinstance(target, ast.Name)
            and target.id in {"RECALL_BAR", "INVENTED_BAR", "SITE_FALSE_ABSTENTIONS_ALLOWED"}
        }
        self.assertEqual(
            constants,
            {
                "RECALL_BAR": readme_numbers.RECALL_BAR,
                "INVENTED_BAR": readme_numbers.INVENTED_BAR,
                "SITE_FALSE_ABSTENTIONS_ALLOWED": readme_numbers.SITE_FALSE_ABSTENTIONS_ALLOWED,
            },
        )


class MainTest(unittest.TestCase):
    def test_writes_the_block_and_keeps_the_rest_of_the_readme(self):
        with tempfile.TemporaryDirectory() as tmp:
            space = Workspace(Path(tmp))
            code, out, _ = space.run()
            self.assertEqual(code, 0)
            self.assertEqual(out, "README numbers written from bundle-20990101-1\n")
            self.assertEqual(space.text(), HEAD + START + EXPECTED + END + TAIL)

    def test_check_passes_when_the_readme_matches(self):
        with tempfile.TemporaryDirectory() as tmp:
            space = Workspace(Path(tmp), block=EXPECTED)
            code, out, _ = space.run("--check")
            self.assertEqual(code, 0)
            self.assertEqual(out, "README numbers match the evaluator on bundle-20990101-1\n")
            self.assertEqual(space.text(), HEAD + START + EXPECTED + END + TAIL)

    def test_check_fails_with_a_diff_and_writes_nothing(self):
        with tempfile.TemporaryDirectory() as tmp:
            space = Workspace(Path(tmp))
            code, out, err = space.run("--check")
            self.assertEqual(code, 1)
            diff = out.splitlines()
            self.assertEqual(diff[0], "--- README (numbers block)")
            self.assertEqual(diff[1], "+++ infra/readme_numbers.py")
            self.assertIn("-old numbers", diff)
            self.assertIn(
                "+Snapshot `bundle-20990101-1`, 12 gold questions. To reproduce: `make fetch &&"
                " make eval && python3 infra/readme_numbers.py`. CI fails when this block differs"
                " from the evaluator's output.",
                diff,
            )
            self.assertIn("README numbers differ", err)
            self.assertEqual(space.text(), HEAD + START + "\nold numbers\n" + END + TAIL)

    def test_refuses_metrics_from_a_bundle_the_lock_does_not_pin(self):
        with tempfile.TemporaryDirectory() as tmp:
            space = Workspace(Path(tmp), pinned="bundle-20990102-1")
            code, _, err = space.run()
            self.assertEqual(code, 2)
            self.assertEqual(
                err,
                "readme_numbers: the metrics are from bundle-20990101-1,"
                " but bundle.lock pins bundle-20990102-1\n",
            )
            self.assertEqual(space.text(), HEAD + START + "\nold numbers\n" + END + TAIL)

    def test_refuses_metrics_left_over_from_another_bundle(self):
        with tempfile.TemporaryDirectory() as tmp:
            space = Workspace(Path(tmp))
            space.write_manifest({**HASHES, "predictions": "e" * 64})
            code, _, err = space.run("--check")
            self.assertEqual(code, 2)
            self.assertEqual(
                err,
                "readme_numbers: the metrics were not computed from the predictions.jsonl of"
                " bundle-20990101-1: run make eval again\n",
            )

    def test_refuses_metrics_without_the_sha256_of_their_inputs(self):
        with tempfile.TemporaryDirectory() as tmp:
            space = Workspace(Path(tmp))
            metrics = space.stored_metrics()
            del metrics["input_sha256"]
            space.write_metrics(metrics)
            code, _, err = space.run()
            self.assertEqual(code, 2)
            self.assertIn("record no sha256", err)
            self.assertEqual(space.text(), HEAD + START + "\nold numbers\n" + END + TAIL)

    def test_missing_metrics_exit_2(self):
        with tempfile.TemporaryDirectory() as tmp:
            space = Workspace(Path(tmp))
            space.metrics.unlink()
            code, _, err = space.run("--check")
            self.assertEqual(code, 2)
            self.assertIn("run make fetch && make eval first", err)

    def test_metrics_missing_a_key_exit_2(self):
        with tempfile.TemporaryDirectory() as tmp:
            space = Workspace(Path(tmp))
            metrics = space.stored_metrics()
            del metrics["exposure"]
            space.write_metrics(metrics)
            code, _, err = space.run("--check")
            self.assertEqual(code, 2)
            self.assertIn("has no 'exposure'", err)

    def test_malformed_metrics_exit_2(self):
        with tempfile.TemporaryDirectory() as tmp:
            space = Workspace(Path(tmp))
            for malformed in ([], {**space.stored_metrics(), "completeness": None}):
                space.write_metrics(malformed)
                code, _, err = space.run("--check")
                self.assertEqual(code, 2)
                self.assertIn("is malformed", err)

    def test_refuses_a_readme_without_exactly_one_block(self):
        with tempfile.TemporaryDirectory() as tmp:
            space = Workspace(Path(tmp))
            space.readme.write_text(HEAD + START + END + START + END + TAIL, encoding="utf-8")
            code, _, err = space.run("--check")
            self.assertEqual(code, 2)
            self.assertIn("needs exactly one", err)


if __name__ == "__main__":
    unittest.main()
