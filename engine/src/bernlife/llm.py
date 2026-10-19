"""Every model call in the engine goes through `connect(...)`: `chat` for text, `chat_tools` for
the agent's tool calls.

Adapted from CPD9/apertus-redteam-graph, track_1a/src/redteam/llm.py (Apache-2.0): its target and
red-team routes become the engine roles. A call is answered from the cache when it can be, so
replay needs no GPU; only a miss that may go live reaches the model, and never more than
LLM_MAX_CONCURRENCY at once, so a batch cannot flood CSCS. Whether a miss may go live, and how
many may today, is llm_gate.py's.
"""

import os
import threading
import time
from collections.abc import Callable, Mapping, Sequence
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Protocol

from . import config, paths
from .cache import (
    MODELS,
    CacheMiss,
    Entry,
    Message,
    append_audit,
    cache_key,
    cache_roots,
    entry_path,
    lookup,
    read_models,
    write_json,
)
from .llm_gate import DailyBudget, FailureLog, count_call, is_failure, may_go_live
from .llm_http import ModelUnavailable, OpenAIChat, Sleep, Transport, urlopen_transport

ROLES = ("expand", "enrich", "extract", "explain", "brief", "agent")
MOCK_MODEL = "MOCK-no-model"


class Chat(Protocol):
    backend: str

    def chat(
        self,
        messages: Sequence[Message],
        *,
        role: str,
        prompt_version: str,
        temperature: float = 0.0,
        seed: int | None = None,
        max_tokens: int = 700,
    ) -> str: ...

    def models(self) -> dict[str, str]: ...


class ToolChat(Chat, Protocol):
    def chat_tools(
        self,
        messages: Sequence[Mapping[str, Any]],
        *,
        role: str,
        prompt_version: str,
        tools: Sequence[Mapping[str, Any]],
        max_tokens: int = 700,
        temperature: float = 0.0,
        seed: int | None = None,
    ) -> dict[str, Any]: ...


def _check_role(role: str) -> str:
    if role not in ROLES:
        raise ValueError(f"unknown role {role!r}; roles are {', '.join(ROLES)}")
    return role


def _utc_now() -> datetime:
    return datetime.now(UTC)


class MockLLM:
    """Stands in when no model is connected so the engine runs anywhere; every reply says MOCK.
    It bypasses the cache, so a mock answer can never be replayed as a model's."""

    backend = "mock"

    def chat(
        self,
        messages: Sequence[Message],
        *,
        role: str,
        prompt_version: str,
        temperature: float = 0.0,
        seed: int | None = None,
        max_tokens: int = 700,
    ) -> str:
        return f"[MOCK] {_check_role(role)}: no model is connected."

    def chat_tools(
        self,
        messages: Sequence[Mapping[str, Any]],
        *,
        role: str,
        prompt_version: str,
        tools: Sequence[Mapping[str, Any]],
        max_tokens: int = 700,
        temperature: float = 0.0,
        seed: int | None = None,
    ) -> dict[str, Any]:
        content = self.chat([], role=role, prompt_version=prompt_version)
        return {"content": content, "tool_calls": []}

    def models(self) -> dict[str, str]:
        return dict.fromkeys(ROLES, MOCK_MODEL)

    def recent_failures(self, window_s: int = 3600) -> dict[str, dict[str, int]]:
        return {}

    def budget_status(self) -> dict[str, int] | None:
        return None


class Router:
    """Answers from the cache; on a miss, asks the live model if one is connected and the call may
    go live: inside a request scope as the scope says, outside one only when not serving."""

    def __init__(
        self,
        client: OpenAIChat | None,
        models: Mapping[str, str],
        roots: Sequence[Path],
        *,
        max_concurrency: int = config.DEFAULT_MAX_CONCURRENCY,
        clock: Callable[[], float] = time.monotonic,
        now: Callable[[], datetime] = _utc_now,
        serving: bool = False,
        budget: int | None = None,
    ) -> None:
        self.client, self.roots, self.clock, self.now = client, tuple(roots), clock, now
        self.backend = "replay" if client is None else "live"
        self.serving = serving
        self._models = dict(models)
        self._slots = threading.BoundedSemaphore(max_concurrency)
        self._failures = FailureLog()
        self._budget = (
            None if client is None or budget is None else DailyBudget(budget, self.roots[0], now)
        )

    def models(self) -> dict[str, str]:
        return dict(self._models)

    def chat(
        self,
        messages: Sequence[Message],
        *,
        role: str,
        prompt_version: str,
        temperature: float = 0.0,
        seed: int | None = None,
        max_tokens: int = 700,
    ) -> str:
        model = self._model(role)
        key = cache_key(model, messages, temperature, seed, max_tokens, prompt_version)

        def ask(client: OpenAIChat) -> dict[str, Any]:
            content = client.chat(
                model, messages, temperature=temperature, seed=seed, max_tokens=max_tokens
            )
            return {"content": content}

        return self._answer(role, model, key, prompt_version, ask)["content"]

    def chat_tools(
        self,
        messages: Sequence[Mapping[str, Any]],
        *,
        role: str,
        prompt_version: str,
        tools: Sequence[Mapping[str, Any]],
        max_tokens: int = 700,
        temperature: float = 0.0,
        seed: int | None = None,
    ) -> dict[str, Any]:
        """{"content": str | None, "tool_calls": [{"id", "name", "arguments"}]}, cached like
        `chat` with the tools in the key."""
        model = self._model(role)
        key = cache_key(model, messages, temperature, seed, max_tokens, prompt_version, tools)

        def ask(client: OpenAIChat) -> dict[str, Any]:
            reply = client.chat_tools(
                model,
                messages,
                tools=tools,
                temperature=temperature,
                seed=seed,
                max_tokens=max_tokens,
            )
            # A bundle's pack check reads every entry's content as text.
            return {"content": reply["content"] or "", "tool_calls": reply["tool_calls"]}

        entry = self._answer(role, model, key, prompt_version, ask)
        return {"content": entry["content"] or None, "tool_calls": entry["tool_calls"]}

    def recent_failures(self, window_s: int = 3600) -> dict[str, dict[str, int]]:
        """Failure markers per role in the last `window_s` seconds."""
        return self._failures.since(self.now() - timedelta(seconds=window_s))

    def budget_status(self) -> dict[str, int] | None:
        """Today's live calls against the cap; None when nothing can go live or nothing caps it."""
        return None if self._budget is None else self._budget.status()

    def _model(self, role: str) -> str:
        """A role the recorded run never used has no model id, so none of its calls can be in the
        cache: bundles recorded before the agent have no `agent`."""
        model = self._models.get(_check_role(role))
        if model is None:
            count_call("miss")
            raise CacheMiss(f"no recorded model for {role}")
        return model

    def _answer(
        self,
        role: str,
        model: str,
        key: str,
        prompt_version: str,
        ask: Callable[[OpenAIChat], dict[str, Any]],
    ) -> Entry:
        entry = lookup(self.roots, key)
        if entry is not None:
            self._audit(role, model, key, "hit", 0)
            return entry
        client = self.client if may_go_live(self.serving) else None
        if client is None:
            self._audit(role, model, key, "miss", 0)
            raise CacheMiss(f"{role} call not in cache ({key[:12]})")
        if self._budget is not None and not self._budget.reserve():
            self._audit(role, model, key, "budget", 0)
            raise CacheMiss(f"{role} call not in cache and today's budget is used ({key[:12]})")
        with self._slots:
            started = self.clock()
            try:
                reply = ask(client)
            except ModelUnavailable as unavailable:
                self._audit(role, model, key, unavailable.marker, self._since(started))
                raise
        latency_ms = self._since(started)
        entry = {
            "role": role,
            "model": model,
            "prompt_version": prompt_version,
            **reply,
            "latency_ms": latency_ms,
            "created_at": self.now().isoformat(),
        }
        write_json(entry_path(self.roots[0], key), entry)
        self._audit(role, model, key, "live", latency_ms)
        return entry

    def _since(self, started: float) -> int:
        return round((self.clock() - started) * 1000)

    def _audit(self, role: str, model: str, key: str, outcome: str, ms: int) -> None:
        at = self.now()
        record = {"ts": at.isoformat(), "role": role, "model": model, "key": key}
        append_audit(self.roots[0], record | {"outcome": outcome, "ms": ms})
        count_call(outcome)
        if is_failure(outcome):
            self._failures.record(at, role, outcome)


def connect(
    env: Mapping[str, str] = os.environ,
    transport: Transport = urlopen_transport,
    sleep: Sleep = time.sleep,
    *,
    serving: bool = False,
) -> Router | MockLLM:
    """Live if the endpoint answers, else replay from the cache, else the labelled MOCK.

    BERNLIFE_BACKEND forces a mode; a forced mode that cannot start raises instead of falling back.
    `serving` (the API server) keeps calls in the cache outside a live request scope and reads the
    budget the server's way (config.call_budget).
    """
    mode = config.backend(env)
    if mode == "mock":
        return MockLLM()
    roots = cache_roots(paths.data_dir(env))
    concurrency = config.max_concurrency(env)
    if mode != "replay":
        live = _live_route(env, roots, transport, sleep, required=mode == "live")
        if live is not None:
            client, models = live
            budget = config.call_budget(env, serving=serving)
            return Router(
                client,
                models,
                roots,
                max_concurrency=concurrency,
                serving=serving,
                budget=budget,
            )
    recorded = read_models(roots)
    if recorded is not None:
        return Router(None, recorded, roots, max_concurrency=concurrency, serving=serving)
    if mode == "replay":
        raise CacheMiss(f"no {MODELS} under {roots[0]} or {roots[1]}: nothing to replay")
    return MockLLM()


def _live_route(
    env: Mapping[str, str],
    roots: Sequence[Path],
    transport: Transport,
    sleep: Sleep,
    *,
    required: bool,
) -> tuple[OpenAIChat, dict[str, str]] | None:
    endpoint = config.llm_endpoint(env)
    if endpoint is None:
        if required:
            raise config.ConfigError(
                "BERNLIFE_BACKEND=live needs EXPAND_LLM_BASE_URL or LLM_BASE_URL"
            )
        return None
    client = OpenAIChat(endpoint, transport, sleep)
    try:
        served = client.served_models()
    except ModelUnavailable:
        if required:
            raise
        return None
    models = dict.fromkeys(ROLES, _pick_model(endpoint.model, served))
    if read_models(roots[:1]) != models:
        write_json(roots[0] / MODELS, models)
    return client, models


def _pick_model(configured: str, served: Sequence[str]) -> str:
    """CSCS serves many models, so a configured name must be among them; a vLLM server serves
    one, which is used when no name is configured."""
    if configured:
        if configured in served:
            return configured
        raise ModelUnavailable("model_not_served")
    if len(served) == 1:
        return served[0]
    raise config.ConfigError(f"set the model name: the endpoint serves {len(served)} models")
