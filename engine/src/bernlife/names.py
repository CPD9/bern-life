"""Names of people and units as matching keys, ids and plausibility checks.

The same person appears as "Prof. Dr. Ada Muster" on one page and "Ada Muster" on another, so
people merge on a key with titles, accents, case and punctuation removed. The key decides merges
and ids only; every displayed value stays a verbatim part of its page.
"""

import re
import unicodedata

TITLES = frozenset(
    {"prof", "profs", "professor", "professorin", "dr", "drs", "em", "med", "phil", "nat", "rer"}
    | {"pd", "dipl", "ing", "msc", "bsc", "phd", "hc", "dent", "vet", "pharm", "jur", "oec"}
    | {"mag", "lic", "theol", "sc", "techn", "habil", "mme", "mr", "mrs", "ms", "frau", "herr"}
)
PARTICLES = frozenset({"von", "van", "de", "der", "den", "di", "da", "del", "della", "le", "la"})
PARTICLES |= frozenset({"du", "des", "dos", "zu", "zum", "ten", "ter", "y", "i", "e", "al", "el"})
NOT_PEOPLE = frozenset(
    {"ag", "gmbh", "inc", "ltd", "sa", "llc", "university", "universitat", "universite"}
    | {"institute", "institut", "center", "centre", "zentrum", "lab", "laboratory", "group"}
    | {"team", "department", "foundation", "stiftung", "hospital", "spital", "clinic", "klinik"}
)
TWIN_SUFFIX = re.compile(r"_(?:eng|ger|fre|ita)(\.html?)$")
NON_ALNUM = re.compile(r"[^0-9a-z]+")


def fold(text: str) -> str:
    """Lowercase ASCII words separated by single spaces: accents, case and punctuation gone."""
    decomposed = unicodedata.normalize("NFKD", text.replace("&", " and "))
    ascii_text = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(NON_ALNUM.split(ascii_text.casefold())).strip()


def display_name(name: str) -> str:
    """The name without leading titles or a trailing ", PhD"; still a substring of the input."""
    words = name.strip().strip(",").split(" ")
    while words and _is_title(words[0]):
        words.pop(0)
    while words and (_is_title(words[-1]) or words[-1] == ","):
        words.pop()
    return " ".join(words).strip().rstrip(",")


def person_key(name: str) -> str:
    return " ".join(word for word in fold(name).split() if word not in TITLES)


def looks_like_person(name: str) -> bool:
    words = name.split()
    if not 2 <= len(words) <= 6 or any(char.isdigit() for char in name):
        return False
    if any(fold(word) in NOT_PEOPLE for word in words):
        return False
    return all(word[0].isupper() or word in PARTICLES for word in words)


def mentions(span: str, name: str) -> bool:
    """Whether the span names `name`, word for word, ignoring case, accents and punctuation."""
    folded_name = fold(display_name(name))
    return bool(folded_name) and f" {folded_name} " in f" {fold(span)} "


def slug(text: str, limit: int = 80) -> str:
    return fold(text).replace(" ", "-")[:limit].strip("-") or "unnamed"


def has_language_suffix(url: str) -> bool:
    return TWIN_SUFFIX.search(url) is not None


def twin_key(url: str) -> str:
    """The URL with its language suffix removed, so index_eng.html and index_ger.html meet."""
    return TWIN_SUFFIX.sub(r"\1", url)


def _is_title(word: str) -> bool:
    parts = fold(word).split()
    return bool(parts) and all(part in TITLES for part in parts)
