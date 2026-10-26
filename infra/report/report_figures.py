"""Figures for the technical report, drawn as plain SVG from the evaluator's output.

    python3 -m infra.report.report_figures [--metrics eval/out/metrics.json]
                                           [--out docs/report/figures] [--assets docs/assets]

Every number a figure shows is also written to numbers.json, so the report text quotes exactly
what the figures show, and a reader checks the text against numbers.json and metrics.json. The
numbers that are not in metrics.json (the gold runs before this bundle, the extraction counts, the
model calls recorded in the bundle, the 8B measurement) are the literals in READ_FROM_DOCS below,
each with the file it was read from; nothing else in this module is typed by hand. The three
explainer drawings of docs/assets/ are copied as stills: the same drawing with its animation
removed, for print. The main loop and the shape of numbers.json follow
CPD9/apertus-redteam-graph track_1a/scripts/report_figures.py (777dec9, Apache-2.0); the figures
are Bern Life's.
"""

import argparse
import hashlib
import json
import re
import sys
from collections.abc import Mapping, Sequence
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from infra.readme_numbers import FIELDS, INVENTED_BAR, LANGS, RECALL_BAR, SOURCES, WORDINGS
from infra.report.report_charts import (
    BLUE,
    FULL,
    RED,
    Entry,
    Row,
    bar_chart,
    count_axis,
    note_only,
    share,
)

ROOT = Path(__file__).resolve().parents[2]
METRICS = ROOT / "eval/out/metrics.json"
FIGURES = ROOT / "docs/report/figures"
ASSETS = ROOT / "docs/assets"
EXPLAINERS = ("explain-page-to-profile", "explain-ask", "explain-brief")
LANGUAGE = {"en": "English", "de": "German", "fr": "French"}
VARIANTS = (
    ("site", "Site's own wording"),
    *((key, label.capitalize()) for key, label in WORDINGS),
    ("control", "Control"),
)
CASE_BAR = (RECALL_BAR, f"the case asks {RECALL_BAR:.2f}")
STATE = "docs/conductor/STATE.md, E2 extraction, final"
LISTING = "docs/extraction.md, Listing headings"
PACK = "bundle-20261019-4 llm_cache/pack.jsonl.xz, entries per role"
AT_RULE = re.compile(r"@(?:keyframes|media)\b")
ANIMATION = re.compile(r"[ \t]*animation:[^;]*;")
BLANK_LINE = re.compile(r"\n[ \t]*(?=\n)")

Metrics = Mapping[str, Any]
Figure = tuple[str, dict[str, Any] | None]


class FiguresError(Exception):
    pass


@dataclass(frozen=True)
class GoldRun:
    """One gold scoring before this bundle: recall@10 with its interval and MRR."""

    change: str
    date: str
    recall_at_10: float
    ci95: tuple[float, float]
    mrr: float
    read_from: str


@dataclass(frozen=True)
class Literal:
    """A number read from a file of the repository or the bundle, not from metrics.json."""

    value: float
    read_from: str
    about: bool = False


# Every number below was read from the named file; nothing else here is typed by hand.
SEARCH, PREREG = "docs/search.md", "eval/PREREGISTRATION.md, 2026-10-19"
GOLD_RUNS = (
    GoldRun(
        "Hybrid search, no claim rule",
        "2026-10-18",
        0.31,
        (0.18, 0.48),
        0.29,
        f"{SEARCH}, Baseline",
    ),
    GoldRun(
        "Claim rule: a result cites a matching claim",
        "2026-10-18",
        0.22,
        (0.10, 0.35),
        0.27,
        f"{SEARCH}, Baseline",
    ),
    GoldRun(
        "Enrichment terms on expertise values",
        "2026-10-18",
        0.24,
        (0.12, 0.38),
        0.32,
        f"{SEARCH}, Plain, enrichment, expansion",
    ),
    GoldRun(
        "Query expansion",
        "2026-10-18",
        0.27,
        (0.13, 0.42),
        0.32,
        f"{SEARCH}, Plain, enrichment, expansion",
    ),
    GoldRun(
        "Reasons through a project",
        "2026-10-18",
        0.36,
        (0.20, 0.53),
        0.43,
        f"{SEARCH}, Reasons through a project",
    ),
    GoldRun(
        "Listing headings dropped, bundle-3 (#162)",
        "2026-10-19",
        0.38,
        (0.22, 0.56),
        0.46,
        f"{PREREG}: listing heading (#162)",
    ),
    GoldRun(
        "Titles and word forms, before the review fixes (#226)",
        "2026-10-19",
        0.40,
        (0.23, 0.57),
        0.44,
        f"{PREREG}: titles and word forms (#226)",
    ),
)
FINAL_RUN = ("Passages on the own page, review fixes: bundle-4 (#226)", "2026-10-19")
CLAIMS = "bundle-20261019-4 profiles.jsonl, field claims of the person, unit, project and infrastructure profiles"  # noqa: E501
EIGHT_B = "docs/decisions.md, 2026-10-18 afternoon: 15 of 18 answers"
DEV2 = f"{PREREG}: dev2, and the rule for search levers"
GOLD = "eval/gold.jsonl, answerable questions counted by variant_of, the bootstrap's cluster"
FINAL = f"{PREREG}: the final gold run of #226"
LATENCY = f"{SEARCH}, Plain, enrichment, expansion: latency"
READ_FROM_DOCS = {
    "pages": Literal(3351, "bundle-20261019-4 manifest.json, pages.jsonl lines"),
    "model_proposals": Literal(16700, f"{STATE}: about 16,700", about=True),
    "proposals_not_on_page": Literal(1151, STATE),
    "people": Literal(2922, f"{STATE}; the listing headings removed none"),
    "units": Literal(187, f"{STATE} 188, minus 1 in {LISTING}"),
    "projects": Literal(85, f"{STATE} 103, minus 18 in {LISTING}"),
    "infrastructure": Literal(142, f"{STATE} 158, minus 16 in {LISTING}"),
    "relations": Literal(1843, f"{STATE} 1,897, minus 54 in {LISTING}"),
    "bare_name_people": Literal(1241, f"{STATE}: a bare name from a news or partner page"),
    "claims_with_evidence": Literal(4877, CLAIMS),
    "calls_extract": Literal(3329, PACK),
    "calls_explain": Literal(674, PACK),
    "calls_expand": Literal(119, PACK),
    "calls_enrich": Literal(57, PACK),
    "calls_agent": Literal(17, PACK),
    "calls_brief": Literal(7, PACK),
    "explain_v1_passed_share": Literal(0.33, f"{SEARCH}, Why it matches"),
    "apertus_8b_confirmed_invented_details": Literal(15, EIGHT_B),
    "apertus_8b_answers": Literal(18, EIGHT_B),
    "gold_base_needs": Literal(20, GOLD),
    "gold_base_needs_reworded": Literal(14, GOLD),
    "dev_queries": Literal(27, DEV2),
    "dev2_candidates": Literal(56, DEV2),
    "dev2_dropped_on_gold_check": Literal(8, DEV2),
    "dev2_queries": Literal(38, DEV2),
    "dev_pooled_recall_before": Literal(0.585, FINAL),
    "dev_pooled_recall_after": Literal(0.698, FINAL),
    "dev_pooled_mrr_before": Literal(0.456, FINAL),
    "dev_pooled_mrr_after": Literal(0.529, FINAL),
    "latency_replay_p50_ms": Literal(165, LATENCY),
    "latency_live_p50_s": Literal(4.1, LATENCY),
    "latency_live_p95_s": Literal(7.6, LATENCY),
}
PROFILE_KINDS = ("people", "units", "projects", "infrastructure")


def rounded(value: float | None) -> float | None:
    return None if value is None else round(value, 4)


def rounded_pair(ci: Sequence[float] | None) -> list[float] | None:
    return None if ci is None else [round(ci[0], 4), round(ci[1], 4)]


def pair(ci: Sequence[float] | None) -> tuple[float, float] | None:
    return None if ci is None else (ci[0], ci[1])


def measure(part: Metrics) -> Entry:
    return Entry(part["value"], pair(part["ci"]))


def recall_row(slices: Metrics, key: str, label: str, apart: bool = False) -> tuple[Row, dict]:
    part = slices[key]
    recall, mrr = part["recall_at_10"], part["mrr"]
    row = Row(f"{label} ({recall['queries']})", (measure(recall),), share(mrr["value"]), apart)
    numbers = {
        "label": label,
        "queries": recall["queries"],
        "recall_at_10": rounded(recall["value"]),
        "ci95": rounded_pair(recall["ci"]),
        "mrr": rounded(mrr["value"]),
    }
    return row, numbers


def recall_figure(slices: Metrics, keys: Sequence[tuple[str, str]], title: str, by: str) -> Figure:
    pairs = [recall_row(slices, key, label) for key, label in keys]
    pairs.append(recall_row(slices, "pooled", "All questions", apart=True))
    rows, numbers = zip(*pairs, strict=True)
    sentence = (
        f"Share of the expected people and units in the top 10, by {by}; 95% interval by "
        "bootstrap over base needs. In brackets: questions that should find someone. The dashed "
        f"line is the case's bar, {RECALL_BAR:.2f}."
    )
    svg = bar_chart(
        rows, (("recall@10", RED),), sentence, title, right_header="MRR", reference=CASE_BAR
    )
    return svg, {"bar": RECALL_BAR, "rows": list(numbers)}


def recall_by_language(m: Metrics) -> Figure:
    keys = [(f"lang:{code}", LANGUAGE[code]) for code in LANGS]
    return recall_figure(m["slices"], keys, "recall@10 by the language of the question", "language")


def recall_by_source(m: Metrics) -> Figure:
    keys = [(f"source:{key}", label) for key, label in SOURCES]
    return recall_figure(
        m["slices"], keys, "recall@10 by the source the question is about", "source"
    )


def slots_by_source(m: Metrics) -> Figure:
    by_source = {row["name"]: row for row in m["exposure"]["by_source"]}
    rows, numbers = [], []
    for key, label in SOURCES:
        row = by_source[key]
        entries = (Entry(row["slot_share"]), Entry(row["profile_share"]))
        rows.append(Row(label, entries, f"{row['slots']:,} slots"))
        numbers.append(
            {
                "label": label,
                "slots": row["slots"],
                "slot_share": rounded(row["slot_share"]),
                "profile_share": rounded(row["profile_share"]),
            }
        )
    sentence = (
        f"The {m['exposure']['slots']:,} top-10 slots of the questions that should find someone, "
        "by the source of the result, next to each source's share of the profiles in the "
        "snapshot."
    )
    series = (("Share of top-10 slots", RED), ("Share of profiles", BLUE))
    svg = bar_chart(
        rows, series, sentence, "Top-10 slots per source against profiles", right_header="slots"
    )
    return svg, {"slots": m["exposure"]["slots"], "rows": numbers}


def recall_by_wording(m: Metrics) -> Figure:
    slices, agreement = m["slices"], m["variant_agreement"]
    rows, numbers = [], []
    for key, label in VARIANTS:
        row, number = recall_row(slices, f"variant:{key}", label)
        overlap = agreement.get(key, {}).get("jaccard_mean")
        rows.append(Row(row.label, row.entries, "—" if overlap is None else share(overlap)))
        numbers.append({**number, "jaccard_with_site": rounded(overlap)})
    sentence = (
        "recall@10 per wording of the gold questions; 95% interval by bootstrap over base needs. "
        "The right column is the mean Jaccard overlap of a rewording's top 10 with the top 10 of "
        "the site's own wording of the same need. Control questions ask about the right topic "
        "with a premise the pages do not state. The dashed line is the case's bar."
    )
    svg = bar_chart(
        rows,
        (("recall@10", RED),),
        sentence,
        "recall@10 by wording, with the top-10 overlap with the site's wording",
        right_header="Jaccard with site",
        reference=CASE_BAR,
    )
    return svg, {"bar": RECALL_BAR, "rows": numbers}


def consistency_sets(m: Metrics) -> Figure:
    title = "One need in several wordings: how much of the top 10 is shared"
    consistency = m.get("consistency")
    if consistency is None:
        sentence = (
            "Not computed: the wording sets of criterion 2 need predictions from a loaded "
            "bundle. Run make predict-consistency, then make eval, then make figures."
        )
        return note_only(title, sentence), None
    rows, numbers = [], []
    for wording_set in consistency["sets"]:
        queries = wording_set["queries"]
        recorded = sum(1 for q in queries if q["expanded"])
        label = f"{wording_set['id'].replace('-', ' ')} ({len(queries)} wordings)"
        entries = (Entry(wording_set["jaccard_mean"]), Entry(wording_set["found_by_first_mean"]))
        rows.append(Row(label, entries, f"{recorded} of {len(queries)}"))
        numbers.append(
            {
                "set": wording_set["id"],
                "wordings": len(queries),
                "pairs": wording_set["pairs"],
                "jaccard_mean": rounded(wording_set["jaccard_mean"]),
                "found_by_first_mean": rounded(wording_set["found_by_first_mean"]),
                "expansion_recorded": recorded,
                "found_by_first": [
                    {
                        "query": q["query"],
                        "shown": q["shown"],
                        "share": rounded(q["found_by_first"]),
                    }
                    for q in queries
                ],
            }
        )
    total = consistency["queries"]
    recorded = total - len(consistency["plain_search"])
    rows.append(
        Row(
            f"All sets ({total} wordings)",
            (Entry(consistency["jaccard_mean"]), None),
            f"{recorded} of {total}",
            apart=True,
        )
    )
    sentence = (
        "Each set holds wordings of one need (eval/consistency.jsonl). Jaccard: the mean overlap "
        "of the top-10 profile ids over every pair of wordings. The second bar: the mean share of "
        "a wording's top 10 that the set's first wording also finds. The right column counts the "
        "wordings whose query expansion was recorded; the others were searched plain."
    )
    series = (("Mean pairwise Jaccard", RED), ("Found by the first wording", BLUE))
    svg = bar_chart(rows, series, sentence, title, right_header="expansion recorded")
    return svg, {
        "jaccard_mean": rounded(consistency["jaccard_mean"]),
        "wordings": total,
        "plain_search": consistency["plain_search"],
        "sets": numbers,
    }


def size_row(label: str, group: Metrics, apart: bool = False) -> tuple[Row, dict]:
    entries = (Entry(group["slot_share"]), Entry(group["profile_share"]))
    row = Row(f"{label} ({group['units']})", entries, f"{group['units_never_shown']}", apart)
    numbers = {
        "label": label,
        "units": group["units"],
        "profiles": group["profiles"],
        "profile_share": rounded(group["profile_share"]),
        "slots": group["slots"],
        "slot_share": rounded(group["slot_share"]),
        "units_never_shown": group["units_never_shown"],
    }
    return row, numbers


def exposure_by_size(m: Metrics) -> Figure:
    by_size = m["exposure_by_size"]
    middle = f"{by_size['median_profiles']:g}"
    bound = {"small": f"≤ {middle}", "large": f"> {middle}"}
    names = dict(SOURCES)
    pairs = [
        size_row(f"{g['name'].capitalize()} units, {bound[g['name']]} profiles", g)
        for g in by_size["groups"]
    ]
    for k, source in enumerate(by_size["by_source"]):
        for j, g in enumerate(source["groups"]):
            label = f"{names.get(source['source'], source['source'])}, {g['name']}"
            pairs.append(size_row(label, g, apart=k == 0 and j == 0))
    rows, numbers = zip(*pairs, strict=True)
    sentence = (
        "The units of the three sources, split at the median unit size of "
        f"{middle} profiles. Above the rule: shares of all profiles and slots; below: shares "
        "within each source. In brackets: units in the group. The right column counts the "
        "group's units that never reach a top 10."
    )
    series = (("Share of top-10 slots", RED), ("Share of profiles", BLUE))
    svg = bar_chart(rows, series, sentence, "Exposure by unit size", right_header="never shown")
    return svg, {
        "median_profiles": by_size["median_profiles"],
        "slots_outside": by_size["slots_outside"],
        "rows": list(numbers),
    }


def count_row(label: str, part: Metrics, apart: bool = False) -> tuple[Row, dict]:
    row = Row(
        label, (Entry(part["value"], pair(part["ci"])),), f"{part['k']} of {part['n']}", apart
    )
    numbers = {"label": label, "k": part["k"], "n": part["n"], "share": rounded(part["value"])}
    numbers["ci95"] = rounded_pair(part["ci"])
    return row, numbers


def abstention(m: Metrics) -> Figure:
    slices = m["slices"]
    keys = [("pooled", "all languages"), *((f"lang:{code}", LANGUAGE[code]) for code in LANGS)]
    pairs = [
        count_row(f"Invented, {label}", slices[key]["invented_abstained"]) for key, label in keys
    ]
    pairs += [
        count_row(f"Answerable, {label}", slices[key]["false_abstention"], apart=k == 0)
        for k, (key, label) in enumerate(keys)
    ]
    rows, numbers = zip(*pairs, strict=True)
    sentence = (
        "Above the rule: the share of the invented questions (a person, project or study that "
        "exists on no page) answered with no verifiable source. Below: the share of answerable "
        "questions wrongly answered that way. Wilson 95% intervals. The dashed line is the "
        f"pre-registered bar for invented questions, {INVENTED_BAR:.2f}."
    )
    svg = bar_chart(
        rows,
        (("Share abstained", RED),),
        sentence,
        "Abstention: invented questions refused, answerable questions kept",
        right_header="abstained",
        reference=(INVENTED_BAR, f"rule: ≥ {INVENTED_BAR:.2f}"),
    )
    return svg, {"bar": INVENTED_BAR, "rows": list(numbers)}


def completeness(m: Metrics) -> Figure:
    part = m["completeness"]
    filled, results = part["filled"], part["results"]
    order = [f for f in FIELDS if f in filled] + sorted(set(filled) - set(FIELDS))
    rows = [
        Row(field, (Entry(filled[field] / results),), f"{filled[field]:,} of {results:,}")
        for field in order
    ]
    numbers = [
        {"field": f, "filled": filled[f], "share": rounded(filled[f] / results)} for f in order
    ]
    sentence = (
        f"The {results:,} results shown for the answerable gold questions, and how many fill each "
        f"of the case's eight fields; mean share of fields filled {part['mean_share']:.2f}. "
        f"Status: {part['status']}. A field a page does not state cannot be filled, so this is a "
        "ceiling-free count, not a score."
    )
    svg = bar_chart(
        rows,
        (("Share of results with the field", RED),),
        sentence,
        "Fields filled per shown result",
        right_header="filled",
    )
    return svg, {
        "results": results,
        "mean_share": rounded(part["mean_share"]),
        "status": part["status"],
        "rows": numbers,
    }


def gold_runs(m: Metrics) -> Figure:
    pooled = m["slices"]["pooled"]
    rows = [
        Row(run.change, (Entry(run.recall_at_10, run.ci95),), share(run.mrr)) for run in GOLD_RUNS
    ]
    final = recall_row(m["slices"], "pooled", FINAL_RUN[0], apart=True)[1]
    final_row = Row(
        FINAL_RUN[0], (measure(pooled["recall_at_10"]),), share(pooled["mrr"]["value"]), apart=True
    )
    rows.append(final_row)
    numbers = [asdict(run) for run in GOLD_RUNS]
    numbers.append(
        {
            "change": FINAL_RUN[0],
            "date": FINAL_RUN[1],
            "recall_at_10": final["recall_at_10"],
            "ci95": final["ci95"],
            "mrr": final["mrr"],
            "read_from": "metrics.json, slices.pooled",
        }
    )
    sentence = (
        "Gold recall@10 after each change to the search, oldest first, with the 95% bootstrap "
        "interval; the right column is MRR. The gold set never changed. Every change was decided "
        "on the dev sets and gold scored afterwards as measurement; the last two rows are "
        "gold-informed, not held-out (eval/PREREGISTRATION.md). The dashed line is the case's bar."
    )
    svg = bar_chart(
        rows,
        (("recall@10", RED),),
        sentence,
        "Gold recall@10 by change",
        right_header="MRR",
        reference=CASE_BAR,
        width=FULL,
    )
    return svg, {"bar": RECALL_BAR, "rows": numbers}


def extraction_funnel(m: Metrics) -> Figure:
    literal = READ_FROM_DOCS
    profiles = sum(g["profiles"] for g in m["exposure_by_size"]["groups"])
    kinds = sum(literal[kind].value for kind in PROFILE_KINDS)
    if kinds != profiles:
        raise FiguresError(
            f"the profile kinds read from the docs sum to {kinds:,}, but metrics.json counts "
            f"{profiles:,} profiles of the three sources: update READ_FROM_DOCS"
        )
    dropped = literal["proposals_not_on_page"].value / literal["model_proposals"].value
    stages = (
        ("Public pages stored", literal["pages"], None),
        ("Model proposals", literal["model_proposals"], None),
        ("Not on the page: dropped", literal["proposals_not_on_page"], RED),
        (
            "Profiles of the three sources",
            Literal(profiles, "metrics.json, exposure_by_size"),
            None,
        ),
        ("Claims with evidence", literal["claims_with_evidence"], None),
    )
    rows = [
        Row(
            label,
            (Entry(lit.value, label=f"about {lit.value:,}" if lit.about else None, color=color),),
        )
        for label, lit, color in stages
    ]
    numbers = [
        {"stage": label, "count": lit.value, "about": lit.about, "read_from": lit.read_from}
        for label, lit, _ in stages
    ]
    sentence = (
        "From the stored pages to the profiles: Apertus proposes values with their sentence, and "
        f"a proposal whose sentence is not on the page is dropped ({dropped:.1%} of the "
        f"proposals). The profiles are {literal['people'].value:,} people, "
        f"{literal['units'].value} units, {literal['projects'].value} projects and "
        f"{literal['infrastructure'].value} facilities, with {literal['relations'].value:,} "
        "relations between them; every claim carries a sentence found on its page word for word."
    )
    axis = count_axis([lit.value for _, lit, _ in stages])
    svg = bar_chart(
        rows, (("count", BLUE),), sentence, "From pages to profiles with evidence", axis=axis
    )
    return svg, {"dropped_share": rounded(dropped), "stages": numbers}


def figures(m: Metrics) -> dict[str, Figure]:
    """Every figure as its SVG and the numbers it shows, by file name."""
    plan = {
        "recall_by_language": recall_by_language,
        "recall_by_source": recall_by_source,
        "slots_by_source": slots_by_source,
        "recall_by_wording": recall_by_wording,
        "consistency_sets": consistency_sets,
        "exposure_by_size": exposure_by_size,
        "abstention": abstention,
        "completeness": completeness,
        "gold_runs": gold_runs,
        "extraction_funnel": extraction_funnel,
    }
    return {name: draw(m) for name, draw in plan.items()}


def without_at_rules(css: str) -> str:
    """The text without its @keyframes and @media blocks, braces balanced."""
    out, i = [], 0
    while m := AT_RULE.search(css, i):
        out.append(css[i : m.start()])
        depth, j = 0, css.index("{", m.start())
        while True:
            depth += {"{": 1, "}": -1}.get(css[j], 0)
            j += 1
            if depth == 0:
                break
        i = j
    out.append(css[i:])
    return "".join(out)


def still(svg: str) -> str:
    """The same drawing with its animation removed: the resting styles are the last frame, so the
    picture is complete, and the dark-mode block goes because print is light."""
    return BLANK_LINE.sub("", ANIMATION.sub("", without_at_rules(svg)))


def literals() -> dict[str, dict[str, Any]]:
    return {name: asdict(lit) for name, lit in READ_FROM_DOCS.items()}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Draw the report figures from the evaluator's output.")
    ap.add_argument("--metrics", type=Path, default=METRICS)
    ap.add_argument("--out", type=Path, default=FIGURES)
    ap.add_argument("--assets", type=Path, default=ASSETS)
    a = ap.parse_args(argv)
    try:
        raw = a.metrics.read_bytes()
    except OSError:
        print(f"report_figures: no {a.metrics}: run make eval first", file=sys.stderr)
        return 2
    metrics = json.loads(raw)
    try:
        drawn = figures(metrics)
    except (KeyError, TypeError, FiguresError) as error:
        print(f"report_figures: {a.metrics}: {error}", file=sys.stderr)
        return 2
    a.out.mkdir(parents=True, exist_ok=True)
    metrics_path = a.metrics.resolve()
    if metrics_path.is_relative_to(ROOT):  # a committed numbers.json names no local folder
        metrics_path = metrics_path.relative_to(ROOT)
    numbers: dict[str, Any] = {
        "metrics": str(metrics_path),
        "metrics_sha256": hashlib.sha256(raw).hexdigest(),
        "input_sha256": metrics.get("input_sha256"),
        "read_from_docs": literals(),
    }
    for name, (svg, number) in drawn.items():
        (a.out / f"{name}.svg").write_text(svg, encoding="utf-8")
        numbers[name] = number
    for name in EXPLAINERS:
        animated = (a.assets / f"{name}.svg").read_text(encoding="utf-8")
        (a.out / f"{name}.svg").write_text(still(animated), encoding="utf-8")
    (a.out / "numbers.json").write_text(
        json.dumps(numbers, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"wrote {len(drawn)} figures, {len(EXPLAINERS)} stills and numbers.json to {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
