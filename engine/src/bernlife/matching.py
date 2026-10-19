"""Which claims match a query, and which candidates may be shown at all.

A result must be able to say why it matches: at least one cited claim besides its name shares a
content word with the query, unless the query names the profile itself. Otherwise a bare name from
a news or partner page, credited by a passage it appears in, would fill the top ten with entries
that have nothing to show. This decides whether a result can carry a reason, not how prominent it
is, so it adds no prominence signal.

A claim matches through its own words or its enrichment terms; the question matches through its
own words or its expansion terms. Either way the reason cites the verbatim claim, never a term.

Words are folded (case, accents), need three letters and are compared by their light word form
(word_forms.py), so "Kohlenhydrate" matches a claim on "Kohlenhydraten". Function words and the
generic words of a search ("research", "who", "forscht"), in any of their forms, are left out:
sharing "and" or "der" is not a reason. A reason cites the claims sharing an exact word first, and
the claims sharing only a form when there are none, so its claims, and the explanation written
from them, stay those an exact match would give.
"""

import re
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from bernlife.abstain import named_people
from bernlife.names import PARTICLES, TITLES, display_name, fold
from bernlife.word_forms import word_form

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


STOPWORD_FORMS = frozenset(word_form(word) for word in STOPWORDS)


def words(text: str) -> set[str]:
    return set(WORD.findall(fold(text))) - STOPWORDS


def forms(text: str) -> set[str]:
    """The word forms of the content words: what a question and a claim are compared on."""
    return {word_form(word) for word in words(text)} - STOPWORD_FORMS


def exact_words(text: str) -> set[str]:
    """The content words whose form counts, as written: an exact match is also a form match."""
    return {word for word in words(text) if word_form(word) not in STOPWORD_FORMS}


@dataclass(frozen=True)
class Asked:
    query: str
    forms: frozenset[str]
    words: frozenset[str]


def asked(query: str, terms: Iterable[str] = ()) -> Asked:
    """The forms and words of the question's content words, plus those of its expansion terms."""
    texts = (query, *terms)
    return Asked(
        query,
        frozenset().union(*(forms(text) for text in texts)),
        frozenset().union(*(exact_words(text) for text in texts)),
    )


def matched_claims(
    question: Asked,
    profile: Profile,
    enrichment: Mapping[str, Sequence[str]] | None = None,
    exact: bool = False,
) -> list[tuple[str, int]]:
    """(field, index) of every non-name claim sharing a content word form with the question, or
    with `exact`, a content word as written."""
    terms = enrichment or {}
    keys, asked_keys = (exact_words, question.words) if exact else (forms, question.forms)
    return [
        (field, index)
        for field, index, value in _values(profile)
        if (keys(value).union(*(keys(t) for t in terms.get(value, ())))) & asked_keys
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
