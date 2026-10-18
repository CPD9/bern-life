"""The queue of pages one site still has to fetch, breadth first.

Every rule that can keep a URL out is checked when the URL is first seen, and the first reason is
the one reported; a URL seen again is silently ignored, so each skip is logged once. Seeds may sit
outside `allow_paths`: a site whose seed is `/` and whose allowed path is `/team/` still has to
read `/` to find the team pages.
"""

from collections import deque
from collections.abc import Callable
from dataclasses import dataclass

from bernlife.sources import Site
from bernlife.urls import host_of, is_page_like, path_and_query

# Reasons a caller should log. "seen" and "off_host" are not logged: every page links to the same
# menu and to other sites, and logging those would bury the real skips.
SILENT = frozenset({"seen", "off_host"})


@dataclass(frozen=True)
class Entry:
    url: str
    depth: int


class Frontier:
    def __init__(self, site: Site, robots_allows: Callable[[str], bool]) -> None:
        self._site = site
        self._robots_allows = robots_allows
        self._queue: deque[Entry] = deque()
        self._seen: set[str] = set()

    def admit(self, url: str, depth: int, *, seed: bool = False) -> str | None:
        """Queue `url` (already normalised) and return None, or return why it was not queued."""
        if host_of(url) != self._site.host:
            return "off_host"
        if url in self._seen:
            return "seen"
        self._seen.add(url)
        reason = self._rejection(url, depth, seed)
        if reason is None:
            self._queue.append(Entry(url, depth))
        return reason

    def pop(self) -> Entry | None:
        return self._queue.popleft() if self._queue else None

    def remaining(self) -> list[Entry]:
        return list(self._queue)

    def _rejection(self, url: str, depth: int, seed: bool) -> str | None:
        target = path_and_query(url)
        site = self._site
        if not is_page_like(url):
            return "not_html"
        if any(target.startswith(prefix) for prefix in site.deny_paths):
            return "denied_path"
        if not seed and site.allow_paths and not target.startswith(site.allow_paths):
            return "not_allowed_path"
        if site.max_depth is not None and depth > site.max_depth:
            return "too_deep"
        if not self._robots_allows(url):
            return "robots"
        return None
