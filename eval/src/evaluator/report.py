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
        *consistency_lines(metrics.get("consistency")),
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
    lines += size_lines(metrics.get("exposure_by_size"))
    completeness = metrics["completeness"]
    lines += [
        "",
        f"Field completeness ({completeness['status']}): {completeness['results']} results shown,"
        f" mean share of the 8 required fields filled {number(completeness['mean_share'])}.",
        *labelled_lines(metrics.get("labelled_completeness")),
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


def consistency_lines(wording: Metrics | None) -> list[str]:
    """Criterion 2 on eval/consistency.jsonl; nothing when its predictions were not given."""
    if wording is None:
        return []
    plain = wording["plain_search"]
    lines = [
        "",
        "Consistency across wordings (criterion 2): top-10 profile ids of every wording of one"
        f" need; mean Jaccard over every pair {number(wording['jaccard_mean'])}.",
        "",
        *table(
            ["Set", "Wordings", "Pairs", "Mean pairwise Jaccard", "Also found by the first"]
            + ["Both empty"],
            [
                [s["id"], len(s["queries"]), s["pairs"], number(s["jaccard_mean"])]
                + [number(s["found_by_first_mean"]), s["both_empty"]]
                for s in wording["sets"]
            ],
        ),
        "",
        *table(
            ["Wording", "Shown", "Share of its top 10 the first also finds", "Expansion"],
            [
                [
                    q["query"],
                    q["shown"],
                    "first" if q["id"].endswith(":1") else number(q["found_by_first"]),
                    "recorded" if q["expanded"] else "plain search",
                ]
                for s in wording["sets"]
                for q in s["queries"]
            ],
        ),
        "",
        f"Searched plain, without the model's other wordings: {len(plain)} of"
        f" {wording['queries']}" + (f" ({'; '.join(plain)})." if plain else "."),
    ]
    return lines


def size_row(group: Metrics) -> list[object]:
    return [
        group["units"],
        group["profiles"],
        number(group["profile_share"]),
        group["slots"],
        number(group["slot_share"]),
        group["units_never_shown"],
    ]


def size_lines(by_size: Metrics | None) -> list[str]:
    if by_size is None:
        return []
    sources = ", ".join(by_size["sources"])
    columns = ["Units", "Profiles", "Profile share", "Top-10 slots", "Slot share"]
    columns += ["Units never in a top 10"]
    return [
        "",
        f"Exposure by unit size: the units of {sources}; large = more profiles than the median"
        f" unit ({by_size['median_profiles']:g}), small = the rest. Slots outside these units:"
        f" {by_size['slots_outside']}.",
        "",
        *table(["Group", *columns], [[g["name"], *size_row(g)] for g in by_size["groups"]]),
        "",
        "The same groups within each source (shares of that source's own profiles and slots):",
        "",
        *table(
            ["Source", "Group", *columns],
            [
                [s["source"], g["name"], *size_row(g)]
                for s in by_size["by_source"]
                for g in s["groups"]
            ],
        ),
    ]


def kappa_cell(agreement: Metrics) -> str:
    return NOTHING if agreement["kappa"] is None else f"{agreement['kappa']:.2f}"


def labelled_lines(labelled: Metrics | None) -> list[str]:
    """The human check of criterion 4, once the sheets are back."""
    if labelled is None:
        return []
    pooled, agreement = labelled["completeness"], labelled["agreement"]
    rows = [
        [
            field,
            f["stated"],
            f["filled_where_stated"],
            share_cell(f["completeness"]),
            f["filled_page_silent"],
            f["unanswered"],
        ]
        for field, f in labelled["fields"].items()
    ]
    return [
        "",
        f"Labelled completeness: {labelled['labelled']} of {labelled['results']} results"
        f" labelled; of the fields their pages state, the system filled"
        f" {pooled['filled_where_stated']}/{pooled['stated']}"
        f" ({number(pooled['value'])}{interval(pooled['ci'])}, bootstrap over results).",
        "",
        *table(
            ["Field", "Page states", "Filled", "Completeness", "Filled, page silent"]
            + ["Unanswered"],
            rows,
        ),
        "",
        f"Agreement on the {agreement['overlap']} overlap results: Cohen's kappa"
        f" {kappa_cell(agreement['pooled'])} over {agreement['pooled']['pairs']} field judgements"
        f" (raw agreement {number(agreement['pooled']['agreement'])}).",
        "",
        *table(
            ["Field", "Judged by both", "Raw agreement", "Cohen's kappa"],
            [
                [field, a["pairs"], number(a["agreement"]), kappa_cell(a)]
                for field, a in agreement["fields"].items()
            ],
        ),
    ]
