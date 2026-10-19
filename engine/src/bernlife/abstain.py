"""When to say "no verifiable source" instead of showing results.

Two checks. Weak support: no candidate matches enough of the query's word weight and none is
close enough in meaning; both thresholds were set on eval/dev.jsonl only (docs/search.md). And a
premise check: a person the query names after a title ("Prof. X", "Dr. X", "Pre X", "Prof.in X")
is a hypothesis, not a fact, and must be found among the candidates' names; otherwise the answer
would be about somebody else. A name with no title is not detected.
"""

import re
from collections.abc import Sequence

from bernlife.names import GENDER_SUFFIX, PARTICLES, TITLES, fold, is_title
from bernlife.ranking import Candidate

# Midpoints between the dev set's off-topic and answerable queries (calibrate, docs/search.md).
MIN_COVERAGE = 0.332
MIN_SIMILARITY = 0.824
NO_SOURCE = "no_verifiable_source"
OPENING_TITLES = frozenset(
    {"prof", "professor", "professorin", "dr", "pd", "frau", "herr", "doktor", "doktorin"}
    | {"mme", "madame", "monsieur", "mr", "mrs", "ms", "mlle", "mademoiselle"}
    | {"pr", "pre", "professeur", "professeure", "dre", "docteur", "docteure"}
)
# "PR" in capitals is public relations, not the French "Pr" (professeur).
ACRONYMS = frozenset({"PR"})
NAME_WORD = re.compile(r"^[^\W\d_][^\W\d_'’-]*(?:[-'’][^\W\d_]+)*$")
POSSESSIVE = re.compile(r"(?:'s|’s|')$")
MAX_NAME_WORDS = 3


def named_people(query: str) -> list[tuple[str, ...]]:
    """Folded name words after each opening title, e.g. "Prof. Dr. Ada Muster's" → (ada, muster)."""
    words = query.split()
    people = []
    index = 0
    while index < len(words):
        if not opens_name(words[index]):
            index += 1
            continue
        index += 1
        while index < len(words) and is_title(words[index]):
            index += 1
        name, index = _name_at(words, index)
        if name:
            people.append(name)
    return people


def opens_name(word: str) -> bool:
    """A title a name follows: "Prof.", "Dre", "Prof.in", "Dr.med." (more titles may follow)."""
    parts = fold(word).split()
    if not parts or parts[0] not in OPENING_TITLES or word.strip(".,;:") in ACRONYMS:
        return False
    return all(part in TITLES | {GENDER_SUFFIX} for part in parts[1:])


def _name_at(words: Sequence[str], index: int) -> tuple[tuple[str, ...], int]:
    name: list[str] = []
    while index < len(words) and len(name) < MAX_NAME_WORDS:
        raw = words[index]
        core = POSSESSIVE.sub("", raw.strip('.,;:!?()"«»“”'))
        if fold(core) in PARTICLES and name:
            index += 1
            continue
        if not (NAME_WORD.match(core) and core[0].isupper()):
            break
        name.append(fold(core))
        index += 1
        if core != raw:
            break
    return tuple(name), index


def unmatched_person(query: str, found: Sequence[Candidate]) -> bool:
    people_names = [set(fold(c.name).split()) for c in found if c.kind == "person"]
    return any(
        not any(set(person) <= words for words in people_names) for person in named_people(query)
    )


def weak_support(found: Sequence[Candidate]) -> bool:
    return not any(c.coverage >= MIN_COVERAGE or c.similarity >= MIN_SIMILARITY for c in found)


def abstain_reason(query: str, found: Sequence[Candidate]) -> str | None:
    if not found or weak_support(found) or unmatched_person(query, found):
        return NO_SOURCE
    return None
