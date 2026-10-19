"""Light word forms, so "Kohlenhydrate" meets "Kohlenhydraten" and "sensor" meets "sensors".

The pages and questions mix German, French and English, and a word's language is not known, so
one short list of inflection endings serves all three: German case and plural endings (-e, -en,
-er, -es, -em, -ern) and the plural -s, which may sit on one of them ("cancers", "Musters"). At
least four letters stay, so "liver" never meets "live". A double "ss" or a final "us" is no plural
("process", "virus"). No derivation: "Genetik" does not meet "genetics", and "Schätzung" does not
meet "schätzt". Both sides of a comparison go through the same function, so a form is only a key
for matching; nothing shown is ever a form.
"""

ENDINGS = ("ern", "en", "er", "es", "em", "e", "s")  # longest first
PLURAL = "s"
NOT_PLURAL = ("ss", "us")
MIN_STEM = 4
# Full text matches a form as a prefix ("kohlenhydrat:*"), which also reaches compounds and
# derived words, so it needs a longer form than the exact comparison of claims.
MIN_PREFIX = 5


def word_form(word: str) -> str:
    """The word without its inflection ending, e.g. kohlenhydraten → kohlenhydrat, and without a
    plural -s and the ending under it, e.g. cancers → canc (as cancer → canc)."""
    stem = _strip(word, ENDINGS)
    if stem == word[: -len(PLURAL)] and word.endswith(PLURAL):
        stem = _strip(stem, ENDINGS[:-1])
    return stem


def prefix_form(lexeme: str) -> str | None:
    """The form full text may match as a prefix, or None to match the lexeme exactly: a lexeme
    with a digit or a hyphen, or whose form is shorter than five letters."""
    form = word_form(lexeme)
    return form if lexeme.isalpha() and len(form) >= MIN_PREFIX else None


def _strip(word: str, endings: tuple[str, ...]) -> str:
    for ending in endings:
        if word.endswith(ending) and len(word) - len(ending) >= MIN_STEM:
            if ending == PLURAL and word.endswith(NOT_PLURAL):
                return word
            return word[: -len(ending)]
    return word
