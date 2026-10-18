import hashlib
import json
import unittest
from pathlib import Path

from bernlife.crawl import crawl_site
from bernlife.crawl_records import Event
from bernlife.fetch import Response
from bernlife.snapshot import page_record
from fakes import HOST, FakeTime, FakeWeb, html_page, site
from jsonschema import Draft202012Validator

ROOT = f"https://{HOST}"
PAGE_SCHEMA = Path(__file__).resolve().parents[2] / "contracts" / "page.schema.json"

ROBOTS = f"""User-agent: *
Disallow: /private/
Crawl-delay: 2
Sitemap: {ROOT}/sitemap.xml
"""
SITEMAP = f"""<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>{ROOT}/team/ada-muster</loc></url><url><loc>{ROOT}/research/</loc></url></urlset>"""
HOME_LINKS = [
    "/team/",
    "/private/x",
    "/report.pdf",
    "https://www.unibe.test/",
    "/research/",
    "/old",
    "/away",
]


def links(*hrefs: str) -> str:
    return "".join(f'<a href="{href}">{href}</a>' for href in hrefs)


def small_web() -> dict[str, Response]:
    return {
        f"{ROOT}/robots.txt": Response(200, "text/plain", None, ROBOTS),
        f"{ROOT}/sitemap.xml": Response(200, "application/xml", None, SITEMAP),
        f"{ROOT}/": html_page("<p>Example Institute for Engineering</p>" + links(*HOME_LINKS)),
        f"{ROOT}/team/ada-muster": html_page("<p>Dr. Ada&nbsp;Muster, Sensor Lab</p>", "Ada"),
        f"{ROOT}/research/": html_page("<p>Research at the institute</p>"),
        f"{ROOT}/team/": html_page("<p>Our team</p>" + links("ada-muster")),
        f"{ROOT}/old": Response(301, "text/html", "/new"),
        f"{ROOT}/away": Response(302, "text/html", "https://elsewhere.test/"),
        f"{ROOT}/new": html_page("<p>New page</p>"),
    }


class CrawlSiteTest(unittest.TestCase):
    def setUp(self):
        self.time = FakeTime()
        self.web = FakeWeb(self.time, small_web())
        self.result = crawl_site(site(), self.web, self.time.clock, self.time.sleep)

    def test_visit_order(self):
        expected = [
            "/robots.txt",
            "/sitemap.xml",
            "/",
            "/team/ada-muster",
            "/research/",
            "/team/",
            "/old",
            "/away",
            "/new",
        ]
        self.assertEqual(self.web.requests, [ROOT + path for path in expected])

    def test_waits_follow_the_robots_crawl_delay(self):
        # Crawl-delay 2 beats delay_s 1; each request takes 0.25 s, so 1.75 s is left to wait.
        self.assertEqual(self.time.sleeps, [1.75] * 8)

    def test_pages_and_fetch_times(self):
        stored = [(page.url, page.fetched_at) for page in self.result.pages]
        self.assertEqual(
            stored,
            [
                (f"{ROOT}/", "2026-10-18T12:00:04Z"),
                (f"{ROOT}/team/ada-muster", "2026-10-18T12:00:06Z"),
                (f"{ROOT}/research/", "2026-10-18T12:00:08Z"),
                (f"{ROOT}/team/", "2026-10-18T12:00:10Z"),
                (f"{ROOT}/new", "2026-10-18T12:00:16Z"),
            ],
        )
        self.assertIsNone(self.result.stopped)

    def test_events(self):
        def event(path: str, status: int | None, outcome: str) -> Event:
            return Event(f"{ROOT}{path}", "example", HOST, status, outcome)

        expected = [
            event("/robots.txt", 200, "robots"),
            event("/sitemap.xml", 200, "sitemap"),
            event("/", 200, "page:other"),
            event("/private/x", None, "robots"),
            event("/report.pdf", None, "not_html"),
            event("/team/ada-muster", 200, "page:person"),
            event("/research/", 200, "page:other"),
            event("/team/", 200, "page:listing"),
            event("/old", 301, "redirect"),
            event("/away", 302, "redirect_off_host"),
            event("/new", 200, "page:other"),
        ]
        self.assertEqual(list(self.result.events), expected)

    def test_every_page_matches_the_contract_and_its_hash(self):
        validator = Draft202012Validator(json.loads(PAGE_SCHEMA.read_text()))
        for raw in self.result.pages:
            record = page_record(site(), raw)
            with self.subTest(url=raw.url):
                self.assertEqual(list(validator.iter_errors(record)), [])
                digest = hashlib.sha256(str(record["text"]).encode("utf-8")).hexdigest()
                self.assertEqual(record["sha256"], digest)
        person = page_record(site(), self.result.pages[1])
        self.assertEqual(person["text"], "Dr. Ada Muster, Sensor Lab")
        self.assertEqual(person["kind"], "person")


class StoppingTest(unittest.TestCase):
    def crawl(self, pages: dict[str, Response], **changes: object):
        time = FakeTime()
        web = FakeWeb(time, pages)
        return crawl_site(site(**changes), web, time.clock, time.sleep), web

    def test_rate_limit_stops_the_host(self):
        pages = {
            f"{ROOT}/robots.txt": Response(404, "text/html"),
            f"{ROOT}/": Response(429, "text/html"),
        }
        result, web = self.crawl(pages, seeds=(f"{ROOT}/", f"{ROOT}/b"))
        self.assertEqual(result.stopped, "blocked")
        self.assertEqual(web.requests, [f"{ROOT}/robots.txt", f"{ROOT}/sitemap.xml", f"{ROOT}/"])

    def test_unreachable_robots_skips_the_host(self):
        result, web = self.crawl({f"{ROOT}/robots.txt": Response(503, "text/html")})
        self.assertEqual(result.stopped, "robots_unreachable")
        self.assertEqual(web.requests, [f"{ROOT}/robots.txt"] * 3)
        self.assertEqual(result.pages, ())

    def test_forbidden_robots_stops_the_host(self):
        result, web = self.crawl({f"{ROOT}/robots.txt": Response(403, "text/html")})
        self.assertEqual(result.stopped, "blocked")
        self.assertEqual(web.requests, [f"{ROOT}/robots.txt"])

    def test_five_failures_in_a_row_stop_the_host(self):
        seeds = tuple(f"{ROOT}/p{n}" for n in range(7))
        failing = {url: Response(None, error="timeout") for url in seeds}
        pages = {f"{ROOT}/robots.txt": Response(404, "text/html"), **failing}
        result, web = self.crawl(pages, seeds=seeds)
        self.assertEqual(result.stopped, "unreachable")
        self.assertEqual(web.requests[2:], list(seeds[:5]))

    def test_max_pages_logs_what_was_left(self):
        pages = {
            f"{ROOT}/robots.txt": Response(404, "text/html"),
            f"{ROOT}/": html_page(links("/a", "/b")),
        }
        result, _ = self.crawl(pages, max_pages=1)
        left = [e.url for e in result.events if e.outcome == "max_pages"]
        self.assertEqual(left, [f"{ROOT}/a", f"{ROOT}/b"])

    def test_noindex_page_is_not_kept_but_followed(self):
        pages = {
            f"{ROOT}/robots.txt": Response(404, "text/html"),
            f"{ROOT}/": html_page('<meta name="robots" content="noindex">' + links("/a")),
            f"{ROOT}/a": html_page("<p>A</p>"),
        }
        result, _ = self.crawl(pages)
        self.assertEqual([p.url for p in result.pages], [f"{ROOT}/a"])


if __name__ == "__main__":
    unittest.main()
