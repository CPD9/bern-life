"""Retrieval terms a model proposes (synonyms, lay terms, translations, acronyms), checked in code.

Terms only help search find pages; they are never shown as a fact about anyone. Code keeps a term
only if it has a known kind and language, is a short phrase, says something other than what it
expands, and carries no word of a person's name the question gave: a premise is not passed on.
"""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import Any

from bernlife.names import fold

KINDS = ("synonym", "lay", "translation", "acronym")
LANGS = ("de", "en", "fr", "it")
MAX_TERM_CHARS = 80


@dataclass(frozen=True)
class Term:
    term: str
    kind: str
    lang: str

    def as_record(self) -> dict[str, str]:
        return {"term": self.term, "kind": self.kind, "lang": self.lang}


def enrichment_by_value(rows: Iterable[Mapping[str, Any]]) -> dict[str, list[str]]:
    """terms.jsonl rows as value → terms, in file order."""
    found: dict[str, list[str]] = {}
    for row in rows:
        found.setdefault(str(row["value"]), []).append(str(row["term"]))
    return found


def checked_terms(items: Any, expands: str, banned: Iterable[str] = ()) -> list[Term]:
    """The valid terms of a model's list, in its order, without repeats."""
    if not isinstance(items, list):
        return []
    banned_words = set(banned)
    seen = {fold(expands)}
    kept = []
    for item in items:
        if not isinstance(item, dict):
            continue
        term, kind, lang = item.get("term"), item.get("kind"), item.get("lang")
        if not isinstance(term, str) or kind not in KINDS or lang not in LANGS:
            continue
        term = " ".join(term.split())
        folded = fold(term)
        if not folded or len(term) > MAX_TERM_CHARS or folded in seen:
            continue
        if banned_words & set(folded.split()):
            continue
        seen.add(folded)
        kept.append(Term(term, kind, lang))
    return kept
