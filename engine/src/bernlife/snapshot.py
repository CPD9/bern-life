"""Turn fetched HTML into page records and write the crawl's files.

The page record is built from the raw HTML by one function, used both right after a crawl and by
`crawl --offline`, so a change to text extraction or `page_types` can be replayed from the local
HTML without asking the hosts again. The HTML stays in the crawl folder: only `pages.jsonl`
belongs to the bundle. Every file is sorted and written in one rename, so two runs over the same
HTML produce the same bytes and a crash never leaves half a file.
"""

import gzip
import hashlib
import json
from collections.abc import Iterable
from dataclasses import asdict
from pathlib import Path

from bernlife.classify import classify
from bernlife.crawl_records import Event, RawPage
from bernlife.html_text import extract
from bernlife.jsonl import read_jsonl, write_atomic, write_jsonl
from bernlife.lang import language
from bernlife.sources import Site


def page_record(site: Site, raw: RawPage) -> dict[str, object] | None:
    """The page as `contracts/page.schema.json` has it, or None if it asks not to be indexed."""
    extracted = extract(raw.html, raw.url)
    if extracted.noindex:
        return None
    return {
        "url": raw.url,
        "source_id": site.source_id,
        "unit": site.unit,
        "fetched_at": raw.fetched_at,
        "sha256": hashlib.sha256(extracted.text.encode("utf-8")).hexdigest(),
        "status": raw.status,
        "lang": language(extracted.text, extracted.declared_lang),
        "title": extracted.title,
        "kind": classify(site, raw.url),
        "text": extracted.text,
    }


def event_record(event: Event) -> dict[str, object]:
    return asdict(event)


def replace_lines(path: Path, records: Iterable[dict[str, object]], source_ids: set[str]) -> int:
    """Write `records` to a JSONL file sorted by URL, keeping the lines of other sources."""
    kept = [line for line in read_jsonl(path) if line["source_id"] not in source_ids]
    merged = sorted([*kept, *records], key=lambda r: (str(r["url"]), json.dumps(r, sort_keys=True)))
    write_jsonl(path, merged)
    return len(merged)


def save_raw(folder: Path, site: Site, pages: Iterable[RawPage]) -> None:
    lines = "".join(json.dumps(asdict(p), ensure_ascii=False) + "\n" for p in pages)
    write_atomic(raw_path(folder, site), gzip.compress(lines.encode(), mtime=0))


def load_raw(folder: Path, site: Site) -> list[RawPage] | None:
    path = raw_path(folder, site)
    if not path.exists():
        return None
    lines = gzip.decompress(path.read_bytes()).decode().splitlines()
    return [RawPage(**json.loads(line)) for line in lines if line]


def raw_path(folder: Path, site: Site) -> Path:
    return folder / "html" / f"{site.host}.jsonl.gz"
