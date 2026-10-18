"""`python -m bernlife extract`: data/bundle/pages.jsonl in, profiles.jsonl and relations.jsonl out.

The model is reached only through `llm.connect`, so BERNLIFE_BACKEND picks live, replay or the
labelled MOCK. MOCK runs selectors only, because a mock reply is not page evidence. A live run
needs the 70B (the served id says so), since extraction is about people. Before anything is
written, every span is checked against its page again and every profile against the contract.
"""

import argparse
import json
import os
import sys
from collections.abc import Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from pathlib import Path

from jsonschema import Draft202012Validator

from bernlife import config, paths
from bernlife.cache import CacheMiss, Message, cache_key, lookup
from bernlife.extract import Extraction, extract
from bernlife.extract_model import model_pass
from bernlife.extract_prompt import ASKED, EXTRACT_PROMPT_VERSION, MAX_TOKENS
from bernlife.extract_records import Page
from bernlife.extract_report import summary
from bernlife.jsonl import read_jsonl, write_jsonl
from bernlife.llm import Router, connect
from bernlife.llm_http import ModelUnavailable, Transport, urlopen_transport
from bernlife.verify import recheck

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
    with ThreadPoolExecutor(config.max_concurrency(env)) as pool:
        if isinstance(llm, Router):
            model = partial(model_pass, ask=partial(_ask, llm), is_cached=partial(_cached, llm))
            result = extract(chosen, model_pages, model, pool.map)
            label = f"{llm.backend} {_model(llm)}"
        else:
            result = extract(chosen)
            label = "MOCK, selectors only"
    by_url = {page.url: page for page in pages}
    problems = _problems(result, by_url)
    if problems:
        print("extract: refusing to write:\n" + "\n".join(problems[:20]), file=sys.stderr)
        return 1
    _write(bundle, result, {page.source_id for page in chosen})
    print(summary(result, by_url, label))
    return 0


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
    args = parser.parse_args(argv)
    unknown = sorted(set(args.kinds) - set(ASKED))
    if unknown:
        parser.error(f"--kinds: {', '.join(unknown)} is not one of {', '.join(ASKED)}")
    return args


def _model(llm: Router) -> str:
    return llm.models()["extract"]


def _ask(llm: Router, messages: list[Message]) -> str:
    return llm.chat(
        messages,
        role="extract",
        prompt_version=EXTRACT_PROMPT_VERSION,
        temperature=0.0,
        max_tokens=MAX_TOKENS,
    )


def _cached(llm: Router, messages: list[Message]) -> bool:
    key = cache_key(_model(llm), messages, 0.0, None, MAX_TOKENS, EXTRACT_PROMPT_VERSION)
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
