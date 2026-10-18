"""The Markdown report printed by `make eval`: every number read from the metrics. A check whose
input was not given prints "not computed", a slice with nothing to measure prints "—"; neither
prints as 0."""

from collections.abc import Mapping, Sequence
from typing import Any

NOT_COMPUTED = "not computed"
NOTHING = "—"
LISTED_MISSES = 20

Metrics = Mapping[str, Any]


def number(value: float | None) -> str:
    return NOTHING if value is None else f"{value:.2f}"


def interval(ci: Sequence[float] | None) -> str:
    return "" if ci is None else f" [{ci[0]:.2f}, {ci[1]:.2f}]"


def mean_cell(mean: Metrics | None) -> str:
    return NOTHING if mean is None else f"{mean['value']:.2f}{interval(mean['ci'])}"


def share_cell(share: Metrics | None) -> str:
    if share is None:
        return NOT_COMPUTED
    return f"{share['k']}/{share['n']}{interval(share['ci'])}" if share["n"] else NOTHING


def table(header: Sequence[str], rows: Sequence[Sequence[object]]) -> list[str]:
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    return lines + ["| " + " | ".join(str(cell) for cell in row) + " |" for row in rows]


def slice_rows(slices: Metrics) -> list[list[object]]:
    return [
        [
            name,
            s["queries"],
            mean_cell(s["recall_at_10"]),
            mean_cell(s["mrr"]),
            share_cell(s["invented_abstained"]),
            share_cell(s["false_abstention"]),
            share_cell(s["traceable_claims"]),
            NOT_COMPUTED if s["invented_entities"] is None else s["invented_entities"],
        ]
        for name, s in slices.items()
    ]


def exposure_rows(rows: Sequence[Metrics] | None) -> list[list[object]]:
    return [
        [row["name"], row["slots"], number(row["slot_share"]), number(row["profile_share"])]
        for row in rows or ()
    ]


def detail(value: object) -> str:
    if isinstance(value, float):
        return f"{value:.2f}"
    if isinstance(value, (list, tuple)):
        return interval(value).strip()
    return str(value)


def decision_line(name: str, rule: Metrics) -> str:
    details = ", ".join(f"{key} {detail(value)}" for key, value in rule.items() if key != "status")
    return f"- {name}: **{rule['status']}**" + (f" ({details})" if details else "")


def markdown(metrics: Metrics) -> str:
    inputs, pooled = metrics["inputs"], metrics["slices"]["pooled"]
    lines = [
        f"Gold `{inputs['gold']}` ({pooled['queries']} queries),"
        f" predictions `{inputs['predictions']}`.",
        "95% intervals: recall@10 and MRR by cluster bootstrap over base needs"
        " (2,000 draws, seed 1); proportions by Wilson.",
        "",
        *table(
            ["Slice", "Queries", "recall@10", "MRR", "Invented abstained", "False abstention"]
            + ["Traceable claims", "Invented entities"],
            slice_rows(metrics["slices"]),
        ),
        "",
        "Variant agreement (Jaccard of top-10 profile ids with the base query):",
        "",
        *table(
            ["Variant", "Pairs", "Mean Jaccard", "Both empty"],
            [
                [name, v["pairs"], number(v["jaccard_mean"]), v["both_empty"]]
                for name, v in metrics["variant_agreement"].items()
            ],
        ),
        "",
        f"Exposure: {metrics['exposure']['slots']} top-10 slots"
        " on queries that should find someone.",
        "",
        *table(
            ["Source", "Slots", "Slot share", "Profile share"],
            exposure_rows(metrics["exposure"]["by_source"]),
        ),
    ]
    if metrics["exposure"]["by_unit"] is not None:
        lines += [
            "",
            *table(
                ["Unit", "Slots", "Slot share", "Profile share"],
                exposure_rows(metrics["exposure"]["by_unit"]),
            ),
        ]
    completeness = metrics["completeness"]
    lines += [
        "",
        f"Field completeness ({completeness['status']}): {completeness['results']} results shown,"
        f" mean share of the 8 required fields filled {number(completeness['mean_share'])}.",
        "",
        "Decision rules (eval/PREREGISTRATION.md):",
        *(decision_line(name, rule) for name, rule in metrics["decisions"].items()),
        "",
        f"Hits found only by URL, not by name: {metrics['url_only_hits']}.",
    ]
    lines += untraceable_lines(metrics["untraceable"])
    return "\n".join(lines) + "\n"


def untraceable_lines(misses: Sequence[Metrics] | None) -> list[str]:
    if not misses:
        return []
    shown = [
        f"- {m['query']} {m['profile']} {m['claim']}: {m['reason']}" for m in misses[:LISTED_MISSES]
    ]
    more = len(misses) - LISTED_MISSES
    return ["", "Untraceable claims:", *shown] + (
        [f"- … and {more} more in metrics.json"] if more > 0 else []
    )
