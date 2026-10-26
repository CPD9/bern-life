"""`python -m bernlife enrich`: enrichment terms for every expertise value into terms.jsonl.

Only values with no stored terms go to the model, so a re-extraction asks for the new values
alone and the stored terms keep their bytes; terms of values no profile carries any more are
dropped. Every call goes through the cached router, so a second run (or `replay`) costs nothing.
A batch whose call fails is counted by its marker and left out; the run goes on. MOCK writes
nothing, because a mock reply is not a term.
"""

import os
import sys
from collections import Counter
from collections.abc import Iterable, Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor

from bernlife import config, paths
from bernlife.bundle_files import read_bundle
from bernlife.cache import CacheMiss
from bernlife.enrich import (
    ENRICH_PROMPT_VERSION,
    MAX_TOKENS,
    batches,
    expertise_values,
    parse_enrichment,
    prompt,
    term_rows,
)
from bernlife.jsonl import write_jsonl
from bernlife.llm import Chat, connect
from bernlife.llm_http import ModelUnavailable
from bernlife.llm_json import ask_json
from bernlife.terms import Term

SORT_KEY = ("value", "term", "kind")  # the order term_rows writes


def enrich_batch(llm: Chat, batch: list[str]) -> tuple[dict[str, list[Term]], str | None]:
    try:
        reply = ask_json(
            llm,
            prompt(batch),
            role="enrich",
            prompt_version=ENRICH_PROMPT_VERSION,
            max_tokens=MAX_TOKENS,
        )
    except ModelUnavailable as failure:
        return {}, failure.marker
    except CacheMiss:
        return {}, "cache_miss"
    return parse_enrichment(reply, batch), None


def enrich(llm: Chat, values: Sequence[str], workers: int) -> tuple[list[dict[str, str]], Counter]:
    found: dict[str, list[Term]] = {}
    failures: Counter[str] = Counter()
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for terms, marker in pool.map(lambda b: enrich_batch(llm, b), batches(values)):
            found.update(terms)
            if marker:
                failures[marker] += 1
    return term_rows(found, llm.models()["enrich"]), failures


def stored_terms(
    rows: Iterable[dict[str, object]], values: Sequence[str]
) -> tuple[list[dict[str, object]], list[str]]:
    """The stored rows of the current values, and the values that have none."""
    current = set(values)
    kept = [row for row in rows if row["value"] in current]
    stored = {str(row["value"]) for row in kept}
    return kept, [value for value in values if value not in stored]


def main(argv: Sequence[str], env: Mapping[str, str] = os.environ) -> int:
    if argv:
        print("usage: python -m bernlife enrich", file=sys.stderr)
        return 2
    llm = connect(env)
    if llm.backend == "mock":
        print("enrich: MOCK, no model connected; terms.jsonl left as it is", file=sys.stderr)
        return 1
    bundle_dir = paths.data_dir(env) / "bundle"
    bundle = read_bundle(bundle_dir)
    values = expertise_values(bundle.profiles)
    kept, asked = stored_terms(bundle.terms, values)
    fresh, failures = enrich(llm, asked, config.max_concurrency(env))
    rows = sorted([*kept, *fresh], key=lambda row: tuple(str(row[k]) for k in SORT_KEY))
    write_jsonl(bundle_dir / "terms.jsonl", rows)
    enriched = len({row["value"] for row in fresh})
    failed = ", ".join(f"{marker} {n}" for marker, n in sorted(failures.items())) or "none"
    print(
        f"enrich: {llm.backend}, {len(values)} values, {len(values) - len(asked)} with stored"
        f" terms, {len(asked)} asked, {enriched} enriched now, {len(rows)} terms;"
        f" failed batches: {failed}"
    )
    return 0
