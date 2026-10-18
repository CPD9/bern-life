"""Display-only metrics per result: how much of the question it covers, how directly its pages
back that, how complete it is, and what it adds to the results above it.

Everything here is computed from the query's topics, the result's verified claims and the stored
pages: never from a model's opinion, page counts, popularity or unit size. The metrics describe
results and never reorder them. A value that cannot be computed is None (shown as a dash), and an
abstained response gets no metrics at all. Confidence stays None until the practice-set labels
exist; docs/metrics.md says how it will be calibrated.
"""

import re
from collections.abc import Callable, Iterator, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

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

Record = dict[str, Any]
PageLookup = Callable[[str], Mapping[str, Any] | None]


@dataclass(frozen=True)
class Topic:
    label: str
    wordings: tuple[str, ...]


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


def claims(profile: Record) -> Iterator[Record]:
    yield profile["name"]
    for values in profile["fields"].values():
        yield from values


def mentions(span: str, topic: Topic) -> bool:
    padded = f" {fold(span)} "
    return any(fold(wording) and f" {fold(wording)} " in padded for wording in topic.wordings)


def occurrences(needle: str, text: str) -> list[tuple[int, int]]:
    pattern = re.compile(rf"(?<!\w){re.escape(needle)}(?!\w)", re.IGNORECASE)
    return [match.span() for match in pattern.finditer(text)]


def topic_range(topic: Topic, span: str, start: int) -> tuple[int, int]:
    """Where the topic sits on the page: its wording inside the span, else the whole span."""
    for wording in topic.wordings:
        found = occurrences(wording, span)
        if found:
            return start + found[0][0], start + found[0][1]
    return start, start + len(span)


def gap(a: tuple[int, int], b: tuple[int, int]) -> int:
    return max(0, b[0] - a[1], a[0] - b[1])


def strength(topic: Topic, profile: Record, page: PageLookup) -> float | None:
    """The best support for one covered topic: name and topic in one passage, on one page, or the
    topic only on a page that does not name the result."""
    best = None
    for claim in claims(profile):
        evidence = claim["evidence"]
        record = page(evidence["page_url"])
        if record is None or not mentions(evidence["span"], topic):
            continue
        text = record["text"]
        start = evidence["start"] if "start" in evidence else text.find(evidence["span"])
        if start < 0:
            continue
        where = topic_range(topic, evidence["span"], start)
        names = occurrences(profile["name"]["value"], text)
        if not names:
            score = OTHER_PAGE
        elif min(gap(where, name) for name in names) <= PASSAGE_CHARS:
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
    profile: Record, topics: Sequence[Topic], page: PageLookup, seen_units: set[str], seen: set[str]
) -> Record:
    spans = [claim["evidence"]["span"] for claim in claims(profile)]
    covers = [t for t in topics if any(mentions(span, t) for span in spans)]
    strengths = [s for s in (strength(t, profile, page) for t in covers) if s is not None]
    unit = unit_of(profile, page)
    return {
        "relevance": round(len(covers) / len(topics), 4) if topics else None,
        "covers": [t.label for t in covers],
        "missing": [t.label for t in topics if t not in covers],
        "evidence": round(sum(strengths) / len(strengths), 4) if strengths else None,
        "completeness": completeness(profile),
        "novelty": {
            "new_unit": unit not in seen_units,
            "adds": [t.label for t in covers if t.label not in seen],
        },
        "confidence": None,
    }


def with_metrics(response: Record, topics: Sequence[Topic], page: PageLookup) -> Record:
    """The response with `metrics` on each result, in the order given; abstained ones unchanged."""
    if response["abstained"] or not response["results"]:
        return response
    given = response["results"]
    seen_units: set[str] = set()
    seen: set[str] = set()
    by_position: dict[int, Record] = {}
    for position in sorted(range(len(given)), key=lambda i: given[i]["rank"]):
        profile = given[position]["profile"]
        by_position[position] = result_metrics(profile, topics, page, seen_units, seen)
        seen_units.add(unit_of(profile, page))
        seen.update(by_position[position]["covers"])
    return response | {"results": [r | {"metrics": by_position[i]} for i, r in enumerate(given)]}
