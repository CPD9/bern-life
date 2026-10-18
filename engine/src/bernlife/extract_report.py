"""The extract report: what was found, from where, and what the verifier threw away and why."""

from collections import Counter
from collections.abc import Mapping

from bernlife.extract import Extraction
from bernlife.extract_records import PROFILE_KINDS, Page, fields_for

NOT_FOUND = "span_not_in_page"


def summary(result: Extraction, pages: Mapping[str, Page], model_label: str) -> str:
    profiles = result.profiles
    lines = [
        f"extract: {len(pages)} pages, {len(profiles)} profiles, {len(result.relations)} relations"
    ]
    lines.append(
        f"model: {model_label}; {result.model_pages} pages, {result.model_calls} calls, "
        f"{result.model_cached} answered from the cache"
    )
    lines += _table(
        "profiles by kind and source", Counter((p["kind"], p["source_id"]) for p in profiles)
    )
    units = Counter(pages[str(p["source_url"])].unit for p in profiles if p["kind"] == "person")
    lines += _table(
        "people by unit (unit of their main page)", Counter({(u,): n for u, n in units.items()})
    )
    lines += _table("claims by field and method", _claims(profiles))
    lines += _table("dropped by reason", Counter({(r,): n for r, n in result.dropped.items()}))
    lines += _by_field(result.verdicts)
    not_found = sum(n for (m, _, v), n in result.verdicts.items() if (m, v) == ("model", NOT_FOUND))
    lines.append(f"model proposals not found on the page: {not_found}, all dropped")
    adjusted = ", ".join(f"{kind} {n}" for kind, n in sorted(result.adjusted.items()))
    lines.append(f"kept spans replaced by the page's own text: {adjusted or 'none'}")
    lines.append("field completeness (share of profiles with at least one value)")
    for kind in PROFILE_KINDS:
        of_kind = [p for p in profiles if p["kind"] == kind]
        if of_kind:
            shares = " ".join(f"{f} {_share(of_kind, f)}" for f in fields_for(kind))
            lines.append(f"  {kind:<15} {len(of_kind):>5}  {shares}")
    lines.append(f"subjects without a verified name: {result.unnamed_subjects}")
    without = ", ".join(f"{k} {n}" for k, n in sorted(result.pages_without_subject.items()))
    lines.append(f"pages without a readable subject: {without or 'none'}")
    return "\n".join(lines)


def _by_field(verdicts: Counter[tuple[str, str, str]]) -> list[str]:
    """Model proposals per field: kept, then each drop reason, before profiles are merged."""
    model = Counter(
        {(field, verdict): n for (m, field, verdict), n in verdicts.items() if m == "model"}
    )
    columns = sorted({verdict for _, verdict in model}, key=lambda v: (v != "kept", v))
    fields = sorted({field for field, _ in model})
    head = f"  {'field':<20}" + "".join(f"{column:>18}" for column in columns)
    rows = [f"  {f:<20}" + "".join(f"{model[f, c] or '':>18}" for c in columns) for f in fields]
    return ["model proposals by field", *([head, *rows] if fields else ["  none"])]


def _claims(profiles: tuple[dict, ...]) -> Counter[tuple[str, ...]]:
    counts = Counter[tuple[str, ...]]()
    for profile in profiles:
        counts["name", profile["name"]["method"]] += 1
        for field, claims in profile["fields"].items():
            for claim in claims:
                counts[field, claim["method"]] += 1
    return counts


def _share(profiles: list[dict], field: str) -> str:
    filled = sum(1 for profile in profiles if profile["fields"][field])
    return f"{round(100 * filled / len(profiles))}%"


def _table(title: str, counts: Counter[tuple[str, ...]]) -> list[str]:
    rows = [
        f"  {' '.join(f'{part:<14}' for part in key)} {n:>6}" for key, n in sorted(counts.items())
    ]
    return [title, *(rows or ["  none"])]
