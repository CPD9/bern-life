"""Finding a proposed span in the page text, and the only two ways a span may be adjusted.

Whatever is stored is cut from the page text itself, never taken from the model, so every stored
span stays a verbatim substring. A span that differs from the page only in case is replaced by the
page's own text, and only when that match is unique on the page. A team list puts a person's role on
a line of its own below the name, so a role span that does not name the person is widened back to
the start of a line naming them, at most two lines above. A DCB `Project team:` line puts it in
parentheses after the name, so there it is widened back to the start of that name, as long as no
other person's name stands in between. Either way the stored span still names the person.
"""

import re
from collections.abc import Iterator
from dataclasses import dataclass

from bernlife.names import display_name, looks_like_person, mentions

LINES_ABOVE = 2
TEAM_LINE = re.compile(r"^(?:project team|projektteam):", re.IGNORECASE)
BETWEEN_PEOPLE = re.compile(r"[,;&()]| and | und ")


@dataclass(frozen=True)
class Located:
    span: str
    start: int


def locate(span: str, text: str) -> Located | None:
    if not span:
        return None
    start = text.find(span)
    if start >= 0:
        return Located(span, start)
    matches = list(re.finditer(re.escape(span), text, re.IGNORECASE))
    if len(matches) == 1:
        return Located(matches[0].group(), matches[0].start())
    return None


def from_name_line(span: str, text: str, name: str, max_chars: int) -> Located | None:
    """The page text from a line naming `name` to the end of the line holding `span`."""
    for start in _occurrences(span, text):
        line_start = text.rfind("\n", 0, start) + 1
        line_end = text.find("\n", start + len(span))
        line_end = len(text) if line_end < 0 else line_end
        above = line_start
        for _ in range(LINES_ABOVE):
            if above == 0:
                break
            previous = text.rfind("\n", 0, above - 1) + 1
            if mentions(text[previous : above - 1], name):
                if line_end - previous <= max_chars:
                    return Located(text[previous:line_end], previous)
                break
            above = previous
    return None


def beside_name(span: str, text: str, name: str, max_chars: int) -> Located | None:
    """On a team line, the page text from `name` to the parenthesis that holds `span`."""
    for start in _occurrences(span, text):
        line_start = text.rfind("\n", 0, start) + 1
        line_end = text.find("\n", start)
        line_end = len(text) if line_end < 0 else line_end
        opening = text.rfind("(", line_start, start)
        closing = text.find(")", start + len(span), line_end)
        if not TEAM_LINE.match(text[line_start:line_end]) or opening < 0 or closing < 0:
            continue
        name_at = text.rfind(name, line_start, opening)
        if name_at < 0 or ")" in text[opening:start]:
            continue
        between = BETWEEN_PEOPLE.split(text[name_at + len(name) : opening])
        if any(looks_like_person(display_name(part.strip())) for part in between):
            continue
        if closing + 1 - name_at <= max_chars:
            return Located(text[name_at : closing + 1], name_at)
    return None


def _occurrences(span: str, text: str) -> Iterator[int]:
    start = text.find(span)
    while start >= 0:
        yield start
        start = text.find(span, start + 1)
