"""Invented gold lines, profiles and results for the evaluator tests. Nobody here is real."""

import hashlib
from collections.abc import Sequence
from typing import Any

from evaluator.load import GoldQuery, gold_query

Record = dict[str, Any]
SHA = "0" * 64


def page(url: str, text: str, unit: str = "Invented Unit") -> Record:
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return {
        "url": url,
        "source_id": "unibe",
        "unit": unit,
        "fetched_at": "2026-10-18T12:00:00Z",
        "sha256": digest,
        "status": 200,
        "text": text,
    }


def claim(value: str, url: str, sha: str = SHA, span: str | None = None) -> Record:
    evidence = {"page_url": url, "page_sha256": sha, "span": span or value}
    return {"value": value, "method": "selector", "evidence": evidence}


def profile(
    pid: str, kind: str, name: str, url: str, source: str = "unibe", sha: str = SHA
) -> Record:
    fields: dict[str, list[Record]] = {
        "role": [],
        "unit": [],
        "expertise": [],
        "projects": [],
        "infrastructure": [],
        "services": [],
    }
    return {
        "id": pid,
        "kind": kind,
        "source_id": source,
        "name": claim(name, url, sha),
        "source_url": url,
        "fields": fields,
    }


def result(rank: int, prof: Record) -> Record:
    reason = {"text": "Invented reason.", "cites": ["/name"]}
    return {"rank": rank, "profile": prof, "reason": reason, "score": {"fused": 0.5}}


def response(results: list[Record], abstained: bool = False) -> Record:
    versions = {"engine": "test", "snapshot": "test", "prompts": "test"}
    return {
        "query": "invented",
        "mode": "mock",
        "abstained": abstained,
        "results": results,
        "expanded_terms": [],
        "versions": versions,
    }


def gold(
    qid: str,
    variant: str = "site",
    people: Sequence[tuple[str, str]] = (),
    units: Sequence[tuple[str, str]] = (),
    base: str | None = None,
    abstain: bool = False,
    lang: str = "en",
    sources: Sequence[str] = ("unibe",),
) -> GoldQuery:
    row: Record = {"id": qid, "query": f"invented query {qid}", "lang": lang, "variant": variant}
    row |= {"sources": list(sources), "expect": {"abstain": abstain}}
    row["expect"]["people"] = [{"name": n, "proof_url": u, "proof_span": n} for n, u in people]
    row["expect"]["units"] = [{"name": n, "proof_url": u, "proof_span": n} for n, u in units]
    if base:
        row["variant_of"] = base
    return gold_query(row)
