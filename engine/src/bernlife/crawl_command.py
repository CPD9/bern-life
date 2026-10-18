"""`python -m bernlife crawl`: sources/*.json in, data/bundle/pages.jsonl out.

With `--source`, only that source's lines are replaced, so adding a site is one file and one
command. With `--offline`, pages are rebuilt from the HTML the last crawl kept, without a request.
"""

import argparse
import sys
import time

from bernlife import paths
from bernlife.crawl import crawl_all
from bernlife.crawl_records import SiteResult
from bernlife.crawl_report import summary
from bernlife.fetch import fetch
from bernlife.snapshot import event_record, load_raw, page_record, replace_lines, save_raw
from bernlife.sources import Site, SourceError, load_sources


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="python -m bernlife crawl")
    parser.add_argument("--source", action="append", default=[], metavar="ID")
    parser.add_argument("--offline", action="store_true", help="rebuild from the kept HTML")
    args = parser.parse_args(argv)
    try:
        sources = load_sources()
    except SourceError as error:
        print(f"crawl: {error}", file=sys.stderr)
        return 2
    unknown = sorted(set(args.source) - {source.id for source in sources})
    if unknown:
        print(f"crawl: no source with id {', '.join(unknown)}", file=sys.stderr)
        return 2
    chosen = [s for s in sources if not args.source or s.id in args.source]
    sites = [site for source in chosen for site in source.sites]
    started = time.monotonic()
    results = _replay(sites) if args.offline else _crawl(sites)
    if results is None:
        return 2
    ids = {source.id for source in chosen}
    pages = [
        record
        for result in results
        for raw in result.pages
        if (record := page_record(result.site, raw)) is not None
    ]
    replace_lines(paths.bundle_dir() / "pages.jsonl", pages, ids)
    stopped = {result.site.host: result.stopped for result in results}
    events = [event for result in results for event in result.events]
    print(summary(pages, events, stopped, time.monotonic() - started))
    return 0


def _crawl(sites: list[Site]) -> list[SiteResult]:
    results = crawl_all(sites, fetch, time.time, time.sleep)
    for result in results:
        save_raw(paths.crawl_dir(), result.site, result.pages)
    events = [event_record(event) for result in results for event in result.events]
    replace_lines(paths.crawl_dir() / "events.jsonl", events, {s.source_id for s in sites})
    return results


def _replay(sites: list[Site]) -> list[SiteResult] | None:
    kept = {site.host: load_raw(paths.crawl_dir(), site) for site in sites}
    missing = sorted(host for host, pages in kept.items() if pages is None)
    if missing:
        print(f"crawl: no kept HTML for {', '.join(missing)}; crawl online first", file=sys.stderr)
        return None
    return [SiteResult(site, tuple(kept[site.host] or ()), (), None) for site in sites]
