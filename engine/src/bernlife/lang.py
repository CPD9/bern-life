"""Which of de, en, fr and it a page is written in, read from marker words.

Adapted from apertus-redteam-graph `track_1a/src/redteam/lang_profile.py` and `lang_markers.json`
(Apache-2.0, CPD9). The marker lists for de, en, fr and it are copied as they are; Swiss German
and Romansh are left out because the sources publish neither. Every marker word in the text is one
vote, and the language with most votes wins if it leads clearly; a word list is crude, but every
decision can be traced to the words that made it. When the vote is unclear, the page's own
`<html lang>` decides if it names one of the four.
"""

import json
import re
import unicodedata
from collections import Counter
from functools import cache
from pathlib import Path

MARKERS = Path(__file__).with_name("lang_markers.json")
UNKNOWN = "unknown"
LANGUAGES = ("de", "en", "fr", "it")
MIN_VOTES = 3  # fewer marker words than this is too little to go on
MIN_LEAD = 2  # so that one stray or quoted word cannot decide between two languages
MIN_MARGIN = 0.25  # the winner's lead over the runner-up, as a share of all votes

APOSTROPHES = str.maketrans({"’": "'", "‘": "'", "ʼ": "'", "`": "'", "´": "'"})
# The English clitics 's, 'd, 't and 'm are no words of their own. A Romance elision before a
# one-letter word (jusqu'à) keeps both words.
CLITIC = re.compile(r"(?<=[^\W\d_])'[sdtm]\b")
# The letters of an abbreviation (U.S., d. h., z.B.) are no words either.
ABBREVIATION = re.compile(r"\b[^\W\d_]\.(?:[^\W\d_]+\.|\s[^\W\d_]\.)+")
# A word keeps a following apostrophe when a letter comes next, so the elided l' and qu' are words.
WORD = re.compile(r"\b[^\W\d_]+(?:'(?=[^\W\d_]))?")


@cache
def markers() -> dict[str, str]:
    """Each marker word with its language; a word listed for two languages would blur the vote."""
    table: dict[str, str] = {}
    for lang, entry in json.loads(MARKERS.read_text()).items():
        for word in entry["markers"]:
            if table.setdefault(word, lang) != lang:
                raise ValueError(f"{word!r} is a marker of both {table[word]} and {lang}")
    return table


def words(text: str) -> list[str]:
    text = unicodedata.normalize("NFC", text).translate(APOSTROPHES).casefold()
    return WORD.findall(ABBREVIATION.sub(" ", CLITIC.sub("", text)))


def votes(text: str) -> Counter[str]:
    table = markers()
    return Counter(table[word] for word in words(text) if word in table)


def language(text: str, declared: str | None = None) -> str:
    counted = votes(text)
    ranked = sorted(LANGUAGES, key=lambda lang: -counted[lang])  # stable: ties keep list order
    total = sum(counted.values())
    lead = counted[ranked[0]] - counted[ranked[1]]
    if total >= MIN_VOTES and lead >= MIN_LEAD and lead / total >= MIN_MARGIN:
        return ranked[0]
    return declared if declared in LANGUAGES else UNKNOWN
