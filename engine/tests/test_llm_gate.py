import json
import os
import tempfile
import threading
import time
import unittest
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from pathlib import Path

from bernlife.cache import (
    CacheMiss,
    Message,
    append_audit,
    cache_key,
    cache_roots,
    entry_path,
)
from bernlife.config import ConfigError, call_budget
from bernlife.explain import explain_top
from bernlife.llm import ROLES, Router, connect
from bernlife.llm_gate import BudgetUsed, CallTally, answered_mode, request_mode, request_scope
from bernlife.llm_http import ModelUnavailable
from fake_llm import FakeTransport, models_body
from search_fakes import PROFILES

MODEL = "swiss-ai/Apertus-v1.5-70B"
NOON = datetime(2026, 10, 19, 12, 0, tzinfo=UTC)
ADA = PROFILES[1]
PLAIN = {"text": "Expertise: continuous glucose monitoring", "cites": ["/fields/expertise/0"]}
EXPLAINED = json.dumps({"text": "Works on continuous glucose monitoring.", "claims": [1]})


class CountingClient:
    """A live endpoint that answers every call, or fails with `marker`, counting the calls."""

    def __init__(self, reply: str = "ok", marker: str | None = None, pause: float = 0.0) -> None:
        self.reply, self.marker, self.pause = reply, marker, pause
        self.calls = 0
        self.lock = threading.Lock()

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
            self.calls += 1
        time.sleep(self.pause)
        if self.marker is not None:
            raise ModelUnavailable(self.marker)
        return self.reply


class BrokenClient:
    """A live endpoint whose every call breaks with an error that is no failure marker."""

    def chat(
        self,
        model: str,
        messages: Sequence[Message],
        *,
        temperature: float,
        seed: int | None,
        max_tokens: int,
    ) -> str:
        raise LookupError("provider-internal-detail")


def ask(router: Router, text: str, role: str = "expand") -> str:
    return router.chat([{"role": "user", "content": text}], role=role, prompt_version="v1")


class GateTest(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.roots = cache_roots(Path(tmp.name))
        self.at = NOON

    def router(
        self,
        client: CountingClient | None,
        *,
        serving: bool = False,
        budget: int | None = None,
        max_concurrency: int = 4,
    ) -> Router:
        return Router(
            client,
            dict.fromkeys(ROLES, MODEL),
            self.roots,
            max_concurrency=max_concurrency,
            now=lambda: self.at,
            serving=serving,
            budget=budget,
        )

    def outcomes(self) -> list[str]:
        lines = (self.roots[0] / "audit.jsonl").read_text().splitlines()
        return [json.loads(line)["outcome"] for line in lines]

    def test_serving_without_a_scope_never_calls_the_model(self) -> None:
        client = CountingClient()
        router = self.router(client, serving=True, budget=10)
        with self.assertRaises(CacheMiss):
            ask(router, "glucose")
        self.assertEqual((client.calls, self.outcomes()), (0, ["miss"]))
        self.assertEqual(router.budget_status(), {"limit": 10, "used": 0})

    def test_a_live_scope_may_call_the_model_and_tallies_each_call(self) -> None:
        client = CountingClient()
        router = self.router(client, serving=True, budget=10)
        with request_scope(live=True) as tally:
            self.assertEqual((ask(router, "glucose"), ask(router, "glucose")), ("ok", "ok"))
        with request_scope(live=False) as cache_only, self.assertRaises(CacheMiss):
            ask(router, "insulin")
        self.assertEqual(tally, CallTally(hits=1, live=1))
        self.assertEqual(cache_only, CallTally(misses=1))
        self.assertEqual(client.calls, 1)
        self.assertEqual(self.outcomes(), ["live", "hit", "miss"])

    def test_a_cache_only_scope_holds_for_a_command_too(self) -> None:
        client = CountingClient()
        router = self.router(client)
        with request_scope(live=False), self.assertRaises(CacheMiss):
            ask(router, "glucose")
        self.assertEqual(client.calls, 0)
        self.assertEqual(ask(router, "glucose"), "ok")
        self.assertEqual(client.calls, 1)

    def test_a_live_engine_answers_as_replay_unless_a_call_went_live(self) -> None:
        router = self.router(CountingClient(), serving=True, budget=10)
        with request_scope(live=True):
            ask(router, "glucose")
            went_live = request_mode("live")
        with request_scope(live=True):
            ask(router, "glucose")
            from_cache = request_mode("live")
        with request_scope(live=False):
            cache_only = [request_mode(backend) for backend in ("live", "replay", "mock")]
        self.assertEqual((went_live, from_cache), ("live", "replay"))
        self.assertEqual(cache_only, ["replay", "replay", "mock"])
        self.assertEqual(request_mode("live"), "live")
        self.assertEqual([answered_mode("live", n) for n in (0, 2)], ["replay", "live"])

    def test_a_call_that_breaks_unexpectedly_is_audited_and_spent(self) -> None:
        router = self.router(BrokenClient(), budget=2)
        with self.assertRaises(LookupError):
            ask(router, "glucose")
        self.assertEqual(self.outcomes(), ["engine_error"])
        self.assertEqual(router.recent_failures(), {"expand": {"engine_error": 1}})
        self.assertEqual(
            self.router(CountingClient(), budget=2).budget_status(), {"limit": 2, "used": 1}
        )

    def test_a_reply_that_cannot_be_stored_is_still_spent(self) -> None:
        key = cache_key(MODEL, [{"role": "user", "content": "glucose"}], 0.0, None, 700, "v1")
        entry = entry_path(self.roots[0], key)
        # A folder in the place of write_json's temporary file makes the write fail.
        entry.with_name(f"{entry.name}.{os.getpid()}-{threading.get_ident()}.tmp").mkdir(
            parents=True
        )
        with self.assertRaises(OSError):
            ask(self.router(CountingClient(), budget=2), "glucose")
        self.assertEqual(self.outcomes(), ["live"])
        self.assertEqual(
            self.router(CountingClient(), budget=2).budget_status(), {"limit": 2, "used": 1}
        )

    def test_explain_threads_keep_the_request_scope(self) -> None:
        results = [{"rank": n, "profile": ADA, "reason": PLAIN} for n in range(1, 6)]
        questions = [f"glucose sensors {n}" for n in range(5)]
        client = CountingClient(EXPLAINED)
        with request_scope(live=False) as tally:
            _, outcomes = explain_top(self.router(client), results, questions)
        self.assertEqual((outcomes, client.calls, tally.misses), (["cache_miss"] * 5, 0, 5))
        with request_scope(live=True) as tally:
            _, outcomes = explain_top(self.router(client, serving=True), results, questions)
        self.assertEqual((outcomes, client.calls, tally.live), (["kept"] * 5, 5, 5))

    def test_the_budget_refuses_calls_over_the_cap_until_the_next_utc_day(self) -> None:
        client = CountingClient()
        router = self.router(client, budget=2)
        ask(router, "one")
        ask(router, "two")
        with self.assertRaises(CacheMiss) as raised:
            ask(router, "three")
        key = cache_key(MODEL, [{"role": "user", "content": "three"}], 0.0, None, 700, "v1")
        self.assertEqual(
            str(raised.exception),
            f"expand call not in cache and today's budget is used ({key[:12]})",
        )
        # A caller tells a spent budget from a brief nobody recorded, both plain misses otherwise.
        self.assertIsInstance(raised.exception, BudgetUsed)
        self.assertEqual((client.calls, self.outcomes()), (2, ["live", "live", "budget"]))
        self.assertEqual(router.budget_status(), {"limit": 2, "used": 2})
        self.at = NOON + timedelta(hours=12)
        self.assertEqual(router.budget_status(), {"limit": 2, "used": 0})
        self.assertEqual(ask(router, "three"), "ok")

    def test_the_days_count_is_read_back_from_the_audit(self) -> None:
        yesterday = NOON - timedelta(days=1)
        for at, outcome in (
            (NOON, "live"),
            (NOON - timedelta(hours=11), "http_500"),
            (NOON, "hit"),
            (NOON, "miss"),
            (NOON, "budget"),
            (yesterday, "live"),
        ):
            append_audit(self.roots[0], {"ts": at.isoformat(), "outcome": outcome})
        with (self.roots[0] / "audit.jsonl").open("a") as audit:
            audit.write('{"ts": "2026-10-19T12:00:00+00:00", "outco')
        self.assertEqual(
            self.router(CountingClient(), budget=5).budget_status(), {"limit": 5, "used": 2}
        )
        self.assertIsNone(self.router(None, budget=5).budget_status())
        self.assertIsNone(self.router(CountingClient()).budget_status())

    def test_parallel_calls_cannot_overshoot_the_budget(self) -> None:
        client = CountingClient(pause=0.05)
        router = self.router(client, budget=3, max_concurrency=12)
        refused: list[str] = []

        def call(n: int) -> None:
            try:
                ask(router, f"query {n}")
            except CacheMiss:
                refused.append(str(n))

        threads = [threading.Thread(target=call, args=(n,)) for n in range(12)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(5)
        self.assertEqual((client.calls, len(refused)), (3, 9))
        self.assertEqual(router.budget_status(), {"limit": 3, "used": 3})

    def test_recent_failures_are_markers_by_role_within_the_window(self) -> None:
        failing = self.router(CountingClient(marker="timeout"))
        self.at = NOON - timedelta(hours=2)
        with self.assertRaises(ModelUnavailable):
            ask(failing, "old", role="extract")
        self.at = NOON
        for text, role in (("a", "explain"), ("b", "explain"), ("c", "agent")):
            with self.assertRaises(ModelUnavailable):
                ask(failing, text, role)
        with request_scope(live=False), self.assertRaises(CacheMiss):
            ask(failing, "d")
        self.assertEqual(
            failing.recent_failures(), {"agent": {"timeout": 1}, "explain": {"timeout": 2}}
        )
        self.assertEqual(
            failing.recent_failures(3 * 3600),
            {"agent": {"timeout": 1}, "explain": {"timeout": 2}, "extract": {"timeout": 1}},
        )


class BudgetSettingTest(unittest.TestCase):
    def test_the_server_fails_closed_and_a_command_keeps_no_cap(self) -> None:
        cases = [
            ({}, True, 0),
            ({"LLM_CALL_BUDGET": "many"}, True, 0),
            ({"LLM_CALL_BUDGET": " 25 "}, True, 25),
            ({}, False, None),
            ({"LLM_CALL_BUDGET": "0"}, False, 0),
            ({"LLM_CALL_BUDGET": "25"}, False, 25),
        ]
        for env, serving, budget in cases:
            with self.subTest(env=env, serving=serving):
                self.assertEqual(call_budget(env, serving=serving), budget)
        with self.assertRaisesRegex(ConfigError, "LLM_CALL_BUDGET"):
            call_budget({"LLM_CALL_BUDGET": "-1"}, serving=False)

    def test_connect_for_serving_starts_cache_only_with_the_budget(self) -> None:
        with tempfile.TemporaryDirectory() as data:
            env = {"BERNLIFE_DATA_DIR": data, "LLM_BASE_URL": "https://gateway.example/v1"}
            env |= {"LLM_MODEL": MODEL}
            serving = connect(env, FakeTransport(models_body(MODEL)), serving=True)
            capped = connect(
                env | {"LLM_CALL_BUDGET": "25"}, FakeTransport(models_body(MODEL)), serving=True
            )
            command = connect(env, FakeTransport(models_body(MODEL)))
        self.assertIsInstance(serving, Router)
        self.assertIsInstance(command, Router)
        self.assertEqual(
            (serving.serving, serving.budget_status()), (True, {"limit": 0, "used": 0})
        )
        self.assertEqual(capped.budget_status(), {"limit": 25, "used": 0})
        self.assertEqual((command.serving, command.budget_status()), (False, None))


if __name__ == "__main__":
    unittest.main()
