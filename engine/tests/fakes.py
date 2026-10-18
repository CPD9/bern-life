"""Invented sites, a fake web and a fake clock for the crawl tests. No real host is contacted."""

from dataclasses import replace

from bernlife.fetch import Response
from bernlife.sources import PageType, Site

HOST = "www.example-institute.test"


def site(**changes: object) -> Site:
    base = Site(
        source_id="example",
        host=HOST,
        unit="Example Institute for Engineering",
        seeds=(f"https://{HOST}/",),
        allow_paths=(),
        deny_paths=(),
        max_pages=50,
        delay_s=1.0,
        max_depth=3,
        page_types=(PageType("person", rf"^https://{HOST.replace('.', r'\.')}/team/[a-z-]+$"),),
    )
    return replace(base, **changes)


def html_page(body: str, title: str = "Page") -> Response:
    html = f"<html lang='en'><head><title>{title}</title></head><body>{body}</body></html>"
    return Response(200, "text/html", None, html)


class FakeWeb:
    """Answers from a dict of URL → Response; anything else is a 404. Records every request."""

    def __init__(self, clock: "FakeTime", pages: dict[str, Response], latency: float = 0.25):
        self.clock = clock
        self.pages = pages
        self.latency = latency
        self.requests: list[str] = []

    def __call__(self, url: str) -> Response:
        self.requests.append(url)
        self.clock.now += self.latency
        return self.pages.get(url, Response(404, "text/html"))


class FakeTime:
    def __init__(self, start: float = 1_792_324_800.0) -> None:  # 2026-10-18T12:00:00Z
        self.now = start
        self.sleeps: list[float] = []

    def clock(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(round(seconds, 6))
        self.now += seconds
