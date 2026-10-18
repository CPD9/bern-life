"""The extract report: what was found, from where, and what the verifier threw away and why."""

from collections import Counter
from collections.abc import Mapping

from bernlife.extract import Extraction
from bernlife.extract_records import FIELDS, PROFILE_KINDS, Page


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
    lines.append("field completeness (share of profiles with at least one value)")
    for kind in PROFILE_KINDS:
        of_kind = [p for p in profiles if p["kind"] == kind]
        if of_kind:
            shares = " ".join(f"{f} {_share(of_kind, f)}" for f in FIELDS)
            lines.append(f"  {kind:<15} {len(of_kind):>5}  {shares}")
    lines.append(f"subjects without a verified name: {result.unnamed_subjects}")
    without = ", ".join(f"{k} {n}" for k, n in sorted(result.pages_without_subject.items()))
    lines.append(f"pages without a readable subject: {without or 'none'}")
    return "\n".join(lines)


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
