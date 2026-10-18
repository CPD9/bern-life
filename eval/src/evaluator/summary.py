"""Every metric per source, per language and per variant, and pooled, with its interval.

recall@10 and MRR get a cluster bootstrap over base needs; abstention rates are independent
proportions and get Wilson intervals. A slice with nothing to measure has no value (n = 0), and a
check whose input was not given (pages, profiles) is None: neither is ever reported as 0.
"""

from collections import defaultdict
from collections.abc import Callable, Sequence

from .load import GoldQuery
from .score import QueryResult
from .stats import cluster_bootstrap, wilson

SOURCES = ("unibe", "artorg", "dcb")
LANGS = ("de", "en", "fr")
VARIANTS = ("site", "synonym", "lay", "translation", "control", "invented")
RECALL_BAR = 0.80
INVENTED_BAR = 0.90
SITE_FALSE_ABSTENTIONS_ALLOWED = 1

Slice = tuple[str, Callable[[GoldQuery], bool]]


def slices() -> list[Slice]:
    return [
        ("pooled", lambda query: True),
        *((f"source:{s}", lambda query, s=s: s in query.sources) for s in SOURCES),
        *((f"lang:{lang}", lambda query, lang=lang: query.lang == lang) for lang in LANGS),
        *((f"variant:{v}", lambda query, v=v: query.variant == v) for v in VARIANTS),
    ]


def mean_with_interval(values: dict[str, list[float]]) -> dict[str, object] | None:
    flat = [value for cluster in values.values() for value in cluster]
    if not flat:
        return None
    return {"value": sum(flat) / len(flat), "ci": cluster_bootstrap(values), "queries": len(flat)}


def proportion(k: int, n: int) -> dict[str, object]:
    if not n:
        return {"k": 0, "n": 0, "value": None, "ci": None}
    return {"k": k, "n": n, "value": k / n, "ci": wilson(k, n)}


def summarise(results: Sequence[QueryResult]) -> dict[str, object]:
    recall: dict[str, list[float]] = defaultdict(list)
    mrr: dict[str, list[float]] = defaultdict(list)
    for result in results:
        if result.recall is not None and result.reciprocal_rank is not None:
            recall[result.gold.base].append(result.recall)
            mrr[result.gold.base].append(result.reciprocal_rank)
    invented_queries = [r for r in results if r.gold.abstain]
    answerable = [r for r in results if not r.gold.abstain]
    snapshot_checked = all(r.claims is not None and r.invented is not None for r in results)
    claims = sum(r.claims or 0 for r in results)
    misses = sum(len(r.misses) for r in results)
    return {
        "queries": len(results),
        "recall_at_10": mean_with_interval(recall),
        "mrr": mean_with_interval(mrr),
        "invented_abstained": proportion(
            sum(r.abstained for r in invented_queries), len(invented_queries)
        ),
        "false_abstention": proportion(sum(r.abstained for r in answerable), len(answerable)),
        "traceable_claims": proportion(claims - misses, claims) if snapshot_checked else None,
        "invented_entities": sum(len(r.invented or ()) for r in results)
        if snapshot_checked and results
        else None,
    }


def by_slice(results: Sequence[QueryResult]) -> dict[str, dict[str, object]]:
    return {name: summarise([r for r in results if keep(r.gold)]) for name, keep in slices()}


def jaccard(a: frozenset[str], b: frozenset[str]) -> float | None:
    return len(a & b) / len(a | b) if a | b else None


def variant_agreement(results: Sequence[QueryResult]) -> dict[str, dict[str, object]]:
    """Top-10 overlap of each rewording with its base query; pairs where both show nothing are
    counted but have no overlap to measure."""
    base_top = {r.gold.id: r.top_ids for r in results}
    overlaps: dict[str, list[float | None]] = defaultdict(list)
    for result in results:
        if result.gold.base != result.gold.id:
            overlaps[result.gold.variant].append(
                jaccard(result.top_ids, base_top[result.gold.base])
            )
    agreement = {}
    for variant, values in sorted(overlaps.items()):
        measured = [value for value in values if value is not None]
        agreement[variant] = {
            "pairs": len(values),
            "jaccard_mean": sum(measured) / len(measured) if measured else None,
            "both_empty": len(values) - len(measured),
        }
    return agreement


def decisions(pooled: dict[str, object], results: Sequence[QueryResult]) -> dict[str, dict]:
    """The pre-registered decision rules, each "met", "not met" or "not computed" with the numbers
    it was decided on."""
    recall, traced = pooled["recall_at_10"], pooled["traceable_claims"]
    unknown, invented_rate = pooled["invented_entities"], pooled["invented_abstained"]
    site_false = sum(
        r.abstained for r in results if r.gold.variant == "site" and not r.gold.abstain
    )
    rules: dict[str, dict] = {}
    if isinstance(recall, dict):
        met = recall["value"] >= RECALL_BAR
        rules["criterion_1"] = {
            "status": status(met),
            "recall_at_10": recall["value"],
            "ci": recall["ci"],
        }
    else:
        rules["criterion_1"] = {"status": "not computed"}
    if isinstance(traced, dict) and traced["n"] and isinstance(unknown, int):
        met = traced["k"] == traced["n"] and unknown == 0
        rules["criterion_3"] = {"status": status(met), "untraceable": traced["n"] - traced["k"]}
        rules["criterion_3"]["invented_entities"] = unknown
    else:
        rules["criterion_3"] = {"status": "not computed"}
    if isinstance(invented_rate, dict) and invented_rate["n"]:
        met = (
            invented_rate["value"] >= INVENTED_BAR and site_false <= SITE_FALSE_ABSTENTIONS_ALLOWED
        )
        rules["abstention"] = {"status": status(met), "invented_abstained": invented_rate["k"]}
        rules["abstention"] |= {
            "invented": invented_rate["n"],
            "site_false_abstentions": site_false,
        }
    else:
        rules["abstention"] = {"status": "not computed"}
    return rules


def status(met: bool) -> str:
    return "met" if met else "not met"
