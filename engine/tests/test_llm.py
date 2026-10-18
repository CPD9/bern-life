import json
import tempfile
import threading
import time
import unittest
import urllib.error
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path

from bernlife.cache import CacheMiss, Message, cache_roots, entry_path
from bernlife.config import Endpoint
from bernlife.llm import ROLES, MockLLM, Router
from bernlife.llm_http import ModelUnavailable, OpenAIChat
from fake_llm import FakeTransport, chat_body, http_error

MODEL = "swiss-ai/Apertus-v1.5-70B"
MESSAGES = [{"role": "user", "content": "Glukosesensoren in Bern"}]
REQUEST_SHA256 = "a2a30718ebee8cdfb44d090e2d1d1d7dbc650e6d06ab0139d13f59259e59b968"
SECRET = "SECRET-PROVIDER-TEXT"
NOON = datetime(2026, 10, 18, 12, 0, tzinfo=UTC)


class GateClient:
    """Holds every call until released, counting how many are inside at once."""

    def __init__(self) -> None:
        self.inside = self.most_inside = self.calls = 0
        self.lock = threading.Lock()
        self.release = threading.Event()

    def chat(
        self,
        model: str,
        messages: Sequence[Message],
        *,
        temperature: float,
        seed: int | None,
        max_tokens: int,
    ) -> str:
        with self.lock:
            self.inside += 1
            self.calls += 1
            self.most_inside = max(self.most_inside, self.inside)
        self.release.wait(5)
        with self.lock:
            self.inside -= 1
        return "ok"


class RouterTest(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.data = Path(tmp.name)
        self.roots = cache_roots(self.data)
        self.sleeps: list[float] = []

    def live(self, transport: FakeTransport, clock_values: Sequence[float] = (10.0, 10.25)):
        client = OpenAIChat(
            Endpoint("https://gateway.example/v1", "key", MODEL), transport, self.sleeps.append
        )
        models = dict.fromkeys(ROLES, MODEL)
        return Router(
            client, models, self.roots, clock=iter(clock_values).__next__, now=lambda: NOON
        )

    def audit_outcomes(self) -> list[str]:
        lines = (self.roots[0] / "audit.jsonl").read_text().splitlines()
        return [json.loads(line)["outcome"] for line in lines]

    def every_stored_text(self) -> str:
        return "".join(p.read_text() for p in self.data.rglob("*") if p.is_file())

    def test_replay_miss_raises_cache_miss(self) -> None:
        router = Router(None, dict.fromkeys(ROLES, MODEL), self.roots, now=lambda: NOON)
        with self.assertRaises(CacheMiss) as raised:
            router.chat(MESSAGES, role="expand", prompt_version="expand-v1")
        self.assertEqual(str(raised.exception), "expand call not in cache (a2a30718ebee)")
        self.assertEqual(self.audit_outcomes(), ["miss"])

    def test_live_call_is_stored_then_answered_without_the_client(self) -> None:
        transport = FakeTransport(chat_body("CGM; kontinuierliche Glukosemessung"))
        router = self.live(transport)
        first = router.chat(MESSAGES, role="expand", prompt_version="expand-v1")
        second = router.chat(MESSAGES, role="expand", prompt_version="expand-v1")
        self.assertEqual(first, "CGM; kontinuierliche Glukosemessung")
        self.assertEqual(second, first)
        self.assertEqual(len(transport.requests), 1)
        stored = json.loads(entry_path(self.roots[0], REQUEST_SHA256).read_text())
        self.assertEqual(
            stored,
            {
                "content": "CGM; kontinuierliche Glukosemessung",
                "created_at": "2026-10-18T12:00:00+00:00",
                "latency_ms": 250,
                "model": MODEL,
                "prompt_version": "expand-v1",
                "role": "expand",
            },
        )
        self.assertEqual(self.audit_outcomes(), ["live", "hit"])

    def test_mock_reply_is_labelled(self) -> None:
        mock = MockLLM()
        reply = mock.chat(MESSAGES, role="explain", prompt_version="explain-v1")
        self.assertEqual(reply, "[MOCK] explain: no model is connected.")
        self.assertEqual(mock.backend, "mock")
        self.assertEqual(mock.models(), dict.fromkeys(ROLES, "MOCK-no-model"))

    def test_unknown_role_is_refused(self) -> None:
        with self.assertRaises(ValueError):
            MockLLM().chat(MESSAGES, role="target", prompt_version="v1")

    def test_provider_error_leaves_only_the_marker(self) -> None:
        router = self.live(FakeTransport(*(http_error(500, SECRET) for _ in range(3))))
        with self.assertRaises(ModelUnavailable) as raised:
            router.chat(MESSAGES, role="extract", prompt_version="extract-v1")
        error = raised.exception
        self.assertEqual((error.marker, str(error)), ("http_500", "http_500"))
        self.assertNotIn(SECRET, repr(error))
        self.assertIsNone(error.__context__)
        self.assertIsNone(error.__cause__)
        self.assertNotIn(SECRET, self.every_stored_text())
        self.assertEqual(self.audit_outcomes(), ["http_500"])
        self.assertEqual(self.sleeps, [1.0, 2.0])
        self.assertFalse(entry_path(self.roots[0], REQUEST_SHA256).exists())

    def test_failures_become_markers_without_provider_text(self) -> None:
        cases = [
            (TimeoutError(SECRET), "timeout"),
            (urllib.error.URLError(TimeoutError(SECRET)), "timeout"),
            (urllib.error.URLError(ConnectionRefusedError(SECRET)), "unreachable"),
            (http_error(401, SECRET), "http_401"),
            (f"<html>{SECRET}</html>".encode(), "bad_json"),
            (json.dumps({"detail": SECRET}).encode(), "bad_json"),
        ]
        for step, marker in cases:
            with self.subTest(marker=marker, step=type(step).__name__):
                self.sleeps.clear()
                transport = FakeTransport(step)
                with self.assertRaises(ModelUnavailable) as raised:
                    self.live(transport).chat(MESSAGES, role="brief", prompt_version="brief-v1")
                self.assertEqual(str(raised.exception), marker)
                self.assertIsNone(raised.exception.__context__)
                self.assertEqual((len(transport.requests), self.sleeps), (1, []))
        self.assertNotIn(SECRET, self.every_stored_text())

    def test_server_errors_are_retried_with_backoff(self) -> None:
        transport = FakeTransport(http_error(503, SECRET), http_error(429, SECRET), chat_body("ok"))
        reply = self.live(transport).chat(MESSAGES, role="enrich", prompt_version="enrich-v1")
        self.assertEqual(reply, "ok")
        self.assertEqual((len(transport.requests), self.sleeps), (3, [1.0, 2.0]))

    def test_rate_limit_after_three_tries_is_the_marker(self) -> None:
        transport = FakeTransport(*(http_error(429, SECRET) for _ in range(3)))
        with self.assertRaises(ModelUnavailable) as raised:
            self.live(transport).chat(MESSAGES, role="enrich", prompt_version="enrich-v1")
        self.assertEqual(str(raised.exception), "http_429")
        self.assertEqual(len(transport.requests), 3)

    def test_concurrency_limit_holds(self) -> None:
        client = GateClient()
        router = Router(client, dict.fromkeys(ROLES, MODEL), self.roots, max_concurrency=4)
        calls = [
            threading.Thread(
                target=router.chat,
                args=([{"role": "user", "content": f"query {n}"}],),
                kwargs={"role": "expand", "prompt_version": "expand-v1"},
            )
            for n in range(12)
        ]
        for call in calls:
            call.start()
        deadline = time.monotonic() + 5
        while client.inside < 4 and time.monotonic() < deadline:
            time.sleep(0.01)
        time.sleep(0.1)
        self.assertEqual(client.inside, 4)
        client.release.set()
        for call in calls:
            call.join(5)
        self.assertEqual((client.most_inside, client.calls), (4, 12))


if __name__ == "__main__":
    unittest.main()
