"""Keys for matching results to the gold set, worded as eval/PREREGISTRATION.md words them.

Spans compare after whitespace normalisation and nothing else. Names also fold case and accents
and drop academic titles. URLs compare on host and path, ignoring scheme and a trailing slash.
"""

import re
import unicodedata
from collections.abc import Iterator
from typing import Any
from urllib.parse import urlsplit

from .load import Target

Record = dict[str, Any]

WHITESPACE = re.compile(r"\s+")
NAME_SEPARATORS = re.compile(r"[\s.,]+")
TITLES = frozenset(
    {"prof", "dr", "pd", "med", "phil", "rer", "nat", "habil", "vet", "sc", "techn", "dipl", "ing"}
    | {"phd", "msc", "dent"}
)
# GOLD-NOTES.md: the DCB insulin project page and team page spell this name differently.
SPELLINGS = {"danai kokana": "danai kokona"}


def normalise_whitespace(text: str) -> str:
    """Non-breaking, narrow and every other Unicode space become one plain space."""
    return WHITESPACE.sub(" ", text).strip()


def url_key(url: str) -> str:
    parts = urlsplit(url.strip())
    return f"{parts.hostname or ''}{parts.path.rstrip('/')}"


def name_key(name: str) -> str:
    folded = unicodedata.normalize("NFKD", normalise_whitespace(name).casefold())
    plain = "".join(char for char in folded if not unicodedata.combining(char))
    words = [word for word in NAME_SEPARATORS.split(plain) if word and word not in TITLES]
    key = " ".join(words)
    return SPELLINGS.get(key, key)


def claims(profile: Record) -> Iterator[tuple[str, Record]]:
    """Every claim of a profile with its JSON pointer, as `reason.cites` names them."""
    yield "/name", profile["name"]
    for field in sorted(profile["fields"]):
        for index, claim in enumerate(profile["fields"][field]):
            yield f"/fields/{field}/{index}", claim


def match(target: Target, profile: Record) -> str | None:
    """How a profile matches a gold target: "name", "url", or None. Only a profile of the
    target's kind can match, so a person's unit field never counts as a unit hit."""
    if profile["kind"] != target.kind:
        return None
    if name_key(profile["name"]["value"]) == name_key(target.name):
        return "name"
    urls = {url_key(profile["source_url"])}
    urls |= {url_key(claim["evidence"]["page_url"]) for _, claim in claims(profile)}
    return "url" if url_key(target.proof_url) in urls else None
