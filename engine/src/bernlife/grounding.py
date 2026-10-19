"""Which people a reply names, and whether each is a profile among the results it rests on.

A model's reply is checked in code, never by a model. People are found with the rules extraction
uses for names (names.py): a run of capitalised words that looks like a person's name (two to six
words, no digits, no organisation word), and a name after a title ("Prof. Muster",
abstain.named_people). A run is grounded where it holds a result's name word for word (any kind:
a project name can look like a person's); the rest of the run must not look like a person, unless
it is a claim value of a result written with capitals ("Senior Scientist"). A titled name must be
part of a result person's name. Mentions are the result people the reply names, in result order.

Leading function words and titles are dropped from a run first, because a sentence's first word
is capitalised whatever it is ("In Bern" is no person). A surname alone, without a title, is not
found. English only: German capitalises every noun.
"""

import re
from collections.abc import Iterator, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from bernlife.abstain import POSSESSIVE, named_people
from bernlife.names import PARTICLES, TITLES, display_name, fold, looks_like_person

SEGMENT = re.compile(r"[\w\s'’-]+")
OPENERS = frozenset(
    {"a", "an", "the", "in", "at", "on", "of", "for", "from", "with", "by", "to", "as", "and"}
    | {"or", "but", "both", "also", "her", "his", "their", "she", "he", "they", "we", "i", "you"}
    | {"it", "its", "this", "that", "these", "those", "our", "my", "your", "yes", "no", "here"}
    | {"there", "each", "all", "some", "if", "so", "then", "when", "where", "who", "which"}
)

Response = Mapping[str, Any]


@dataclass(frozen=True)
class Named:
    profile_id: str
    name: str
    person: bool


@dataclass(frozen=True)
class Grounding:
    mentions: tuple[tuple[str, str], ...]
    unknown: tuple[str, ...]

    @property
    def holds(self) -> bool:
        return not self.unknown


def shown_names(responses: Sequence[Response]) -> list[Named]:
    """Every profile the results show, with the project a result is shown through."""
    named: dict[str, Named] = {}
    for response in responses:
        for item in response["results"]:
            profile = item["profile"]
            found = Named(profile["id"], profile["name"]["value"], profile["kind"] == "person")
            named.setdefault(found.profile_id, found)
            via = item.get("via")
            if via is not None:
                pid = via["related_profile_id"]
                named.setdefault(pid, Named(pid, via["related_name"], pid.startswith("person-")))
    return list(named.values())


def claim_values(responses: Sequence[Response]) -> str:
    """The results' claim values, folded, as one text a phrase can be looked up in."""
    values = []
    for response in responses:
        for item in response["results"]:
            claims = [c for field in item["profile"]["fields"].values() for c in field]
            claims += item.get("via", {}).get("related_claims", [])
            values += [fold(claim["value"]) for claim in claims]
    return f" {' | '.join(values)} "


def ground(reply: str, responses: Sequence[Response]) -> Grounding:
    named = shown_names(responses)
    values = claim_values(responses)
    found: set[str] = set()
    unknown: list[str] = []
    for run in name_runs(reply):
        ids, rest = known_in(run, named)
        found |= ids
        unknown += [" ".join(piece) for piece in rest if _unknown_person(piece, values)]
    people = [n for n in named if n.person]
    for titled in named_people(reply):
        ids = {n.profile_id for n in people if set(titled) <= set(_tokens(n.name))}
        found |= ids
        if not ids:
            unknown.append(" ".join(titled))
    mentions = tuple((n.profile_id, n.name) for n in people if n.profile_id in found)
    return Grounding(mentions, tuple(dict.fromkeys(unknown)))


def name_runs(text: str) -> Iterator[list[str]]:
    """Runs of capitalised words (particles inside), within punctuation; a possessive ends one."""
    for segment in SEGMENT.findall(text):
        run: list[str] = []
        for raw in [*segment.split(), ""]:
            word = POSSESSIVE.sub("", raw)
            capitalised = word[:1].isupper() or (bool(run) and fold(word) in PARTICLES)
            if capitalised:
                run.append(word)
            if run and (not capitalised or word != raw):
                if trimmed := _trimmed(run):
                    yield trimmed
                run = []


def known_in(run: list[str], named: Sequence[Named]) -> tuple[set[str], list[list[str]]]:
    """The ids whose name the run holds word for word, longest names first, and the pieces of
    the run left between them."""
    words = [tuple(fold(word).split()) for word in run]
    ids_by_name: dict[tuple[str, ...], list[str]] = {}
    for item in named:
        ids_by_name.setdefault(tuple(_tokens(item.name)), []).append(item.profile_id)
    covered: set[int] = set()
    ids: set[str] = set()
    for name in sorted(ids_by_name, key=len, reverse=True):
        for start, end in _spans(words, name):
            if not covered & set(range(start, end)):
                covered |= set(range(start, end))
                ids.update(ids_by_name[name])
    pieces: list[list[str]] = [[]]
    for position, word in enumerate(run):
        if position in covered:
            pieces.append([])
        else:
            pieces[-1].append(word)
    return ids, [trimmed for piece in pieces if (trimmed := _trimmed(piece))]


def _spans(words: Sequence[tuple[str, ...]], name: tuple[str, ...]) -> Iterator[tuple[int, int]]:
    """Where whole words of the run spell the name."""
    for start in range(len(words)):
        spelled: tuple[str, ...] = ()
        for end in range(start, len(words)):
            spelled += words[end]
            if spelled == name:
                yield start, end + 1
            if len(spelled) >= len(name):
                break


def _unknown_person(piece: list[str], values: str) -> bool:
    return looks_like_person(" ".join(piece)) and f" {fold(' '.join(piece))} " not in values


def _trimmed(run: list[str]) -> list[str]:
    start, end = 0, len(run)
    while start < end and fold(run[start]) in OPENERS | TITLES | PARTICLES:
        start += 1
    while end > start and fold(run[end - 1]) in TITLES | PARTICLES:
        end -= 1
    return run[start:end]


def _tokens(name: str) -> list[str]:
    return fold(display_name(name)).split()
