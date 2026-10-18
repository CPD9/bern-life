"""Source configs: one JSON file per institution under sources/.

Everything is validated at load time, so a typo in a new site's file stops the crawl before the
first request, with the file and the field named.
"""

import json
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

from jsonschema import Draft202012Validator

from bernlife import paths


class SourceError(ValueError):
    pass


@dataclass(frozen=True)
class PageType:
    kind: str
    url_pattern: str


@dataclass(frozen=True)
class Site:
    source_id: str
    host: str
    unit: str
    seeds: tuple[str, ...]
    allow_paths: tuple[str, ...]
    deny_paths: tuple[str, ...]
    max_pages: int
    delay_s: float
    max_depth: int | None
    page_types: tuple[PageType, ...]


@dataclass(frozen=True)
class Source:
    id: str
    name: str
    sites: tuple[Site, ...]


def load_sources(folder: Path | None = None, schema: Path | None = None) -> list[Source]:
    schema_doc = json.loads((schema or paths.contract("source.schema.json")).read_text())
    validator = Draft202012Validator(schema_doc)
    files = sorted((folder or paths.sources_dir()).glob("*.json"))
    sources = [_load(path, validator) for path in files]
    _check_unique(sources)
    return sources


def _load(path: Path, validator: Draft202012Validator) -> Source:
    try:
        doc = json.loads(path.read_text())
    except json.JSONDecodeError as error:
        raise SourceError(f"{path.name}: not valid JSON (line {error.lineno})") from None
    problems = sorted(validator.iter_errors(doc), key=lambda e: e.json_path)
    if problems:
        raise SourceError(f"{path.name}: {problems[0].json_path}: {problems[0].message}")
    page_types = tuple(PageType(t["kind"], t["url_pattern"]) for t in doc.get("page_types", []))
    crawl = doc["crawl"]
    sites = []
    for index, site in enumerate(doc["sites"]):
        for seed in site["seeds"]:
            if urlsplit(seed).hostname != site["host"]:
                where = f"$.sites[{index}].seeds"
                raise SourceError(f"{path.name}: {where}: {seed} is not on {site['host']}")
        sites.append(
            Site(
                source_id=doc["id"],
                host=site["host"],
                unit=site["unit"],
                seeds=tuple(site["seeds"]),
                allow_paths=tuple(site.get("allow_paths", [])),
                deny_paths=tuple(site.get("deny_paths", [])),
                max_pages=crawl["max_pages_per_site"],
                delay_s=crawl["delay_s"],
                max_depth=crawl.get("max_depth"),
                page_types=page_types,
            )
        )
    return Source(doc["id"], doc["name"], tuple(sites))


def _check_unique(sources: list[Source]) -> None:
    ids = [source.id for source in sources]
    hosts = [site.host for source in sources for site in source.sites]
    for label, values in (("source id", ids), ("host", hosts)):
        repeated = sorted({value for value in values if values.count(value) > 1})
        if repeated:
            raise SourceError(f"{label} listed twice: {', '.join(repeated)}")
