"""Which claims match a query, and which candidates may be shown at all.

A result must be able to say why it matches: at least one cited claim besides its name shares a
content word with the query, unless the query names the profile itself. Otherwise a bare name from
a news or partner page, credited by a passage it appears in, would fill the top ten with entries
that have nothing to show. This decides whether a result can carry a reason, not how prominent it
is, so it adds no prominence signal.

A claim matches through its own words or its enrichment terms; the question matches through its
own words or its expansion terms. Either way the reason cites the verbatim claim, never a term.

Words are folded (case, accents) and need three letters. Function words and the generic words of
a search ("research", "who", "forscht") are left out: sharing "and" or "der" is not a reason.
"""

import re
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from bernlife.abstain import named_people
from bernlife.names import PARTICLES, TITLES, display_name, fold

Profile = Mapping[str, Any]
ORDER = ("expertise", "projects", "infrastructure", "services", "role", "unit")
WORD = re.compile(r"[a-z]{3,}")
STOPWORDS = frozenset(
    # English
    {"the", "and", "for", "with", "who", "whom", "whose", "what", "which", "that", "this"}
    | {"these", "those", "are", "was", "were", "has", "have", "had", "does", "did", "from"}
    | {"into", "about", "any", "anyone", "someone", "all", "can", "could", "would", "should"}
    | {"will", "how", "why", "when", "where", "there", "their", "them", "they", "our", "your"}
    | {"you", "his", "her", "its", "not", "but", "also", "than", "then", "some", "such", "out"}
    | {"over", "under", "between", "during", "using", "use", "used", "via", "per", "find"}
    | {"looking", "need", "needs", "work", "works", "working", "people", "person", "expert"}
    | {"experts", "expertise", "research", "researcher", "researchers", "researching"}
    | {"study", "studies", "studying", "investigates", "investigate"}
    | {"bern", "berne", "university", "universitat", "universite", "unibe"}
    # German
    | {"der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer"}
    | {"und", "oder", "mit", "von", "vom", "zum", "zur", "fur", "auf", "aus", "bei", "nach"}
    | {"uber", "unter", "wer", "was", "wie", "welche", "welcher", "welches", "ist", "sind"}
    | {"hat", "haben", "wird", "werden", "sich", "auch", "nicht", "als", "dazu", "diese"}
    | {"dieser", "dieses", "forscht", "forschen", "forschung", "erforscht", "untersucht"}
    | {"arbeitet", "jemand", "gibt", "sie", "ich", "wir", "ihr", "uns", "man", "kann"}
    # French
    | {"les", "des", "une", "est", "sont", "qui", "que", "quoi", "quel", "quelle", "quels"}
    | {"quelles", "pour", "avec", "dans", "sur", "par", "aux", "ses", "son", "leur", "leurs"}
    | {"cette", "ces", "mais", "pas", "plus", "travaux", "recherche", "recherches", "etudie"}
    | {"travaille", "quelqu", "personne"}
)


def words(text: str) -> set[str]:
    return set(WORD.findall(fold(text))) - STOPWORDS


@dataclass(frozen=True)
class Asked:
    query: str
    words: frozenset[str]


def asked(query: str, terms: Iterable[str] = ()) -> Asked:
    """The question's content words, plus those of its expansion terms."""
    return Asked(query, frozenset(words(query).union(*(words(term) for term in terms))))


def matched_claims(
    question: Asked, profile: Profile, enrichment: Mapping[str, Sequence[str]] | None = None
) -> list[tuple[str, int]]:
    """(field, index) of every non-name claim sharing a content word with the question."""
    terms = enrichment or {}
    return [
        (field, index)
        for field, index, value in _values(profile)
        if (words(value).union(*(words(t) for t in terms.get(value, ())))) & question.words
    ]


def _values(profile: Profile) -> list[tuple[str, int, str]]:
    return [
        (field, index, claim["value"])
        for field in ORDER
        for index, claim in enumerate(profile["fields"][field])
    ]


def name_words(name: str) -> set[str]:
    return {w for w in fold(display_name(name)).split() if w not in TITLES | PARTICLES}


def names_profile(query: str, profile: Profile) -> bool:
    """The query holds the profile's whole name, or a titled name ("Prof. Muster") that is part
    of a person's name."""
    own = name_words(profile["name"]["value"])
    if own and own <= set(fold(query).split()):
        return True
    return profile["kind"] == "person" and any(set(person) <= own for person in named_people(query))


def can_explain(
    question: Asked, profile: Profile, enrichment: Mapping[str, Sequence[str]] | None = None
) -> bool:
    return bool(matched_claims(question, profile, enrichment)) or names_profile(
        question.query, profile
    )
