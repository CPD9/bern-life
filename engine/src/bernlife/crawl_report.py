"""The summary a crawl prints: Markdown tables that can go straight into a PR or the run notes."""

from collections import Counter
from collections.abc import Iterable

from bernlife.crawl_records import Event

KINDS = (
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
LANGS = ("de", "en", "fr", "it", "unknown")
NETWORK_ERRORS = frozenset(
    {"timeout", "network", "too_large", "rate_limited", "robots_unreachable"}
)


def is_error(outcome: str) -> bool:
    return outcome in NETWORK_ERRORS or outcome.startswith("http_")


def summary(
    pages: list[dict[str, object]],
    events: Iterable[Event],
    stopped: dict[str, str | None],
    seconds: float,
) -> str:
    events = list(events)
    return "\n".join(
        [
            *_host_table(pages, events, stopped),
            "",
            *_source_table(pages),
            "",
            f"{len(pages)} pages, wall time {seconds / 60:.1f} min",
        ]
    )


def _host_table(
    pages: list[dict[str, object]], events: list[Event], stopped: dict[str, str | None]
) -> list[str]:
    hosts = {(e.source_id, e.host) for e in events} | {
        (str(p["source_id"]), _host(str(p["url"]))) for p in pages
    }
    per_host = Counter(_host(str(p["url"])) for p in pages)
    rows = [
        "| source | host | pages | robots skips | errors | left at max | stopped |",
        "|---|---|---:|---:|---:|---:|---|",
    ]
    for source_id, host in sorted(hosts):
        mine = [e.outcome for e in events if e.host == host]
        errors = sum(map(is_error, mine))
        rows.append(
            f"| {source_id} | {host} | {per_host[host]} | {mine.count('robots')} | {errors} "
            f"| {mine.count('max_pages')} | {stopped.get(host) or ''} |"
        )
    return rows


def _source_table(pages: list[dict[str, object]]) -> list[str]:
    rows = [
        "| source | pages | " + " | ".join(KINDS) + " | " + " | ".join(LANGS) + " |",
        "|---|---:|" + "---:|" * (len(KINDS) + len(LANGS)),
    ]
    for source_id in sorted({str(p["source_id"]) for p in pages}):
        mine = [p for p in pages if p["source_id"] == source_id]
        kinds = Counter(str(p["kind"]) for p in mine)
        langs = Counter(str(p["lang"]) for p in mine)
        counts = [kinds[k] for k in KINDS] + [langs[lang] for lang in LANGS]
        rows.append(f"| {source_id} | {len(mine)} | " + " | ".join(map(str, counts)) + " |")
    return rows


def _host(url: str) -> str:
    return url.split("/")[2]
