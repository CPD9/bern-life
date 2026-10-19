"""`python -m evaluator.dev2_check`: check held-out dev queries against the snapshot and gold.

Each dev query is written from one stored page. Every line must pass every check, in code:
  schema     valid against contracts/gold.schema.json, ids unique, and `expect` fits the variant
             (invented: abstain and nothing expected; otherwise expected entities with a span)
  span       every proof_span is in the stored text of its proof page, after the whitespace
             normalisation of PREREGISTRATION.md "Text matching" and nothing else
  gold_url   no proof page is a gold proof page (host and path, as the evaluator compares them)
  gold_name  no expected person or unit has a gold entity's name (case, accents, titles folded)
  invented   the surname of every name after a title in an invented query is in no stored page
             and no profile name, so the whole name is in none either
  personal   no e-mail address or phone number in the query, a span or the notes
  dev        no proof page or expected name is already in the dev set
`profile` is reported, not required: how many expected entities the snapshot has a profile for,
by the evaluator's own rule (name, or a profile citing the proof page), and the largest number of
profiles one proof page matches. Output names the failing line ids and checks, never gold wording.
"""

import argparse
import json
import re
import sys
import unicodedata
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .load import TARGET_KINDS, LoadError, load_gold, rows, validator
from .match import TITLES, claims, name_key, normalise_whitespace, url_key

Record = dict[str, Any]
CHECKS = ("schema", "span", "gold_url", "gold_name", "invented", "personal", "dev")
TITLE_WORDS = TITLES | {"professor", "professorin", "professeur", "professeure", "pr", "dre"}
TITLE_WORDS |= {"dr.in", "drin"}
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
PHONE = re.compile(r"(?<!\w)\+?\d[\d ()/.-]{7,}\d(?!\w)")


def fold(text: str) -> str:
    """Whitespace, case and accents folded, for looking a name up in page text."""
    decomposed = unicodedata.normalize("NFKD", normalise_whitespace(text).casefold())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def targets(row: Record) -> list[tuple[str, Record]]:
    expect = row.get("expect", {})
    return [(kind, target) for kind, key in TARGET_KINDS for target in expect.get(key, [])]


def titled_names(query: str) -> list[str]:
    """Names that follow an academic title: "la Dre Zoé Muster dirige" gives "Zoé Muster"."""
    names: list[str] = []
    words: list[str] = []
    after_title = False
    for token in [*query.split(), ""]:
        word = token.strip("?!,;:()«»\"'“”")
        if word.casefold().rstrip(".") in TITLE_WORDS:
            after_title = True
        elif after_title and word[:1].isupper() and len(words) < 4:
            words.append(word)
            continue
        else:
            after_title = False
        if words:
            names.append(" ".join(words))
            words = []
    return names


def personal(text: str) -> bool:
    if EMAIL.search(text):
        return True
    return any(sum(char.isdigit() for char in hit) >= 9 for hit in PHONE.findall(text))


@dataclass
class Snapshot:
    """Normalised page text by URL, folded page text, and profile names and pages by kind."""

    pages: dict[str, str]
    folded: list[str]
    names: dict[str, dict[str, int]] = field(default_factory=dict)
    urls: dict[str, dict[str, int]] = field(default_factory=dict)
    name_words: set[str] = field(default_factory=set)

    @classmethod
    def load(cls, pages_path: Path, profiles_path: Path) -> "Snapshot":
        pages = {row["url"]: row["text"] for _, row in rows(pages_path)}
        snapshot = cls(
            pages={url: normalise_whitespace(text) for url, text in pages.items()},
            folded=[fold(text) for text in pages.values()],
        )
        names: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        urls: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        for _, profile in rows(profiles_path):
            key = name_key(profile["name"]["value"])
            names[profile["kind"]][key] += 1
            snapshot.name_words |= set(key.split())
            cited = {url_key(profile["source_url"])}
            cited |= {url_key(claim["evidence"]["page_url"]) for _, claim in claims(profile)}
            for url in cited:
                urls[profile["kind"]][url] += 1
        snapshot.names, snapshot.urls = names, urls
        return snapshot

    def mentions(self, name: str) -> bool:
        """Is the surname, and so the whole name, in any page text or any profile name?"""
        surname = fold(name).split()[-1]
        if surname in self.name_words:
            return True
        pattern = re.compile(rf"(?<!\w){re.escape(surname)}(?!\w)")
        return any(pattern.search(text) for text in self.folded)


@dataclass(frozen=True)
class Reference:
    """Proof pages and expected names of a set the new queries must not reuse."""

    urls: frozenset[str]
    names: frozenset[str]

    @classmethod
    def of(cls, path: Path | None) -> "Reference":
        if path is None:
            return cls(frozenset(), frozenset())
        expected = [target for query in load_gold(path) for target in query.targets]
        return cls(
            frozenset(url_key(target.proof_url) for target in expected),
            frozenset(name_key(target.name) for target in expected),
        )


@dataclass
class Report:
    lines: int = 0
    passed: dict[str, int] = field(default_factory=lambda: dict.fromkeys(CHECKS, 0))
    failures: list[tuple[str, dict[str, list[str]]]] = field(default_factory=list)
    kept: list[Record] = field(default_factory=list)
    expected: int = 0
    by_name: int = 0
    by_page: int = 0
    widest_page: int = 0
    invented: list[str] = field(default_factory=list)


def check_line(
    row: Record, seen: set[str], snapshot: Snapshot, gold: Reference, dev: Reference
) -> dict[str, list[str]]:
    """Each check's problems for one line; an empty list is a pass."""
    found: dict[str, list[str]] = {check: [] for check in CHECKS}
    schema = [error.json_path for error in validator("gold.schema.json").iter_errors(row)]
    found["schema"] += schema
    expected = targets(row)
    invented = row.get("variant") == "invented"
    if row.get("id") in seen:
        found["schema"].append("duplicate id")
    if invented and (not row.get("expect", {}).get("abstain") or expected):
        found["schema"].append("invented but expects results")
    if not invented and (row.get("expect", {}).get("abstain") or not expected):
        found["schema"].append("expects no result")
    for kind, target in expected:
        span = target.get("proof_span")
        text = snapshot.pages.get(target.get("proof_url", ""))
        if not span:
            found["span"].append(f"{kind}: no proof_span")
        elif text is None:
            found["span"].append(f"{kind}: proof page not in the snapshot")
        elif normalise_whitespace(span) not in text:
            found["span"].append(f"{kind}: span not on the page")
        url, name = url_key(target.get("proof_url", "")), name_key(target.get("name", ""))
        if url in gold.urls:
            found["gold_url"].append(kind)
        if name in gold.names:
            found["gold_name"].append(kind)
        if url in dev.urls or name in dev.names:
            found["dev"].append(kind)
    if invented:
        for name in titled_names(row.get("query", "")):
            if snapshot.mentions(name):
                found["invented"].append(f"{name} is in the snapshot")
        if row.get("sources") and not titled_names(row.get("query", "")):
            found["invented"].append("no titled name")
    texts = [row.get("query", ""), row.get("notes", "")]
    texts += [target.get("proof_span", "") for _, target in expected]
    if any(personal(text) for text in texts):
        found["personal"].append("e-mail or phone number")
    return found


def check_file(path: Path, snapshot: Snapshot, gold: Reference, dev: Reference) -> Report:
    report, seen = Report(), set()
    for _, row in rows(path):
        report.lines += 1
        found = check_line(row, seen, snapshot, gold, dev)
        seen.add(row.get("id", ""))
        for check in CHECKS:
            report.passed[check] += not found[check]
        if any(found.values()):
            report.failures.append((str(row.get("id")), found))
        else:
            report.kept.append(row)
        if row.get("variant") == "invented":
            report.invented += titled_names(row.get("query", ""))
        for kind, target in targets(row):
            report.expected += 1
            fan_out = snapshot.urls.get(kind, {}).get(url_key(target.get("proof_url", "")), 0)
            if snapshot.names.get(kind, {}).get(name_key(target.get("name", ""))):
                report.by_name += 1
            elif fan_out:
                report.by_page += 1
            report.widest_page = max(report.widest_page, fan_out)
    return report


def describe(path: Path, report: Report) -> str:
    kept = len(report.kept)
    lines = [f"{path.name}: {report.lines} lines, {kept} pass every check"]
    lines.append("  " + "  ".join(f"{c} {report.passed[c]}/{report.lines}" for c in CHECKS))
    missing = report.expected - report.by_name - report.by_page
    lines.append(
        f"  profile: {report.expected} expected entities, {report.by_name} by name, "
        f"{report.by_page} by proof page only, {missing} with none; "
        f"widest proof page matches {report.widest_page} profiles"
    )
    if report.invented:
        lines.append("  titled names in invented queries: " + ", ".join(report.invented))
    for qid, found in report.failures:
        problems = [
            f"{check} ({'; '.join(found[check])})"
            if check not in ("gold_url", "gold_name")
            else check
            for check in CHECKS
            if found[check]
        ]
        lines.append(f"  FAIL {qid}: " + ", ".join(problems))
    return "\n".join(lines)


def run(
    files: Iterable[Path],
    snapshot: Snapshot,
    gold: Reference,
    dev: Reference,
    keep: Path | None = None,
) -> tuple[bool, str]:
    """Check every file; returns whether all lines passed and the printed report."""
    ok, out, kept = True, [], []
    for path in files:
        report = check_file(path, snapshot, gold, dev)
        out.append(describe(path, report))
        ok &= not report.failures
        kept += report.kept
    if keep is not None:
        keep.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in kept))
    return ok, "\n".join(out)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m evaluator.dev2_check")
    parser.add_argument("files", type=Path, nargs="+", help="dev query files (gold schema)")
    parser.add_argument("--pages", type=Path, required=True, help="snapshot pages.jsonl")
    parser.add_argument("--profiles", type=Path, required=True, help="snapshot profiles.jsonl")
    parser.add_argument("--gold", type=Path, default=Path("eval/gold.jsonl"))
    parser.add_argument("--dev", type=Path, help="an earlier dev set the new lines must not reuse")
    parser.add_argument("--keep", type=Path, help="write the lines that pass every check here")
    args = parser.parse_args(argv)
    try:
        snapshot = Snapshot.load(args.pages, args.profiles)
        ok, report = run(
            args.files, snapshot, Reference.of(args.gold), Reference.of(args.dev), args.keep
        )
    except LoadError as error:
        print(error, file=sys.stderr)
        return 2
    print(report)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
