"""Crawl one site politely, and all sites a few at a time.

The network, the clock and sleep are passed in, so the loop runs in tests against a fake web and
a fake clock, and the visit order and every wait can be asserted exactly. A host that answers 429,
or 403 to robots.txt, is stopped at once and never retried: we do not work around a block.
"""

import sys
import traceback
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor

from bernlife import robots, sitemap
from bernlife.classify import classify
from bernlife.crawl_records import (
    Clock,
    Event,
    HostStopped,
    Pacer,
    RawPage,
    SiteResult,
    Sleep,
    stamp,
)
from bernlife.fetch import Response
from bernlife.frontier import SILENT, Frontier
from bernlife.html_text import extract
from bernlife.sources import Site
from bernlife.urls import host_of, normalise

# 21 of the 22 hosts run on unibe.ch infrastructure; all at once would be ~20 requests a second.
PARALLEL_HOSTS = 4
ROBOTS_TRIES = 3
MAX_ERRORS_IN_ROW = 5
MAX_CHILD_SITEMAPS = 20
MAX_REDIRECTS = 5
HTML_TYPES = frozenset({"text/html", "application/xhtml+xml"})

Fetch = Callable[[str], Response]


def crawl_all(sites: list[Site], fetch: Fetch, clock: Clock, sleep: Sleep) -> list[SiteResult]:
    with ThreadPoolExecutor(max_workers=PARALLEL_HOSTS) as pool:
        return list(pool.map(lambda site: _crawl_guarded(site, fetch, clock, sleep), sites))


def crawl_site(site: Site, fetch: Fetch, clock: Clock, sleep: Sleep) -> SiteResult:
    return _SiteCrawl(site, fetch, clock, sleep).run()


def _crawl_guarded(site: Site, fetch: Fetch, clock: Clock, sleep: Sleep) -> SiteResult:
    try:
        return crawl_site(site, fetch, clock, sleep)
    except Exception:
        # One broken site must not lose the other 21; the trace goes to the console, the output
        # only records the marker.
        print(f"crawl of {site.host} failed:", file=sys.stderr)
        traceback.print_exc()
        return SiteResult(site, (), (), "engine_error")


class _SiteCrawl:
    def __init__(self, site: Site, fetch: Fetch, clock: Clock, sleep: Sleep) -> None:
        self.site = site
        self.fetch = fetch
        self.clock = clock
        self.pacer = Pacer(site.delay_s, clock, sleep)
        self.pages: list[RawPage] = []
        self.events: list[Event] = []

    def run(self) -> SiteResult:
        try:
            rules = self._robots()
            self.pacer.delay = max(self.site.delay_s, rules.crawl_delay or 0)
            frontier = Frontier(self.site, rules.allows)
            for seed in self.site.seeds:
                self._admit(frontier, normalise(seed, seed), 0, seed=True)
            for url in self._sitemap_pages(rules):
                self._admit(frontier, normalise(url, url), 1)
            self._fetch_pages(frontier)
        except HostStopped as stop:
            return self._result(stop.reason)
        for left in frontier.remaining():
            self._log(left.url, None, "max_pages")
        return self._result(None)

    def _fetch_pages(self, frontier: Frontier) -> None:
        failures: list[int | None] = []
        while len(self.pages) < self.site.max_pages and (entry := frontier.pop()):
            fetched_at, response = self._get(entry.url)
            status = response.status
            if response.error or status is None or status == 403 or status >= 500:
                self._log(entry.url, status, response.error or f"http_{status}")
                failures.append(status)
                if len(failures) >= MAX_ERRORS_IN_ROW:
                    raise HostStopped("blocked" if set(failures) == {403} else "unreachable")
                continue
            failures = []
            if 300 <= status < 400:
                self._redirect(frontier, entry.url, entry.depth, response)
            elif status != 200:
                self._log(entry.url, status, f"http_{status}")
            elif response.content_type not in HTML_TYPES:
                self._log(entry.url, status, "not_html")
            else:
                self._read_page(frontier, entry.url, entry.depth, fetched_at, response)

    def _read_page(
        self, frontier: Frontier, url: str, depth: int, fetched_at: str, response: Response
    ) -> None:
        extracted = extract(response.body, url)
        if extracted.noindex:
            self._log(url, 200, "noindex")
        else:
            self.pages.append(RawPage(url, fetched_at, 200, response.body))
            self._log(url, 200, f"page:{classify(self.site, url)}")
        if not extracted.nofollow:
            for link in extracted.links:
                self._admit(frontier, normalise(link, url), depth + 1)

    def _redirect(self, frontier: Frontier, url: str, depth: int, response: Response) -> None:
        target = normalise(response.location or "", url)
        reason = self._admit(frontier, target, depth) if target else "no_location"
        outcome = "redirect" if reason in (None, "seen") else f"redirect_{reason}"
        self._log(url, response.status, outcome)

    def _robots(self) -> robots.Robots:
        url = f"https://{self.site.host}/robots.txt"
        response = Response(None)
        for _ in range(ROBOTS_TRIES):
            response = self._get_following(url)
            if response.status == 200:
                self._log(url, 200, "robots")
                return robots.parse(response.body)
            if response.status == 403:
                self._log(url, 403, "blocked")
                raise HostStopped("blocked")
            if response.status is not None and 400 <= response.status < 500:
                self._log(url, response.status, "robots_missing")
                return robots.ALLOW_ALL
        self._log(url, response.status, "robots_unreachable")
        raise HostStopped("robots_unreachable")

    def _sitemap_pages(self, rules: robots.Robots) -> list[str]:
        listed = [url for url in rules.sitemaps if host_of(url) == self.site.host]
        pages: list[str] = []
        for root in listed or [f"https://{self.site.host}/sitemap.xml"]:
            found = self._sitemap(root, rules)
            if found is None:
                continue
            pages += found.pages
            # One level only: an index listed inside an index is not followed.
            for child in found.children[:MAX_CHILD_SITEMAPS]:
                nested = self._sitemap(child, rules)
                pages += nested.pages if nested else ()
        return pages

    def _sitemap(self, url: str, rules: robots.Robots) -> sitemap.Sitemap | None:
        target = normalise(url, url)
        if target is None or host_of(target) != self.site.host:
            return None
        if not rules.allows(target):
            self._log(target, None, "robots")
            return None
        response = self._get_following(target)
        if response.status != 200:
            self._log(target, response.status, f"sitemap_{response.error or 'missing'}")
            return None
        found = sitemap.parse(response.body)
        self._log(target, 200, "sitemap" if found else "sitemap_malformed")
        return found

    def _get_following(self, url: str) -> Response:
        """robots.txt and sitemaps may redirect; only redirects within the host are followed."""
        for _ in range(MAX_REDIRECTS + 1):
            _, response = self._get(url)
            if response.status is None or not 300 <= response.status < 400:
                return response
            target = normalise(response.location or "", url)
            if target is None or host_of(target) != self.site.host:
                return Response(None, error="redirect_off_host")
            url = target
        return Response(None, error="too_many_redirects")

    def _get(self, url: str) -> tuple[str, Response]:
        self.pacer.wait()
        fetched_at = stamp(self.clock())
        response = self.fetch(url)
        if response.status == 429:
            self._log(url, 429, "rate_limited")
            raise HostStopped("blocked")
        return fetched_at, response

    def _admit(
        self, frontier: Frontier, url: str | None, depth: int, *, seed: bool = False
    ) -> str | None:
        if url is None:
            return "not_web"
        reason = frontier.admit(url, depth, seed=seed)
        if reason is not None and reason not in SILENT:
            self._log(url, None, reason)
        return reason

    def _log(self, url: str, status: int | None, outcome: str) -> None:
        self.events.append(Event(url, self.site.source_id, self.site.host, status, outcome))

    def _result(self, stopped: str | None) -> SiteResult:
        return SiteResult(self.site, tuple(self.pages), tuple(self.events), stopped)
