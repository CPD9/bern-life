import contextlib
import hashlib
import io
import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

from infra.report import report_figures
from infra.report.build_report import check_references_last, count_pages, document
from infra.report.report_charts import count_axis
from infra.report.report_figures import (
    EXPLAINERS,
    FINAL_RUN,
    GOLD_RUNS,
    FiguresError,
    figures,
    main,
    still,
)
from infra.report.report_markdown import convert

SVG = "{http://www.w3.org/2000/svg}svg"


def mean(value, low, high, queries):
    return {"value": value, "ci": [low, high], "queries": queries}


def share(k, n, low, high):
    if n == 0:  # the evaluator leaves a share with nothing to count as None, never 0
        return {"k": 0, "n": 0, "value": None, "ci": None}
    return {"k": k, "n": n, "value": k / n, "ci": [low, high]}


def slice_of(recall, mrr, queries, abstained, false):
    return {
        "queries": queries,
        "recall_at_10": mean(recall, recall / 2, min(1.0, recall * 1.5), queries),
        "mrr": mean(mrr, mrr / 2, min(1.0, mrr * 1.3), queries),
        "invented_abstained": share(*abstained, 0.2, 0.9),
        "false_abstention": share(*false, 0.0, 0.4),
        "traceable_claims": share(100, 100, 0.96, 1.0),
        "invented_entities": 0,
    }


def group(name, units, profiles, profile_share, slots, slot_share, never):
    return {
        "name": name,
        "units": units,
        "profiles": profiles,
        "profile_share": profile_share,
        "slots": slots,
        "slot_share": slot_share,
        "units_never_shown": never,
    }


def wording(qid, query, expanded, found, shown):
    return {
        "id": qid,
        "query": query,
        "expanded": expanded,
        "found_by_first": found,
        "shown": shown,
        "abstained": False,
    }


# Invented numbers, small and round, so every expected value below is checked by hand. The two
# size groups hold 3,336 profiles between them, the count the literals of the four kinds give.
def invented_metrics() -> dict:
    return {
        "input_sha256": {"predictions": "a" * 64, "pages": "b" * 64, "profiles": "c" * 64},
        "slices": {
            "pooled": slice_of(0.5, 0.625, 12, (2, 3), (1, 9)),
            "lang:en": slice_of(0.75, 0.8, 5, (1, 1), (0, 4)),
            "lang:de": slice_of(0.125, 0.2, 2, (1, 1), (1, 3)),
            "lang:fr": slice_of(0.0, 0.0, 2, (0, 1), (0, 2)),
            "source:unibe": slice_of(0.2, 0.3, 5, (1, 1), (1, 4)),
            "source:artorg": slice_of(0.7, 0.9, 2, (1, 1), (0, 3)),
            "source:dcb": slice_of(0.9, 1.0, 2, (0, 1), (0, 2)),
            "variant:site": slice_of(0.6, 0.7, 4, (0, 0), (0, 4)),
            "variant:synonym": slice_of(1.0, 1.0, 2, (0, 0), (0, 2)),
            "variant:lay": slice_of(0.5, 0.5, 1, (0, 0), (1, 1)),
            "variant:translation": slice_of(0.25, 0.3, 2, (0, 0), (0, 2)),
            "variant:control": slice_of(0.0, 0.0, 1, (0, 0), (0, 1)),
        },
        "variant_agreement": {
            "synonym": {"pairs": 2, "jaccard_mean": 0.4, "both_empty": 0},
            "lay": {"pairs": 1, "jaccard_mean": 0.1, "both_empty": 0},
            "translation": {"pairs": 2, "jaccard_mean": None, "both_empty": 2},
        },
        "exposure": {
            "slots": 30,
            "by_source": [
                {"name": "unibe", "slots": 15, "slot_share": 0.5, "profile_share": 0.8},
                {"name": "artorg", "slots": 9, "slot_share": 0.3, "profile_share": 0.1},
                {"name": "dcb", "slots": 6, "slot_share": 0.2, "profile_share": 0.05},
                {"name": "fundinghost", "slots": 0, "slot_share": 0.0, "profile_share": 0.05},
            ],
        },
        "exposure_by_size": {
            "sources": ["unibe", "artorg", "dcb"],
            "median_profiles": 12.5,
            "groups": [
                group("small", 3, 1000, 0.3, 6, 0.2, 1),
                group("large", 3, 2336, 0.7, 24, 0.8, 0),
            ],
            "by_source": [
                {
                    "source": "unibe",
                    "groups": [
                        group("small", 3, 1000, 0.4, 6, 0.4, 1),
                        group("large", 1, 1500, 0.6, 9, 0.6, 0),
                    ],
                },
                {"source": "artorg", "groups": [group("large", 1, 500, 1.0, 9, 1.0, 0)]},
                {"source": "dcb", "groups": [group("large", 1, 336, 1.0, 6, 1.0, 0)]},
            ],
            "slots_outside": 0,
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
        "consistency": {
            "jaccard_mean": 0.2,
            "queries": 5,
            "plain_search": ["b"],
            "sets": [
                {
                    "id": "one-need",
                    "pairs": 3,
                    "jaccard_mean": 0.25,
                    "found_by_first_mean": 0.5,
                    "both_empty": 0,
                    "queries": [
                        wording("one-need:1", "a", True, None, 10),
                        wording("one-need:2", "b", False, 0.4, 5),
                        wording("one-need:3", "c", True, 0.6, 10),
                    ],
                },
                {
                    "id": "other-need",
                    "pairs": 1,
                    "jaccard_mean": 0.15,
                    "found_by_first_mean": 0.3,
                    "both_empty": 0,
                    "queries": [
                        wording("other-need:1", "d", True, None, 10),
                        wording("other-need:2", "e", True, 0.3, 10),
                    ],
                },
            ],
        },
    }


ANIMATED = (
    '<svg xmlns="http://www.w3.org/2000/svg">\n'
    "  <style>\n"
    "    .a { opacity: 0; animation: show 1s ease-out infinite; }\n"
    "    .b { fill: #000; }\n"
    "    @keyframes show { 0% { opacity: 0; } 100% { opacity: 1; } }\n"
    "    @media (prefers-color-scheme: dark) {\n"
    "      .b { fill: #fff; }\n"
    "    }\n"
    "  </style>\n"
    '  <rect class="a b"/>\n'
    "</svg>\n"
)
STILL = (
    '<svg xmlns="http://www.w3.org/2000/svg">\n'
    "  <style>\n"
    "    .a { opacity: 0; }\n"
    "    .b { fill: #000; }\n"
    "  </style>\n"
    '  <rect class="a b"/>\n'
    "</svg>\n"
)


class FiguresTest(unittest.TestCase):
    def setUp(self):
        self.drawn = figures(invented_metrics())

    def test_every_figure_is_well_formed_svg(self):
        self.assertEqual(len(self.drawn), 10)
        for name, (svg, _) in self.drawn.items():
            with self.subTest(name):
                self.assertEqual(ET.fromstring(svg).tag, SVG)

    def test_recall_rows_come_from_the_slices(self):
        rows = self.drawn["recall_by_language"][1]["rows"]
        self.assertEqual(
            rows[0],
            {
                "label": "English",
                "queries": 5,
                "recall_at_10": 0.75,
                "ci95": [0.375, 1.0],
                "mrr": 0.8,
            },
        )
        self.assertEqual(rows[3]["label"], "All questions")
        self.assertEqual((rows[3]["recall_at_10"], rows[3]["mrr"]), (0.5, 0.625))
        self.assertEqual(self.drawn["recall_by_language"][1]["bar"], 0.8)
        sources = [r["label"] for r in self.drawn["recall_by_source"][1]["rows"]]
        self.assertEqual(sources, ["UniBE", "ARTORG", "DCB", "All questions"])

    def test_wording_rows_carry_the_overlap_with_the_site_wording(self):
        rows = self.drawn["recall_by_wording"][1]["rows"]
        self.assertEqual([r["label"] for r in rows][:2], ["Site's own wording", "Synonyms"])
        self.assertEqual([r["jaccard_with_site"] for r in rows], [None, 0.4, 0.1, None, None])

    def test_slots_against_profiles(self):
        numbers = self.drawn["slots_by_source"][1]
        self.assertEqual(numbers["slots"], 30)
        self.assertEqual(
            numbers["rows"][2],
            {"label": "DCB", "slots": 6, "slot_share": 0.2, "profile_share": 0.05},
        )

    def test_consistency_counts_recorded_expansions(self):
        numbers = self.drawn["consistency_sets"][1]
        self.assertEqual((numbers["jaccard_mean"], numbers["wordings"]), (0.2, 5))
        self.assertEqual(numbers["plain_search"], ["b"])
        first = numbers["sets"][0]
        self.assertEqual(
            (first["set"], first["wordings"], first["expansion_recorded"]), ("one-need", 3, 2)
        )
        self.assertEqual(first["found_by_first"][1], {"query": "b", "shown": 5, "share": 0.4})

    def test_consistency_missing_is_a_note_not_a_crash(self):
        metrics = invented_metrics()
        metrics["consistency"] = None
        svg, numbers = figures(metrics)["consistency_sets"]
        self.assertIsNone(numbers)
        self.assertIn("Not computed", svg)
        self.assertEqual(ET.fromstring(svg).tag, SVG)

    def test_exposure_by_size_rows(self):
        numbers = self.drawn["exposure_by_size"][1]
        self.assertEqual(numbers["median_profiles"], 12.5)
        labels = [r["label"] for r in numbers["rows"]]
        self.assertEqual(
            labels,
            [
                "Small units, ≤ 12.5 profiles",
                "Large units, > 12.5 profiles",
                "UniBE, small",
                "UniBE, large",
                "ARTORG, large",
                "DCB, large",
            ],
        )
        self.assertEqual(numbers["rows"][0]["units_never_shown"], 1)

    def test_abstention_rows(self):
        rows = self.drawn["abstention"][1]["rows"]
        self.assertEqual(
            rows[0],
            {
                "label": "Invented, all languages",
                "k": 2,
                "n": 3,
                "share": 0.6667,
                "ci95": [0.2, 0.9],
            },
        )
        self.assertEqual(
            rows[4],
            {
                "label": "Answerable, all languages",
                "k": 1,
                "n": 9,
                "share": 0.1111,
                "ci95": [0.0, 0.4],
            },
        )
        self.assertEqual(self.drawn["abstention"][1]["bar"], 0.9)

    def test_completeness_shares_in_the_case_order(self):
        numbers = self.drawn["completeness"][1]
        self.assertEqual((numbers["results"], numbers["mean_share"]), (30, 0.625))
        self.assertEqual(
            [(r["field"], r["share"]) for r in numbers["rows"]],
            [
                ("person", 1.0),
                ("role/affiliation", 0.4),
                ("unit", 0.8333),
                ("expertise", 0.6667),
                ("projects", 0.0333),
                ("infrastructure/services", 0.0667),
                ("reason", 1.0),
                ("source link", 1.0),
            ],
        )

    def test_gold_runs_end_with_the_metrics_pooled_row(self):
        rows = self.drawn["gold_runs"][1]["rows"]
        self.assertEqual(len(rows), len(GOLD_RUNS) + 1)
        self.assertEqual(rows[0]["recall_at_10"], 0.31)
        self.assertEqual(
            rows[-1],
            {
                "change": FINAL_RUN[0],
                "date": FINAL_RUN[1],
                "recall_at_10": 0.5,
                "ci95": [0.25, 0.75],
                "mrr": 0.625,
                "read_from": "metrics.json, slices.pooled",
            },
        )

    def test_extraction_funnel_counts(self):
        numbers = self.drawn["extraction_funnel"][1]
        self.assertEqual(numbers["dropped_share"], 0.0689)
        self.assertEqual([s["count"] for s in numbers["stages"]], [3351, 16700, 1151, 3336, 4877])
        self.assertEqual(
            [s["about"] for s in numbers["stages"]], [False, True, False, False, False]
        )
        self.assertEqual(numbers["stages"][3]["read_from"], "metrics.json, exposure_by_size")

    def test_count_axis_has_few_round_ticks(self):
        axis = count_axis([3351, 16700, 1151])
        self.assertEqual(axis.maximum, 20000)
        self.assertEqual([label for _, label in axis.ticks], ["0", "10,000", "20,000"])
        self.assertEqual(axis.fmt(16700), "16,700")

    def test_profile_counts_that_disagree_with_the_metrics_are_refused(self):
        metrics = invented_metrics()
        metrics["exposure_by_size"]["groups"][0]["profiles"] = 10
        with self.assertRaises(FiguresError) as refused:
            figures(metrics)
        self.assertIn(
            "sum to 3,336, but metrics.json counts 2,346 profiles", str(refused.exception)
        )


class GoldLiteralsTest(unittest.TestCase):
    def test_base_needs_match_the_frozen_gold_set(self):
        rows = [
            json.loads(line)
            for line in (report_figures.ROOT / "eval/gold.jsonl")
            .read_text(encoding="utf-8")
            .splitlines()
            if line.strip()
        ]
        wordings = Counter(
            row.get("variant_of", row["id"]) for row in rows if not row["expect"]["abstain"]
        )
        literal = report_figures.READ_FROM_DOCS
        self.assertEqual(literal["gold_base_needs"].value, len(wordings))
        self.assertEqual(literal["gold_base_needs"].value, 20)
        reworded = sum(1 for count in wordings.values() if count > 1)
        self.assertEqual(literal["gold_base_needs_reworded"].value, reworded)
        self.assertEqual(literal["gold_base_needs_reworded"].value, 14)


class StillTest(unittest.TestCase):
    def test_animation_and_media_blocks_go_and_nothing_else(self):
        self.assertEqual(still(ANIMATED), STILL)

    def test_the_explainers_become_well_formed_stills(self):
        for name in EXPLAINERS:
            with self.subTest(name):
                animated = (report_figures.ASSETS / f"{name}.svg").read_text(encoding="utf-8")
                self.assertIn("@keyframes", animated)
                frozen = still(animated)
                self.assertEqual(ET.fromstring(frozen).tag, SVG)
                for gone in ("@keyframes", "@media", "animation:"):
                    self.assertNotIn(gone, frozen)
                self.assertIn("Example data is invented.", frozen)


class MainTest(unittest.TestCase):
    def test_writes_figures_stills_and_numbers(self):
        with tempfile.TemporaryDirectory() as tmp:
            metrics, out = Path(tmp) / "metrics.json", Path(tmp) / "figures"
            raw = json.dumps(invented_metrics()).encode()
            metrics.write_bytes(raw)
            with contextlib.redirect_stdout(io.StringIO()) as printed:
                code = main(["--metrics", str(metrics), "--out", str(out)])
            self.assertEqual(code, 0)
            self.assertEqual(
                printed.getvalue(), f"wrote 10 figures, 3 stills and numbers.json to {out}\n"
            )
            written = sorted(p.name for p in out.iterdir())
            self.assertEqual(len(written), 14)
            self.assertIn("explain-ask.svg", written)
            numbers = json.loads((out / "numbers.json").read_text(encoding="utf-8"))
            self.assertEqual(numbers["metrics"], str(metrics.resolve()))
            self.assertEqual(numbers["metrics_sha256"], hashlib.sha256(raw).hexdigest())
            self.assertEqual(numbers["input_sha256"]["pages"], "b" * 64)
            self.assertEqual(numbers["read_from_docs"]["pages"]["value"], 3351)
            self.assertEqual(numbers["extraction_funnel"]["stages"][0]["count"], 3351)

    def test_missing_metrics_exit_2(self):
        with tempfile.TemporaryDirectory() as tmp:
            with contextlib.redirect_stderr(io.StringIO()) as err:
                code = main(["--metrics", f"{tmp}/none.json", "--out", f"{tmp}/figures"])
            self.assertEqual(code, 2)
            self.assertIn("run make eval first", err.getvalue())


class MarkdownTest(unittest.TestCase):
    def test_headings_tables_and_figure_rows(self):
        markdown = (
            "<!-- how to check:\n  make figures -->\n# Title\n\nSome *text* with `code`.\n\n"
            "| A | B |\n|---|---:|\n| 1 | 2 |\n\n"
            "![**Figure 1.** One](a.svg){width=50%}\n![Two](b.svg)\n"
        )
        self.assertEqual(
            convert(markdown),
            '<h1 id="title">Title</h1>\n'
            "<p>Some <em>text</em> with <code>code</code>.</p>\n"
            '<table><thead><tr><th>A</th><th style="text-align: right">B</th></tr></thead>'
            '<tbody><tr><td>1</td><td style="text-align: right">2</td></tr></tbody></table>\n'
            '<div class="figrow"><figure style="flex: 0 1 50%">'
            '<img src="a.svg" alt="Figure 1. One">'
            "<figcaption><strong>Figure 1.</strong> One</figcaption></figure>"
            '<figure><img src="b.svg" alt="Two"><figcaption>Two</figcaption></figure></div>',
        )


class BuildTest(unittest.TestCase):
    def test_references_must_be_the_last_section(self):
        check_references_last("# T\n\n## Method\n\n## References\n\n1. A.\n")
        with self.assertRaises(SystemExit):
            check_references_last("# T\n\n## References\n\n1. A.\n\n## Afterword\n")

    def test_document_carries_the_title_and_the_base(self):
        html = document("# Technical report — Bern Life\n\nText.\n", Path("/tmp/report"))
        self.assertIn("<title>Technical report — Bern Life</title>", html)
        self.assertIn('<base href="file:///tmp/report/">', html)

    def test_count_pages_ignores_the_page_tree(self):
        self.assertEqual(count_pages(b"<< /Type /Pages >> << /Type /Page >> << /Type/Page >>"), 2)


if __name__ == "__main__":
    unittest.main()
