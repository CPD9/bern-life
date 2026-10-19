"""Light word forms, so "Kohlenhydrate" meets "Kohlenhydraten" and "sensor" meets "sensors".

The pages and questions mix German, French and English, and a word's language is not known, so
one short list of inflection endings serves all three: German case and plural endings (-e, -en,
-er, -es, -em, -ern) and the plural -s, which may sit on one of them ("cancers", "Musters"). At
least four letters stay, so "liver" never meets "live". A double "ss" or a final "us" is no plural
("process", "virus"). No derivation: "Genetik" does not meet "genetics", and "Schätzung" does not
meet "schätzt". Both sides of a comparison go through the same function, so a form is only a key
for matching; nothing shown is ever a form. The claim rule compares forms (matching.py), and full
text matches a query word through the words of its own form (`same_form`).
"""

ENDINGS = ("ern", "en", "er", "es", "em", "e", "s")  # longest first
PLURAL = "s"
NOT_PLURAL = ("ss", "us")
MIN_STEM = 4


def word_form(word: str) -> str:
    """The word without its inflection ending, e.g. kohlenhydraten → kohlenhydrat, and without a
    plural -s and the ending under it, e.g. cancers → canc (as cancer → canc)."""
    stem = _strip(word, ENDINGS)
    if stem == word[: -len(PLURAL)] and word.endswith(PLURAL):
        stem = _strip(stem, ENDINGS[:-1])
    return stem


def same_form(word: str) -> list[str]:
    """Every word `word_form` maps to the form of `word`, the word itself included: "species"
    gives "speci", "specie" and "species", never "special". A word with a digit or a hyphen
    gives only itself."""
    if not word.isalpha():
        return [word]
    form = word_form(word)
    candidates = {form, *(form + e for e in ENDINGS), *(form + e + PLURAL for e in ENDINGS[:-1])}
    return sorted(c for c in candidates if word_form(c) == form)


def _strip(word: str, endings: tuple[str, ...]) -> str:
    for ending in endings:
        if word.endswith(ending) and len(word) - len(ending) >= MIN_STEM:
            if ending == PLURAL and word.endswith(NOT_PLURAL):
                return word
            return word[: -len(ending)]
    return word
