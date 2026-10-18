import unittest

from infra.wait_ready import Clock, ready_line, wait

URL = "http://127.0.0.1:3000"
LOADED = {"snapshot": "bundle-20261018-1", "counts": {"pages": 9, "profiles": 7, "sources": 3}}


class FakeTime:
    def __init__(self):
        self.now = 0.0
        self.sleeps: list[float] = []

    def clock(self) -> Clock:
        return Clock(now=lambda: self.now, sleep=self.sleep)

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


class Answers:
    def __init__(self, *answers: dict[str, object] | None):
        self.answers = list(answers)
        self.urls: list[str] = []

    def __call__(self, url: str) -> dict[str, object] | None:
        self.urls.append(url)
        return self.answers.pop(0) if len(self.answers) > 1 else self.answers[0]


class ReadyLineTest(unittest.TestCase):
    def test_a_loaded_snapshot_gives_the_url_line(self):
        self.assertEqual(
            ready_line(URL, LOADED),
            "Bern Life is ready on http://127.0.0.1:3000 (snapshot bundle-20261018-1, 7 profiles)",
        )

    def test_no_snapshot_loaded_is_not_ready(self):
        self.assertIsNone(ready_line(URL, {**LOADED, "snapshot": "none"}))

    def test_an_error_marker_is_not_ready(self):
        self.assertIsNone(ready_line(URL, {"error": "engine_unavailable"}))


class WaitTest(unittest.TestCase):
    def test_waits_through_failures_until_the_snapshot_answers(self):
        fake, probe = FakeTime(), Answers(None, {"error": "engine_unavailable"}, LOADED)
        line = wait(URL, timeout=60, probe=probe, clock=fake.clock())
        self.assertEqual(
            line,
            "Bern Life is ready on http://127.0.0.1:3000 (snapshot bundle-20261018-1, 7 profiles)",
        )
        self.assertEqual(probe.urls, [URL, URL, URL])
        self.assertEqual(fake.sleeps, [2.0, 2.0])

    def test_gives_up_at_the_timeout(self):
        fake, probe = FakeTime(), Answers(None)
        self.assertIsNone(wait(URL, timeout=5, probe=probe, clock=fake.clock()))
        self.assertEqual(fake.sleeps, [2.0, 2.0, 2.0])
        self.assertEqual(len(probe.urls), 4)


if __name__ == "__main__":
    unittest.main()
