"""The wording a question goes to the model with, so its recorded answer is found again.

The cache keys every model call by the exact request and keeps replies, not requests: a question
typed with other capitals or an extra space than when it was recorded misses its recording, and
replay answers plain. The wordings that were recorded are the repository's query files, listed
here in one place so a new file joins the index in one line: the gold and dev sets, the
consistency set and the demo queries (some of them briefs). `Recorded` indexes them by normal
form once per process, and a question whose normal form is recorded goes to the model in the
recorded wording when the call cannot go live. Only the prompts change: results and the echoed
query keep the user's words. Whitespace is cleaned on every question, since every recorded string
is clean; casefolding goes only through the index, because a casefolded prompt would miss every
recording.
"""

import json
import unicodedata
from collections.abc import Iterable, Iterator
from functools import cache
from pathlib import Path

from bernlife.llm_gate import may_go_live
from bernlife.paths import repo_root

RECORDED_FILES = (
    "eval/gold.jsonl",
    "eval/dev.jsonl",
    "eval/dev2.jsonl",
    "eval/consistency.jsonl",
    "infra/demo/queries.jsonl",
)
QUERY_FIELDS = ("query", "queries")


def clean(question: str) -> str:
    """The question with its whitespace stripped and collapsed."""
    return " ".join(question.split())


def normal_form(question: str) -> str:
    return unicodedata.normalize("NFC", clean(question)).casefold()


class Recorded:
    """Recorded wordings by normal form; the first of two with the same form wins."""

    def __init__(self, wordings: Iterable[str]) -> None:
        self._by_form: dict[str, str] = {}
        for wording in wordings:
            self._by_form.setdefault(normal_form(wording), wording)

    def match(self, question: str) -> str | None:
        return self._by_form.get(normal_form(question))


def wordings(path: Path) -> Iterator[str]:
    """The query texts of one file; a file not in the checkout holds none."""
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return
    for line in lines:
        if not line.strip():
            continue
        record = json.loads(line)
        for field in QUERY_FIELDS:
            value = record.get(field)
            texts = value if isinstance(value, list) else [value]
            yield from (text for text in texts if isinstance(text, str))


@cache
def from_repository() -> Recorded:
    root = repo_root()
    return Recorded(text for name in RECORDED_FILES for text in wordings(root / name))


def recorded_wording(text: str, backend: str, recorded: Recorded) -> str | None:
    """The recorded wording of a text, when the call cannot go live and one is recorded."""
    # The server runs every request in a scope, so `serving` only judges a command's call.
    if backend == "live" and may_go_live(serving=False):
        return None
    return recorded.match(text)


def for_model(question: str, backend: str, recorded: Recorded) -> str:
    """The question as the prompts carry it: its recorded wording, else cleaned."""
    return recorded_wording(question, backend, recorded) or clean(question)
