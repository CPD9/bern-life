"""Remove e-mail addresses and phone numbers from page text and model output before storage.

The project stores no contact details: the source page link is the way to reach a person. The
replacement is a fixed token, so the text stays deterministic and evidence spans around it still
match. A phone number is an international prefix (+41, 0041) with its digits, or a ten-digit
Swiss national number (031 ...); years, postcodes and figures in research text never have that
shape, so they are left alone.
"""

import re
from typing import Any

EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
# A leading + is a strong sign, so that form may follow a letter, use hyphens and have a one- to
# three-digit country code. The 00 and national forms are grouped by spaces only and may not touch
# a word, so a DOI, an ORCID or a date range (10.1055/s-0034-..., 06/2014-12/2016) is left alone.
PLUS = r"(?<![\d+])\+ ?\d{1,3}[ -]?(?:\(0\)[ -]?)?(?:\d[ -]?){7,10}\d"
DIAL_00 = r"(?<![\w+])00\d{2} ?(?:\(0\) ?)?(?:\d ?){8,10}\d"
NATIONAL = r"(?<![\w+])0\d(?: ?\d){8}"
PHONE = re.compile(rf"(?<!\d[ ./-])(?:{PLUS}|{DIAL_00}|{NATIONAL})(?![ ./-]?\d)")


def redact(text: str) -> str:
    return PHONE.sub("[phone]", EMAIL.sub("[email]", text))


def redact_strings(value: Any) -> Any:
    """Every string in a JSON value redacted; keys and other values as they are."""
    if isinstance(value, str):
        return redact(value)
    if isinstance(value, list):
        return [redact_strings(item) for item in value]
    if isinstance(value, dict):
        return {key: redact_strings(item) for key, item in value.items()}
    return value
