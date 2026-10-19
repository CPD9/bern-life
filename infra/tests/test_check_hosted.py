import http.client
import io
import json
import shutil
import tempfile
import unittest
import urllib.error
import urllib.response
from datetime import UTC, datetime, timedelta
from email.message import Message
from pathlib import Path

from infra.check_hosted import (
    Answer,
    Clock,
    Expected,
    Watch,
    ask,
    expected_from,
    problems,
    serving_line,
    watch_line,
    watch_until_down,
)

EXPECTED = Expected("bundle-20261019-1", 120, 45, "replay")
EXPECTED_LIVE = Expected("bundle-20261019-1", 120, 45, "live")
SERVING = {
    "mode": "replay",
    "models": {"embed": "intfloat/multilingual-e5-small"},
    "snapshot": "bundle-20261019-1",
    "counts": {"pages": 120, "profiles": 45, "sources": 3},
}
FIXTURES = {
    "mode": "mock",
    "models": {"expand": "MOCK-no-model"},
    "snapshot": "fixture",
    "counts": {"pages": 2, "profiles": 2, "sources": 1},
}
# The fields the live-safety health adds next to the ones above, shaped as health.schema.json.
LIVE = {
    **SERVING,
    "mode": "live",
    "status": "degraded",
    "uptime_s": 7260,
    "failures_last_hour": {"explain": {"timeout": 2, "http_503": 1}, "expand": {"budget": 4}},
}
URL = "https://demo.example.test"
# web/infrastructure/engine-response.ts answers an engine failure with this body and HTTP 502.
ENGINE_ERROR = b'{"error":"engine_error"}'
START = datetime(2026, 10, 19, 4, 0, tzinfo=UTC)
DOWN = Answer(None, None)
BAD_GATEWAY = Answer(502, {"error": "engine_error"})


def served(status: int, body: bytes):
    """A fake urlopen: a response on 200, and the HTTPError urlopen raises for any other status."""
    opened: list[str] = []

    def open_url(url: str):
        opened.append(url)
        if status == 200:
            return urllib.response.addinfourl(io.BytesIO(body), Message(), url, status)
        raise urllib.error.HTTPError(url, status, "Bad Gateway", Message(), io.BytesIO(body))

    return open_url, opened


class BreaksOff(io.RawIOBase):
    """A body that breaks off with the given error when it is read."""

    def __init__(self, error: Exception):
        self.error = error

    def readable(self) -> bool:
        return True

    def readinto(self, buffer) -> int:
        raise self.error


def cut_short(error: Exception):
    """A fake urlopen whose 502 arrives but whose body breaks off."""

    def open_url(url: str):
        raise urllib.error.HTTPError(url, 502, "Bad Gateway", Message(), BreaksOff(error))

    return open_url


def unreachable(url: str):
    raise urllib.error.URLError("connection refused")


def garbled(url: str):
    raise http.client.BadStatusLine("")


class FakeTime:
    """A clock that moves only when the watch sleeps or a fake check takes its time."""

    def __init__(self):
        self.seconds = 0.0
        self.sleeps: list[float] = []

    def clock(self) -> Clock:
        return Clock(
            wall=lambda: START + timedelta(seconds=self.seconds),
            monotonic=lambda: self.seconds,
            sleep=self.sleep,
        )

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.seconds += seconds


class Checks:
    """A fake ask: each call takes its seconds on the fake clock and gives its answer."""

    def __init__(self, time: FakeTime, *replies: tuple[Answer, float]):
        self.time = time
        self.replies = list(replies)
        self.urls: list[str] = []

    def __call__(self, url: str) -> Answer:
        self.urls.append(url)
        answer, seconds = self.replies.pop(0)
        self.time.seconds += seconds
        return answer


class ExpectedFromTest(unittest.TestCase):
    def test_reads_the_lock_version_and_the_manifest_line_counts(self):
        folder = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, folder, ignore_errors=True)
        (folder / "bundle.lock").write_text(json.dumps({"version": "bundle-20261019-1"}))
        files = {
            "pages.jsonl": {"sha256": "a" * 64, "lines": 120},
            "profiles.jsonl": {"sha256": "b" * 64, "lines": 45},
            "vectors.jsonl": {"sha256": "c" * 64, "lines": 300},
        }
        manifest = {"version": "bundle-20261019-1", "files": files}
        (folder / "manifest.json").write_text(json.dumps(manifest))

        self.assertEqual(
            expected_from(folder / "bundle.lock", folder / "manifest.json", "replay"), EXPECTED
        )


class AskTest(unittest.TestCase):
    def test_a_success_gives_its_status_and_body(self):
        open_url, opened = served(200, json.dumps(SERVING).encode())
        self.assertEqual(ask(URL, open_url), Answer(200, SERVING))
        self.assertEqual(opened, [URL])

    def test_an_engine_error_gives_the_502_and_the_web_routes_marker(self):
        open_url, _ = served(502, ENGINE_ERROR)
        self.assertEqual(ask(URL, open_url), Answer(502, {"error": "engine_error"}))

    def test_a_body_that_is_not_json_is_none(self):
        open_url, _ = served(502, b"<html>Bad Gateway</html>")
        self.assertEqual(ask(URL, open_url), Answer(502, None))

    def test_an_error_body_that_breaks_off_keeps_the_status(self):
        for error in (http.client.IncompleteRead(b'{"err'), TimeoutError("timed out")):
            with self.subTest(error=type(error).__name__):
                self.assertEqual(ask(URL, cut_short(error)), Answer(502, None))

    def test_no_connection_is_no_answer(self):
        self.assertEqual(ask(URL, unreachable), Answer(None, None))

    def test_a_garbled_http_answer_is_no_answer(self):
        self.assertEqual(ask(URL, garbled), Answer(None, None))


class ProblemsTest(unittest.TestCase):
    def test_the_installed_bundle_in_replay_passes(self):
        self.assertEqual(problems(Answer(200, SERVING), EXPECTED), [])

    def test_the_installed_bundle_in_live_mode_passes_when_live_is_expected(self):
        self.assertEqual(problems(Answer(200, LIVE), EXPECTED_LIVE), [])

    def test_live_mode_fails_where_replay_is_expected(self):
        self.assertEqual(
            problems(Answer(200, LIVE), EXPECTED), ["mode is 'live', expected 'replay'"]
        )

    def test_the_demo_fixtures_fail_on_every_field(self):
        self.assertEqual(
            problems(Answer(200, FIXTURES), EXPECTED),
            [
                "mode is 'mock', expected 'replay'",
                "snapshot is 'fixture', expected 'bundle-20261019-1'",
                "pages is 2, expected 120",
                "profiles is 2, expected 45",
            ],
        )

    def test_a_half_loaded_database_fails_on_its_counts(self):
        body = {**SERVING, "counts": {"pages": 120, "profiles": 44, "sources": 3}}
        self.assertEqual(problems(Answer(200, body), EXPECTED), ["profiles is 44, expected 45"])

    def test_the_web_routes_engine_error_fails_with_its_status_and_marker(self):
        open_url, _ = served(502, ENGINE_ERROR)
        self.assertEqual(
            problems(ask(URL, open_url), EXPECTED),
            ["/api/health answered HTTP 502 with error 'engine_error'"],
        )

    def test_an_error_status_without_json_fails(self):
        self.assertEqual(
            problems(Answer(502, None), EXPECTED),
            ["/api/health answered HTTP 502 with error None"],
        )

    def test_a_success_that_is_not_json_fails(self):
        self.assertEqual(
            problems(Answer(200, None), EXPECTED), ["/api/health did not answer with JSON"]
        )

    def test_no_answer_fails(self):
        self.assertEqual(problems(Answer(None, None), EXPECTED), ["/api/health did not answer"])


class ServingLineTest(unittest.TestCase):
    def test_names_the_mode_and_the_bundle(self):
        self.assertEqual(
            serving_line(URL, EXPECTED, SERVING),
            "https://demo.example.test serves bundle-20261019-1 in replay mode"
            " (120 pages, 45 profiles)",
        )

    def test_adds_status_uptime_and_failures_by_role_and_marker_when_health_reports_them(self):
        self.assertEqual(
            serving_line(URL, EXPECTED_LIVE, LIVE),
            "https://demo.example.test serves bundle-20261019-1 in live mode"
            " (120 pages, 45 profiles); status degraded, up 7260 s, failures in the last hour:"
            " 7 (expand budget 4, explain http_503 1, explain timeout 2)",
        )

    def test_leaves_out_values_that_are_not_contract_names_or_whole_numbers(self):
        odd_failures = {
            "explain\x1b[2J": {"timeout": 2},
            "brief": {"Timeout": 1, "late": True, "slow": 0, "lost": "2", "cut": 1.5},
            "agent": 3,
        }
        for failures_last_hour in (odd_failures, 2):
            odd = {
                **SERVING,
                "status": "ok\x1b[2J",
                "uptime_s": True,
                "failures_last_hour": failures_last_hour,
            }
            with self.subTest(failures_last_hour=failures_last_hour):
                self.assertEqual(
                    serving_line(URL, EXPECTED, odd),
                    "https://demo.example.test serves bundle-20261019-1 in replay mode"
                    " (120 pages, 45 profiles)",
                )


class WatchLineTest(unittest.TestCase):
    def test_a_passing_check_gives_time_mode_status_failures_and_milliseconds(self):
        self.assertEqual(
            watch_line(START, Answer(200, LIVE), 0.125, []),
            "2026-10-19T04:00:00Z http=200 mode=live status=degraded"
            " failures=expand.budget:4,explain.http_503:1,explain.timeout:2 125ms",
        )

    def test_a_failed_check_names_its_problems(self):
        self.assertEqual(
            watch_line(START, BAD_GATEWAY, 0.25, problems(BAD_GATEWAY, EXPECTED)),
            "2026-10-19T04:00:00Z http=502 mode=- status=- failures=- 250ms"
            " failed: /api/health answered HTTP 502 with error 'engine_error'",
        )

    def test_no_answer_shows_dashes(self):
        self.assertEqual(
            watch_line(START, DOWN, 5.0, ["/api/health did not answer"]),
            "2026-10-19T04:00:00Z http=- mode=- status=- failures=- 5000ms"
            " failed: /api/health did not answer",
        )


class WatchUntilDownTest(unittest.TestCase):
    def watch(self, time: FakeTime, checks: Checks, interval: float, max_failures: int):
        lines: list[str] = []
        watch = Watch(interval, max_failures)
        watch_until_down(URL, EXPECTED, watch, checks, time.clock(), lines.append)
        return lines

    def test_a_pass_resets_the_count_and_checks_keep_the_interval(self):
        time = FakeTime()
        checks = Checks(
            time,
            (Answer(200, SERVING), 0.125),
            (BAD_GATEWAY, 0.25),
            (Answer(200, SERVING), 0.5),
            (DOWN, 5.0),
            (DOWN, 5.0),
        )
        lines = self.watch(time, checks, interval=30, max_failures=2)
        bad_gateway = " failed: /api/health answered HTTP 502 with error 'engine_error'"
        no_answer = " failed: /api/health did not answer"
        self.assertEqual(
            lines,
            [
                "2026-10-19T04:00:00Z http=200 mode=replay status=- failures=- 125ms",
                "2026-10-19T04:00:30Z http=502 mode=- status=- failures=- 250ms" + bad_gateway,
                "2026-10-19T04:01:00Z http=200 mode=replay status=- failures=- 500ms",
                "2026-10-19T04:01:30Z http=- mode=- status=- failures=- 5000ms" + no_answer,
                "2026-10-19T04:02:00Z http=- mode=- status=- failures=- 5000ms" + no_answer,
            ],
        )
        self.assertEqual(time.sleeps, [29.875, 29.75, 29.5, 25.0])
        self.assertEqual(checks.urls, [URL] * 5)

    def test_a_check_slower_than_the_interval_is_followed_at_once(self):
        time = FakeTime()
        checks = Checks(time, (Answer(200, SERVING), 5.0), (DOWN, 0.125))
        lines = self.watch(time, checks, interval=2, max_failures=1)
        self.assertEqual(
            lines,
            [
                "2026-10-19T04:00:00Z http=200 mode=replay status=- failures=- 5000ms",
                "2026-10-19T04:00:05Z http=- mode=- status=- failures=- 125ms"
                " failed: /api/health did not answer",
            ],
        )
        self.assertEqual(time.sleeps, [0.0])


if __name__ == "__main__":
    unittest.main()
