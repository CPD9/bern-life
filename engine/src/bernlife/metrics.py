"""Display-only metrics per result: how much of the question it covers, how directly its pages
back that, how complete it is, and what it adds to the results above it.

Everything here is computed from the query's topics, what the result shows and the stored pages:
never from a model's opinion, page counts, popularity or unit size. A result shows its own
verified claims (with the enrichment terms of their values), the claims of the project it is
shown through (`via`) and the passage on its own page (`passage`). A topic is covered when one of
these holds every content word of one of the topic's wordings, in any word form: the comparison
the claim rule makes (matching.py), so the metrics agree with why a result is shown. The metrics
describe results and never reorder them. A value that cannot be computed is None (shown as a
dash), and an abstained response gets no metrics at all. Confidence stays None until the
practice-set labels exist; docs/metrics.md says how it will be calibrated.
"""

import re
from collections.abc import Callable, Iterator, Mapping, Sequence
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from bernlife.matching import forms
from bernlife.names import fold

PASSAGE_CHARS = 300
SAME_PASSAGE, SAME_PAGE, OTHER_PAGE = 1.0, 0.5, 0.25
SOURCE_FIELDS = (
    ("role",),
    ("unit",),
    ("expertise",),
    ("projects",),
    ("infrastructure", "services"),
)
# Question and function words in en/de/fr: they frame a question but are not what is asked about.
FRAMING_WORDS = (
    "a about all an and any anyone are at be bern by can do does for from has have how in is "
    "it of on or people researcher researchers someone that the their there this to what where "
    "which who whom whose with work works working research researches study studies expert "
    "experts aber alle auch auf aus bei das dem den der des die ein eine einen einer forscht "
    "forschen forschung gibt im in ist jemand mit nach oder sich sind und uber von was welche "
    "welcher wer wie wo zu zum zur au aux avec dans de des du en est et il la le les ou par "
    "pour qui quoi quelle quelles quel quels recherche sur travaille un une"
)
FRAMING = frozenset(FRAMING_WORDS.split())
TOKEN = re.compile(r"\w+")

Record = dict[str, Any]
PageLookup = Callable[[str], Mapping[str, Any] | None]
Enrichment = Mapping[str, Sequence[str]]


@dataclass(frozen=True)
class Topic:
    label: str
    wordings: tuple[str, ...]


@dataclass(frozen=True)
class Statement:
    """One thing a result shows and where its page says it: a claim of its own, a claim of the
    project it is shown through, or the passage on its own page. `forms` are the content word
    forms of the span, the value and the value's enrichment terms."""

    page_url: str
    span: str
    start: int | None
    forms: frozenset[str]


Support = list[tuple[Statement, frozenset[str]]]


def query_topics(query: str, expansions: Mapping[str, Sequence[str]] | None = None) -> list[Topic]:
    """The user's own words as topics, each with its expansion terms once E3b provides them. A
    label that is not words of the query is dropped: a model may add wordings, never topics."""
    if expansions is not None:
        asked = f" {fold(query)} "
        return [
            Topic(label, (label, *terms))
            for label, terms in expansions.items()
            if fold(label) and f" {fold(label)} " in asked
        ]
    seen: dict[str, str] = {}
    for word in re.findall(r"\w+", query):
        key = fold(word)
        if len(key) >= 3 and key not in FRAMING and not key.isdigit():
            seen.setdefault(key, word)
    return [Topic(word, (word,)) for word in seen.values()]


@lru_cache(maxsize=4096)
def wording_forms(topic: Topic) -> tuple[frozenset[str], ...]:
    """The content word forms of each wording; a wording with none ("AI") cannot count."""
    found = (frozenset(forms(wording)) for wording in topic.wordings)
    return tuple(words for words in found if words)


def claims(profile: Record) -> Iterator[Record]:
    yield profile["name"]
    for values in profile["fields"].values():
        yield from values


def statement(evidence: Mapping[str, Any], *texts: str) -> Statement:
    words = frozenset().union(forms(evidence["span"]), *(forms(text) for text in texts))
    return Statement(evidence["page_url"], evidence["span"], evidence.get("start"), words)


def statements(item: Record, enrichment: Enrichment) -> list[Statement]:
    """What the result shows: its own claims, then the project's, then the passage."""
    own = claims(item["profile"])
    related = item["via"]["related_claims"] if "via" in item else []
    shown = [
        statement(c["evidence"], c["value"], *enrichment.get(c["value"], ()))
        for c in (*own, *related)
    ]
    if "passage" in item:
        shown.append(statement(item["passage"]))
    return shown


def coverage(shown: Sequence[Statement], topics: Sequence[Topic]) -> dict[Topic, Support]:
    """Per covered topic, each statement holding all the words of one of its wordings, with that
    wording's forms."""
    found: dict[Topic, Support] = {}
    for topic in topics:
        wordings = wording_forms(topic)
        for item in shown:
            wording = next((w for w in wordings if w <= item.forms), None)
            if wording is not None:
                found.setdefault(topic, []).append((item, wording))
    return found


def occurrences(needle: str, text: str) -> list[tuple[int, int]]:
    pattern = re.compile(rf"(?<!\w){re.escape(needle)}(?!\w)", re.IGNORECASE)
    return [match.span() for match in pattern.finditer(text)]


def topic_range(item: Statement, wording: frozenset[str], start: int) -> tuple[int, int]:
    """Where the topic sits on the page: from the first to the last word of the span that is a
    word of the wording, else the whole span (the wording is in the claim's enrichment terms)."""
    hits = [m.span() for m in TOKEN.finditer(item.span) if forms(m.group()) & wording]
    if not hits:
        return start, start + len(item.span)
    return start + hits[0][0], start + hits[-1][1]


def gap(a: tuple[int, int], b: tuple[int, int]) -> int:
    return max(0, b[0] - a[1], a[0] - b[1])


def strength(name: str, support: Support, page: PageLookup) -> float | None:
    """The best support for one covered topic: name and topic in one passage, on one page, or the
    topic only on a page that does not name the result."""
    best = None
    for item, wording in support:
        record = page(item.page_url)
        if record is None:
            continue
        text = record["text"]
        start = item.start if item.start is not None else text.find(item.span)
        if start < 0:
            continue
        where = topic_range(item, wording, start)
        names = occurrences(name, text)
        if not names:
            score = OTHER_PAGE
        elif min(gap(where, found) for found in names) <= PASSAGE_CHARS:
            score = SAME_PASSAGE
        else:
            score = SAME_PAGE
        best = score if best is None else max(best, score)
    return best


def unit_of(profile: Record, page: PageLookup) -> str:
    record = page(profile["source_url"])
    return record["unit"] if record else profile["source_id"]


def completeness(profile: Record) -> dict[str, int]:
    fields = profile["fields"]
    filled = sum(any(fields[name] for name in group) for group in SOURCE_FIELDS)
    return {"filled": filled, "of": len(SOURCE_FIELDS)}


def result_metrics(
    item: Record,
    topics: Sequence[Topic],
    page: PageLookup,
    enrichment: Enrichment,
    seen_units: set[str],
    seen: set[str],
) -> Record:
    profile = item["profile"]
    support = coverage(statements(item, enrichment), topics)
    covers = [t for t in topics if t in support]
    name = profile["name"]["value"]
    strengths = [s for s in (strength(name, support[t], page) for t in covers) if s is not None]
    unit = unit_of(profile, page)
    return {
        "relevance": round(len(covers) / len(topics), 4) if topics else None,
        "covers": [t.label for t in covers],
        "missing": [t.label for t in topics if t not in support],
        "evidence": round(sum(strengths) / len(strengths), 4) if strengths else None,
        "completeness": completeness(profile),
        "novelty": {
            "new_unit": unit not in seen_units,
            "adds": [t.label for t in covers if t.label not in seen],
        },
        "confidence": None,
    }


def with_metrics(
    response: Record,
    topics: Sequence[Topic],
    page: PageLookup,
    enrichment: Enrichment | None = None,
) -> Record:
    """The response with `metrics` on each result, in the order given; abstained ones unchanged.
    `enrichment` maps a claim value to its retrieval terms, which count for coverage."""
    if response["abstained"] or not response["results"]:
        return response
    given = response["results"]
    terms = enrichment or {}
    seen_units: set[str] = set()
    seen: set[str] = set()
    by_position: dict[int, Record] = {}
    for position in sorted(range(len(given)), key=lambda i: given[i]["rank"]):
        item = given[position]
        by_position[position] = result_metrics(item, topics, page, terms, seen_units, seen)
        seen_units.add(unit_of(item["profile"], page))
        seen.update(by_position[position]["covers"])
    return response | {"results": [r | {"metrics": by_position[i]} for i, r in enumerate(given)]}
