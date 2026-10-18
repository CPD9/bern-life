"""`python -m bernlife check-places`: is every map address a verbatim part of a stored page?

W2 places institutions on the map by an address read from the institution's own pages. This
confirms each `address_span` against the crawl, reports what does not match and changes nothing.
"""

import argparse
import json
import os
import sys
from collections.abc import Iterable, Mapping, Sequence
from pathlib import Path
from urllib.parse import urlsplit

from bernlife import paths
from bernlife.extract_records import Page
from bernlife.jsonl import read_jsonl


def check_places(places: Iterable[Mapping[str, object]], pages: Iterable[Page]) -> list[str]:
    """One line per place: `ok`, `no address` or the mismatch."""
    by_host: dict[str, list[Page]] = {}
    for page in pages:
        by_host.setdefault(urlsplit(page.url).hostname or "", []).append(page)
    return [_check(place, by_host.get(str(place["host"]), [])) for place in places]


def _check(place: Mapping[str, object], pages: list[Page]) -> str:
    label = f"{place['id']:<12}"
    span = place.get("address_span")
    if not isinstance(span, str) or not span:
        return f"{label} no address"
    holding = [page for page in pages if span in page.text]
    if not holding:
        return f"{label} MISMATCH span not in any stored page of {place['host']}: {span!r}"
    stated = next((page for page in pages if page.url == place.get("address_url")), None)
    if stated is None or span not in stated.text:
        return f"{label} MISMATCH span not on address_url; found on {holding[0].url}"
    if stated.sha256 != place.get("address_page_sha256"):
        return f"{label} MISMATCH span found, address_page_sha256 is stale"
    return f"{label} ok"


def main(argv: Sequence[str], env: Mapping[str, str] = os.environ) -> int:
    parser = argparse.ArgumentParser(prog="python -m bernlife check-places")
    default = paths.repo_root() / "web" / "features" / "world" / "places.json"
    parser.add_argument("--places", type=Path, default=default)
    args = parser.parse_args(argv)
    if not args.places.exists():
        print(f"check-places: no {args.places}", file=sys.stderr)
        return 2
    places = json.loads(args.places.read_text())
    pages = [
        Page.from_record(r) for r in read_jsonl(paths.data_dir(env) / "bundle" / "pages.jsonl")
    ]
    lines = check_places(places, pages)
    print("\n".join(lines))
    mismatches = sum(1 for line in lines if " MISMATCH " in line)
    print(f"{len(lines)} places, {mismatches} mismatches")
    return 1 if mismatches else 0
