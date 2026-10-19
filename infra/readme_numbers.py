"""The measured numbers in the README and docs/metrics.md, written from the evaluator's output so
that none is typed by hand.

    python3 infra/readme_numbers.py [--check] [--metrics <file>] [--readme <file>] [--doc <file>]
                                    [--lock <file>]

`make eval` writes eval/out/metrics.json; this replaces the README's block between the numbers
markers with the "Against the case" table and a line naming the snapshot, and the block between
the exposure markers in docs/metrics.md with the exposure-by-unit-size tables. The snapshot is read
from the bundle manifest beside the predictions the metrics were computed from. The sha256 the
evaluator recorded for its predictions, pages and profiles must be the ones that manifest lists,
and its version the one bundle.lock pins, so metrics from any other bundle, or left over from one,
are refused. `--check` writes nothing and exits 1 with a diff when a block differs: the eval job
runs it after `make eval`. Any other failure exits 2. Standard library only, so that job needs
nothing more.
"""

import argparse
import difflib
import json
import sys
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from math import ceil, floor
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
START, END = "<!-- numbers:start -->", "<!-- numbers:end -->"
DOC_START, DOC_END = "<!-- exposure:start -->", "<!-- exposure:end -->"
METRICS = "eval/out/metrics.json"
COMMAND = "make fetch && make eval && python3 infra/readme_numbers.py"
# The pre-registered bars (eval/PREREGISTRATION.md); a test keeps them equal to the evaluator's.
RECALL_BAR = 0.80
INVENTED_BAR = 0.90
SITE_FALSE_ABSTENTIONS_ALLOWED = 1
# The bundle files the evaluator scores, each checked against the bundle manifest.
SCORED = ("predictions", "pages", "profiles")
SOURCES = (("unibe", "UniBE"), ("artorg", "ARTORG"), ("dcb", "DCB"))
WORDINGS = (("synonym", "synonyms"), ("lay", "lay terms"), ("translation", "translations"))
LANGS = ("en", "de", "fr")
# The case's result fields in its own order; metrics.json stores them sorted.
FIELDS = ("person", "role/affiliation", "unit", "expertise", "projects")
FIELDS += ("infrastructure/services", "reason", "source link")
# The table's fixed text: each success criterion of the case, the ethical guideline on missing
# sources (docs/case.md), and where the app shows each.
CRITERIA = (
    f"1. Finds the right people: ≥ {RECALL_BAR:.0%} of expected experts and units in the top 10",
    "2. Different wording finds the same experts",
    "3. Every result traceable, nothing invented",
    "Ethics: says so when no reliable source exists",
    "4. Structured results",
    "5. Covers UniBE, ARTORG and Diabetes Center Berne",
    "6. Easy to extend",
)
WHERE = (
    "The result list in Ask",
    '"Also searched for" on every answer: synonyms, lay terms, translations, acronyms',
    "The evidence panel behind every claim: verbatim sentence, source link, fetch date",
    '"No verifiable source" instead of results',
    "Result card fields: person, role, unit, expertise, projects, infrastructure and services,"
    " why it matches, source link",
    "Places on the map; the source on every card",
    "One JSON file in [`sources/`](sources/) and one command"
    " ([playbook](docs/playbooks/add-a-source.md))",
)
EXTEND = (
    "Not a measured number. `python -m bernlife crawl --source <id>` crawls a new file, and only"
    " that source's records are replaced."
)
# The columns of the exposure-by-unit-size tables in docs/metrics.md, after the group.
SIZE_COLUMNS = (
    "Units | Profiles | Profile share | Top-10 slots | Slot share | Units never in a top 10"
)
PENDING = "human check pending"
NOTHING, NOT_COMPUTED = "—", "not computed"

Metrics = Mapping[str, Any]


class NumbersError(Exception):
    pass


@dataclass(frozen=True)
class Block:
    """One generated block: the file it is in, its markers and what belongs between them."""

    label: str
    kind: str
    path: Path
    start: str
    end: str
    text: str


def two(value: float | None) -> str:
    return NOTHING if value is None else f"{value:.2f}"


def interval(ci: Sequence[float] | None) -> str:
    return "" if ci is None else f" [{ci[0]:.2f}, {ci[1]:.2f}]"


def mean(value: Metrics | None, bold: bool = False) -> str:
    if value is None:
        return NOTHING
    shown = two(value["value"])
    return (f"**{shown}**" if bold else shown) + interval(value["ci"])


def mean_of(part: Metrics, unit: str = "") -> str:
    """A slice's recall@10 with the number of questions it is measured on."""
    recall = part["recall_at_10"]
    return NOTHING if recall is None else f"{mean(recall)} ({recall['queries']}{unit})"


def count(share: Metrics | None) -> str:
    if share is None:
        return NOT_COMPUTED
    return f"**{share['k']:,} / {share['n']:,}**{interval(share['ci'])}" if share["n"] else NOTHING


def percent(k: int, n: int) -> str:
    """Rounded down, so a single untraceable claim never shows as 100%."""
    return "100%" if k == n else f"{floor(1000 * k / n) / 10:.1f}%"


def percent_bound(value: float, up: bool) -> str:
    tenths = (ceil if up else floor)(round(1000 * value, 6))
    return "100%" if tenths == 1000 else f"{tenths / 10:.1f}%"


def percent_interval(ci: Sequence[float] | None) -> str:
    """Bounds rounded outward, so the interval shown is never narrower than the computed one: a
    lower bound of 0.9992 shows as 99.9%, not as 1.00."""
    if ci is None:
        return ""
    return f" [{percent_bound(ci[0], up=False)}, {percent_bound(ci[1], up=True)}]"


def right_people(pooled: Metrics, rule: Metrics) -> str:
    return (
        f"recall@10 {mean(pooled['recall_at_10'], bold=True)} against the case's"
        f" **{two(RECALL_BAR)}**: **{rule['status']}**. MRR {mean(pooled['mrr'])}."
    )


def wording(slices: Metrics, agreement: Metrics) -> str:
    variants = "; ".join(f"{label} {mean_of(slices[f'variant:{key}'])}" for key, label in WORDINGS)
    languages = ", ".join(f"{lang} {mean_of(slices[f'lang:{lang}'])}" for lang in LANGS)
    overlap = ", ".join(
        f"{label} {two(agreement.get(key, {}).get('jaccard_mean'))}" for key, label in WORDINGS
    )
    return (
        f"recall@10 on the site's own wording {mean_of(slices['variant:site'], ' questions')};"
        f" {variants}. By language: {languages}. Top-10 overlap with the site's wording"
        f" (mean Jaccard): {overlap}."
    )


def traceable(pooled: Metrics, rule: Metrics) -> str:
    claims, invented = pooled["traceable_claims"], pooled["invented_entities"]
    verbatim = NOT_COMPUTED
    if claims is not None and claims["n"]:
        share = percent(claims["k"], claims["n"])
        verbatim = f"{claims['k']:,} / {claims['n']:,}, **{share}**{percent_interval(claims['ci'])}"
    entities = NOT_COMPUTED if invented is None else f"**{invented}**"
    return (
        f"Claims whose sentence is verbatim on their stored page: {verbatim}. Results not in the"
        f" snapshot (invented entities): {entities}. Pre-registered rule: **{rule['status']}**."
    )


def abstention(pooled: Metrics, rule: Metrics) -> str:
    """The rule's second bar counts false abstentions on the site's own wording only, so that
    count is shown beside it; the pooled one covers every answerable question."""
    invented = pooled["invented_abstained"]
    n = invented["n"]
    bar = f"{ceil(round(INVENTED_BAR * n, 9))} / {n}" if n else NOTHING
    site = rule.get("site_false_abstentions")
    return (
        f"Invented questions abstained {count(invented)}; the pre-registered rule asks ≥ {bar},"
        f" and at most {SITE_FALSE_ABSTENTIONS_ALLOWED} false abstention on the site's own wording,"
        f" where there are **{NOTHING if site is None else site}**: **{rule['status']}**. False"
        f" abstentions on all answerable questions {count(pooled['false_abstention'])}."
    )


def structured(completeness: Metrics) -> str:
    filled = completeness["filled"]
    order = [field for field in FIELDS if field in filled] + sorted(set(filled) - set(FIELDS))
    per_field = ", ".join(f"{field} {filled[field]:,}" for field in order)
    status = completeness["status"]
    check = (
        "No interval: the pre-registered human check of what each page could fill is still to do."
        if status == PENDING
        else f"Human check: {status}."
    )
    return (
        f"Mean share of the {len(filled)} fields filled: {two(completeness['mean_share'])} over"
        f" {completeness['results']:,} shown results. Filled per field: {per_field}. {check}"
    )


def coverage(slices: Metrics, by_source: Sequence[Metrics] | None) -> str:
    rows = {row["name"]: row for row in by_source or ()}

    def shares(key: str) -> str:
        return " / ".join(two(rows.get(name, {}).get(key)) for name, _ in SOURCES)

    recall = ", ".join(
        f"{label} {mean(slices[f'source:{name}']['recall_at_10'])}" for name, label in SOURCES
    )
    return (
        f"recall@10 {recall}. Share of top-10 slots {shares('slot_share')} against share of"
        f" profiles in the snapshot {shares('profile_share')}."
    )


def render(metrics: Metrics, snapshot: str) -> str:
    """The block between the markers, from the metrics alone: same input, same bytes."""
    slices, rules = metrics["slices"], metrics["decisions"]
    pooled = slices["pooled"]
    measured = (
        right_people(pooled, rules["criterion_1"]),
        wording(slices, metrics["variant_agreement"]),
        traceable(pooled, rules["criterion_3"]),
        abstention(pooled, rules["abstention"]),
        structured(metrics["completeness"]),
        coverage(slices, metrics["exposure"]["by_source"]),
        EXTEND,
    )
    lines = [
        f"<!-- Written by infra/readme_numbers.py from {METRICS}: change the script, not this"
        " block. -->",
        "",
        "| What the case asks | Where it shows | Measured (95% interval) |",
        "|---|---|---|",
        *(f"| {c} | {w} | {m} |" for c, w, m in zip(CRITERIA, WHERE, measured, strict=True)),
        "",
        f"Snapshot `{snapshot}`, {pooled['queries']} gold questions. To reproduce: `{COMMAND}`."
        " CI fails when this block differs from the evaluator's output.",
    ]
    return "\n" + "\n".join(lines) + "\n"


def size_cells(group: Metrics) -> str:
    return (
        f"{group['units']} | {group['profiles']:,} | {two(group['profile_share'])} |"
        f" {group['slots']:,} | {two(group['slot_share'])} | {group['units_never_shown']}"
    )


def render_exposure(metrics: Metrics, snapshot: str) -> str:
    """The block of docs/metrics.md: exposure by unit size over the three sources, then the same
    groups within each source."""
    by_size = metrics["exposure_by_size"]
    lines = [
        f"<!-- Written by infra/readme_numbers.py from {METRICS}: change the script, not this"
        " block. -->",
        "",
    ]
    if by_size is None:
        lines.append(f"{NOT_COMPUTED}: the metrics were computed without the snapshot.")
    else:
        middle = f"{by_size['median_profiles']:g}"
        bound = {"small": f"≤ {middle}", "large": f"> {middle}"}
        names = dict(SOURCES)
        lines += [
            f"| Group | {SIZE_COLUMNS} |",
            "|---|---|---|---|---|---|---|",
            *(
                f"| {g['name']} ({bound[g['name']]} profiles) | {size_cells(g)} |"
                for g in by_size["groups"]
            ),
            "",
            f"| Source | Group | {SIZE_COLUMNS} |",
            "|---|---|---|---|---|---|---|---|",
            *(
                f"| {names.get(s['source'], s['source'])} | {g['name']} | {size_cells(g)} |"
                for s in by_size["by_source"]
                for g in s["groups"]
            ),
            "",
            f"Snapshot `{snapshot}`: median unit {middle} profiles; top-10 slots outside these"
            f" units {by_size['slots_outside']:,}. To reproduce: `{COMMAND}`. CI fails when this"
            " block differs from the evaluator's output.",
        ]
    return "\n" + "\n".join(lines) + "\n"


def split(text: str, start: str, end: str, name: str) -> tuple[str, str, str]:
    if text.count(start) != 1 or text.count(end) != 1 or text.find(start) > text.find(end):
        raise NumbersError(f"{name} needs exactly one {start} … {end} block")
    head, rest = text.split(start)
    body, tail = rest.split(end)
    return head, body, tail


def version_in(path: Path) -> str:
    try:
        return json.loads(path.read_text(encoding="utf-8"))["version"]
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise NumbersError(f"no bundle version in {path}") from error


def manifest_beside(metrics: Metrics) -> tuple[str, Metrics]:
    """The version and file list of the manifest beside the scored predictions; a relative path
    in the metrics is relative to the repository, where make runs the evaluator."""
    path = (ROOT / metrics["inputs"]["predictions"]).parent / "manifest.json"
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
        return manifest["version"], manifest["files"]
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise NumbersError(f"no bundle manifest at {path}") from error


def snapshot_version(metrics: Metrics) -> str:
    """The bundle the metrics were computed from: every scored file's sha256, as the evaluator
    recorded it, must be the one the manifest lists."""
    version, files = manifest_beside(metrics)
    scored = metrics.get("input_sha256")
    if scored is None:
        raise NumbersError("the metrics record no sha256 of their inputs: run make eval again")
    for name in SCORED:
        listed = files.get(f"{name}.jsonl", {}).get("sha256")
        if listed is None or scored.get(name) != listed:
            raise NumbersError(
                f"the metrics were not computed from the {name}.jsonl of {version}:"
                " run make eval again"
            )
    return version


def arguments(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="python3 infra/readme_numbers.py")
    parser.add_argument("--check", action="store_true", help="exit 1 with a diff, write nothing")
    parser.add_argument("--metrics", type=Path, default=ROOT / METRICS)
    parser.add_argument("--readme", type=Path, default=ROOT / "README.md")
    parser.add_argument("--doc", type=Path, default=ROOT / "docs/metrics.md")
    parser.add_argument("--lock", type=Path, default=ROOT / "bundle.lock")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = arguments(argv)
    try:
        if not args.metrics.is_file():
            raise NumbersError(f"no {args.metrics}: run make fetch && make eval first")
        metrics = json.loads(args.metrics.read_text(encoding="utf-8"))
        snapshot, pinned = snapshot_version(metrics), version_in(args.lock)
        if snapshot != pinned:
            raise NumbersError(f"the metrics are from {snapshot}, but bundle.lock pins {pinned}")
        blocks = [
            Block("README", "numbers", args.readme, START, END, render(metrics, snapshot)),
            Block(
                "docs/metrics.md",
                "exposure",
                args.doc,
                DOC_START,
                DOC_END,
                render_exposure(metrics, snapshot),
            ),
        ]
        parts = [
            split(block.path.read_text(encoding="utf-8"), block.start, block.end, block.label)
            for block in blocks
        ]
    except KeyError as error:
        print(f"readme_numbers: {args.metrics} has no {error}", file=sys.stderr)
        return 2
    except (TypeError, AttributeError) as error:
        print(f"readme_numbers: {args.metrics} is malformed ({error})", file=sys.stderr)
        return 2
    except (OSError, ValueError, NumbersError) as error:
        print(f"readme_numbers: {error}", file=sys.stderr)
        return 2
    differ = False
    for block, (head, current, tail) in zip(blocks, parts, strict=True):
        if current == block.text:
            print(f"{block.label} numbers match the evaluator on {snapshot}")
        elif args.check:
            differ = True
            diff = difflib.unified_diff(
                current.splitlines(keepends=True),
                block.text.splitlines(keepends=True),
                f"{block.path.name} ({block.kind} block)",
                "infra/readme_numbers.py",
            )
            sys.stdout.writelines(diff)
            print(
                f"{block.label} numbers differ: run {COMMAND}, commit {block.path.name}",
                file=sys.stderr,
            )
        else:
            text = head + block.start + block.text + block.end + tail
            block.path.write_text(text, encoding="utf-8")
            print(f"{block.label} numbers written from {snapshot}")
    return 1 if differ else 0


if __name__ == "__main__":
    sys.exit(main())
