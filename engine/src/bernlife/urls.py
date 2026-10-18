"""One spelling per page address, so the crawl fetches each page once and the evaluator can compare
our URLs with the gold proof URLs.

Paths keep their trailing slash as written: `/x/` and `/x` can be different pages, and the gold set
uses both styles. Only an empty path becomes `/`. Every allowed host serves https, so http links on
those hosts are rewritten rather than fetched twice.
"""

from pathlib import PurePosixPath
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

TRACKING_PARAMS = frozenset({"fbclid", "gclid", "mc_cid", "mc_eid"})
# fmt: off
NON_PAGE_EXTENSIONS = frozenset(
    {
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp",
        ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".ico", ".tif", ".tiff", ".bmp",
        ".zip", ".gz", ".tar", ".7z", ".rar",
        ".mp3", ".mp4", ".m4a", ".wav", ".mov", ".avi", ".webm",
        ".css", ".js", ".json", ".xml", ".rss", ".ics", ".vcf", ".txt", ".csv",
    }
)
# fmt: on


def normalise(href: str, base: str) -> str | None:
    """The canonical https URL of `href` read on page `base`, or None if it is no web address."""
    href = href.strip()
    if not href:
        return None
    parts = urlsplit(urljoin(base, href))
    if parts.scheme not in ("http", "https"):
        return None
    host = (parts.hostname or "").rstrip(".")
    try:
        port = parts.port
    except ValueError:
        return None
    if not host:
        return None
    netloc = host if port in (None, 80, 443) else f"{host}:{port}"
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if not _tracking(k)]
    return urlunsplit(("https", netloc, parts.path or "/", urlencode(sorted(query)), ""))


def host_of(url: str) -> str:
    return urlsplit(url).hostname or ""


def path_and_query(url: str) -> str:
    parts = urlsplit(url)
    return parts.path + (f"?{parts.query}" if parts.query else "")


def is_page_like(url: str) -> bool:
    return PurePosixPath(urlsplit(url).path).suffix.lower() not in NON_PAGE_EXTENSIONS


def _tracking(param: str) -> bool:
    return param in TRACKING_PARAMS or param.startswith("utm_")
