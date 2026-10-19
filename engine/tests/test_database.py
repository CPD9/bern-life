import unittest

import psycopg
from bernlife.database import connect_when_ready

URL = "postgresql://demo@127.0.0.1:5433/demo"


class Opener:
    """Refuses the first `failures` connections, then answers with a marker object."""

    def __init__(self, failures: int):
        self.failures = failures
        self.urls: list[str] = []

    def __call__(self, url: str) -> object:
        self.urls.append(url)
        if len(self.urls) <= self.failures:
            raise psycopg.OperationalError("connection refused")
        return "connection"


class ConnectWhenReadyTest(unittest.TestCase):
    def test_waits_through_a_slow_start_and_returns_the_connection(self):
        opener, sleeps = Opener(failures=2), []
        conn = connect_when_ready(URL, 5, 2.0, opener, sleeps.append)
        self.assertEqual(conn, "connection")
        self.assertEqual(opener.urls, [URL, URL, URL])
        self.assertEqual(sleeps, [2.0, 2.0])

    def test_the_last_failure_raises_after_every_attempt(self):
        opener, sleeps = Opener(failures=3), []
        with self.assertRaises(psycopg.OperationalError):
            connect_when_ready(URL, 3, 2.0, opener, sleeps.append)
        self.assertEqual(len(opener.urls), 3)
        self.assertEqual(sleeps, [2.0, 2.0])

    def test_other_errors_are_not_retried(self):
        def bad_url(url: str) -> object:
            raise psycopg.ProgrammingError("invalid connection string")

        sleeps: list[float] = []
        with self.assertRaises(psycopg.ProgrammingError):
            connect_when_ready(URL, 3, 2.0, bad_url, sleeps.append)
        self.assertEqual(sleeps, [])


if __name__ == "__main__":
    unittest.main()
