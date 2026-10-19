"""Which words of the agent's reply the results it rests on do not hold.

grounding.py checks the people a reply names; this checks every word. A word is held if it is a
word of a result's name, of the project a result is shown through, or of a claim value of a
result, or one of LINKING_WORDS: function words and the few verbs that only tie a name to a claim
("works on", "is a"). A plural matches its singular ("sensors", "sensor"). So a number, a title,
a role or a place that no claim holds fails the reply, and so does a premise copied from the
question, since the question is not among the claims. "no", "not" and "yes" are not linking words:
with them a reply could confirm or deny a premise in claim words alone.

Which result a fact belongs to is not checked: a claim of one result written about another passes.
English only, like grounding.py.
"""

from collections.abc import Iterator, Mapping, Sequence
from typing import Any

from bernlife.grounding import claim_values, shown_names
from bernlife.names import fold

LINKING_WORDS = frozenset(
    {"a", "an", "the", "this", "that", "these", "those", "its", "his", "her", "their", "s"}
    | {"of", "in", "on", "at", "to", "for", "from", "with", "by", "as", "about", "into", "via"}
    | {"and", "or", "both", "also", "i", "he", "she", "it", "they", "who", "whose", "which"}
    | {"is", "are", "has", "have", "work", "works", "working", "research", "researches"}
    | {"studies", "focus", "focuses", "expert", "experts", "expertise", "role", "unit", "project"}
    | {"here", "found", "result", "results", "source", "sources", "show", "shows", "according"}
    | {"page", "pages", "profile"}
)


def unsupported_words(reply: str, responses: Sequence[Mapping[str, Any]]) -> list[str]:
    """The reply's words, folded, that neither the results nor LINKING_WORDS hold, in order."""
    names = " ".join(named.name for named in shown_names(responses))
    held = {
        form
        for word in [*fold(names).split(), *claim_values(responses).split(), *LINKING_WORDS]
        for form in _forms(word)
    }
    words = fold(reply).split()
    return list(dict.fromkeys(w for w in words if not any(f in held for f in _forms(w))))


def _forms(word: str) -> Iterator[str]:
    """The word and, for a longer one, the singulars it could be the plural of."""
    yield word
    if len(word) > 3 and word.endswith("s"):
        yield word[:-1]
        if word.endswith("es"):
            yield word[:-2]
        if word.endswith("ies"):
            yield word[:-3] + "y"
