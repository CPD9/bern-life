"""`python -m bernlife extract`: data/bundle/pages.jsonl in, profiles.jsonl and relations.jsonl out.

The model is reached only through `llm.connect`, so BERNLIFE_BACKEND picks live, replay or the
labelled MOCK. MOCK runs selectors only, because a mock reply is not page evidence. A live run
needs the 70B (the served id says so), since extraction is about people. Before anything is
written, every span is checked against its page again and every profile against the contract.
`--list-kinds` prints the pages whose kind the source files would change now and calls nothing.
`--only-missing-topics` reads person pages whose profile has no expertise claim once more, with
the topics prompt (`extract_topics.py`); `--list-topics` prints those pages, answering the
profile pass from the cache alone, and calls nothing.
"""

import argparse
import json
import os
import sys
from collections.abc import Callable, Iterable, Iterator, Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from pathlib import Path

from jsonschema import Draft202012Validator

from bernlife import config, extract_topics, page_kinds, paths
from bernlife.cache import CacheMiss, Message, cache_key, lookup
from bernlife.extract import Extraction, ModelPass, SelectPages, TopicsPass, extract
from bernlife.extract_model import PROFILE_PROMPT, TOPICS_PROMPT, ModelOutcome, Prompt, model_pass
from bernlife.extract_prompt import (
    ASKED,
    EXTRACT_PROMPT_VERSION,
    MAX_TOKENS,
    TOPICS_PROMPT_VERSION,
)
from bernlife.extract_records import OPPORTUNITY_KINDS, PEOPLE_KINDS, Page
from bernlife.extract_report import summary
from bernlife.jsonl import read_jsonl, write_jsonl
from bernlife.llm import MockLLM, Router, connect
from bernlife.llm_http import ModelUnavailable, Transport, urlopen_transport
from bernlife.sources import Source, load_sources
from bernlife.verify import recheck

MapRound = Callable[[Callable[[Page], ModelOutcome], Iterable[Page]], Iterator[ModelOutcome]]

MODEL_KINDS = (
    "person",
    "unit",
    "project",
    "infrastructure",
    "call",
    "service",
    "space",
    "listing",
    "other",
)


def main(
    argv: Sequence[str],
    env: Mapping[str, str] = os.environ,
    transport: Transport = urlopen_transport,
) -> int:
    args = _arguments(argv)
    bundle = paths.data_dir(env) / "bundle"
    records = read_jsonl(bundle / "pages.jsonl")
    if not records:
        print(f"extract: no pages in {bundle / 'pages.jsonl'}; crawl first", file=sys.stderr)
        return 2
    pages = [Page.from_record(record) for record in records]
    unknown = sorted(set(args.source) - {page.source_id for page in pages})
    if unknown:
        print(f"extract: no pages of source {', '.join(unknown)}", file=sys.stderr)
        return 2
    chosen = [page for page in pages if not args.source or page.source_id in args.source]
    sources = load_sources()
    opportunities = opportunity_sources(sources)
    if args.list_kinds:
        sites = {site.host: site for source in sources for site in source.sites}
        print(page_kinds.report(page_kinds.kind_changes(chosen, sites)))
        return 0
    try:
        llm = connect(env, transport)
    except (ModelUnavailable, CacheMiss, config.ConfigError) as error:
        print(f"extract: {error}", file=sys.stderr)
        return 1
    if isinstance(llm, Router) and llm.backend == "live" and "70b" not in _model(llm).lower():
        print(f"extract: needs the 70B, the endpoint serves {_model(llm)}", file=sys.stderr)
        return 2
    eligible = sorted((p for p in chosen if p.kind in args.kinds), key=lambda p: (p.sha256, p.url))
    model_pages = eligible[: args.limit] if args.limit is not None else eligible
    select = partial(extract_topics.missing_topics, chosen, opportunity_sources=opportunities)
    if args.list_topics:
        print(extract_topics.report(_from_cache(llm, chosen, model_pages, opportunities, select)))
        return 0
    with ThreadPoolExecutor(config.max_concurrency(env)) as pool:
        if isinstance(llm, Router):
            model = _pass(llm, EXTRACT_PROMPT_VERSION)
            topics: TopicsPass | None = None
            if args.only_missing_topics:
                topics = (select, _pass(llm, TOPICS_PROMPT_VERSION, TOPICS_PROMPT))
            map_pages = partial(map_twins_last, pool.map)
            result = extract(chosen, model_pages, model, map_pages, opportunities, topics)
            label = f"{llm.backend} {_model(llm)}"
        else:
            result = extract(chosen, opportunity_sources=opportunities)
            label = "MOCK, selectors only"
    by_url = {page.url: page for page in pages}
    problems = _problems(result, by_url)
    if problems:
        print("extract: refusing to write:\n" + "\n".join(problems[:20]), file=sys.stderr)
        return 1
    _write(bundle, result, {page.source_id for page in chosen})
    print(summary(result, by_url, label))
    return 0


def map_twins_last(
    map_round: MapRound, call: Callable[[Page], ModelOutcome], pages: Iterable[Page]
) -> Iterator[ModelOutcome]:
    """A page whose text an earlier page already has (a URL stored with and without its trailing
    slash) goes in a second round, after the first has been answered, so the cache answers the
    twin instead of a second live call."""
    seen: set[str] = set()
    first: list[Page] = []
    later: list[Page] = []
    for page in pages:
        (later if page.sha256 in seen else first).append(page)
        seen.add(page.sha256)
    yield from map_round(call, first)
    yield from map_round(call, later)


def _from_cache(
    llm: Router | MockLLM,
    pages: Sequence[Page],
    model_pages: Sequence[Page],
    opportunities: frozenset[str],
    select: SelectPages,
) -> Sequence[Page]:
    """The pages the topics pass would read, with the profile pass answered from the cache alone
    (a page not in it counts as unread); with no cache, from the selectors alone."""
    if not isinstance(llm, Router):
        return select(extract(pages, opportunity_sources=opportunities).profiles)
    replay = Router(None, llm.models(), llm.roots)
    model = _pass(replay, EXTRACT_PROMPT_VERSION)
    return select(extract(pages, model_pages, model, opportunity_sources=opportunities).profiles)


def opportunity_sources(sources: Sequence[Source] | None = None) -> frozenset[str]:
    """Sources whose page types name only opportunities and listings, such as a funder or a
    coworking site: their pages yield calls, services and spaces, never people or units."""
    found = set()
    for source in load_sources() if sources is None else sources:
        kinds = {page_type.kind for site in source.sites for page_type in site.page_types}
        if kinds & set(OPPORTUNITY_KINDS) and not kinds & set(PEOPLE_KINDS):
            found.add(source.id)
    return frozenset(found)


def _arguments(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="python -m bernlife extract")
    parser.add_argument("--source", action="append", default=[], metavar="ID")
    parser.add_argument("--limit", type=int, metavar="N", help="model pass on N pages only")
    parser.add_argument(
        "--kinds",
        type=lambda text: tuple(text.split(",")),
        default=MODEL_KINDS,
        help=f"page kinds the model reads (default {','.join(MODEL_KINDS)})",
    )
    parser.add_argument(
        "--list-kinds",
        action="store_true",
        help="print the pages whose kind the source files would change now; calls nothing",
    )
    parser.add_argument(
        "--only-missing-topics",
        action="store_true",
        help="read person pages whose profile has no expertise claim once more, for topics",
    )
    parser.add_argument(
        "--list-topics",
        action="store_true",
        help="print the pages --only-missing-topics would read; calls nothing",
    )
    args = parser.parse_args(argv)
    unknown = sorted(set(args.kinds) - set(ASKED))
    if unknown:
        parser.error(f"--kinds: {', '.join(unknown)} is not one of {', '.join(ASKED)}")
    return args


def _model(llm: Router) -> str:
    return llm.models()["extract"]


def _pass(llm: Router, version: str, prompt: Prompt = PROFILE_PROMPT) -> ModelPass:
    """The prompt version is part of every cache key, so the two passes over one page never
    answer each other."""
    return partial(
        model_pass,
        ask=partial(_ask, llm, version),
        is_cached=partial(_cached, llm, version),
        prompt=prompt,
    )


def _ask(llm: Router, version: str, messages: list[Message]) -> str:
    return llm.chat(
        messages,
        role="extract",
        prompt_version=version,
        temperature=0.0,
        max_tokens=MAX_TOKENS,
    )


def _cached(llm: Router, version: str, messages: list[Message]) -> bool:
    key = cache_key(_model(llm), messages, 0.0, None, MAX_TOKENS, version)
    return lookup(llm.roots, key) is not None


def _problems(result: Extraction, pages: Mapping[str, Page]) -> list[str]:
    schema = json.loads(paths.contract("profile.schema.json").read_text())
    validator = Draft202012Validator(schema)
    problems = recheck(result.profiles, result.relations, pages)
    for profile in result.profiles:
        problems += [
            f"{profile['id']}: {error.message}" for error in validator.iter_errors(profile)
        ]
    return problems


def _write(bundle: Path, result: Extraction, source_ids: set[str]) -> None:
    """Replace the chosen sources' profiles and relations; keep the others'."""
    kept = [p for p in read_jsonl(bundle / "profiles.jsonl") if p["source_id"] not in source_ids]
    profiles = sorted([*kept, *result.profiles], key=lambda profile: str(profile["id"]))
    kept_ids = {profile["id"] for profile in kept}
    old_relations = read_jsonl(bundle / "relations.jsonl")
    relations = [r for r in old_relations if r["from_profile_id"] in kept_ids]
    relations = sorted([*relations, *result.relations], key=_relation_order)
    write_jsonl(bundle / "profiles.jsonl", profiles)
    write_jsonl(bundle / "relations.jsonl", relations)


def _relation_order(row: dict[str, object]) -> tuple[str, str, str]:
    return str(row["from_profile_id"]), str(row["to_profile_id"]), str(row["kind"])
