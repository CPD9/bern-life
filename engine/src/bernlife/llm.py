"""Every model call in the engine goes through `connect(...).chat(...)`.

Adapted from CPD9/apertus-redteam-graph, track_1a/src/redteam/llm.py (Apache-2.0): its target and
red-team routes become the five engine roles. A call is answered from the cache when it can be, so
replay needs no GPU; only a miss in live mode reaches the model, and never more than
LLM_MAX_CONCURRENCY at once, so a batch cannot flood CSCS.
"""

import os
import threading
import time
from collections.abc import Callable, Mapping, Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol

from . import config
from .cache import (
    MODELS,
    CacheMiss,
    Message,
    append_audit,
    cache_key,
    cache_roots,
    entry_path,
    lookup,
    read_models,
    write_json,
)
from .llm_http import ModelUnavailable, OpenAIChat, Sleep, Transport, urlopen_transport

ROLES = ("expand", "enrich", "extract", "explain", "brief")
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

    def models(self) -> dict[str, str]:
        return dict.fromkeys(ROLES, MOCK_MODEL)


class Router:
    """Answers from the cache; on a miss, asks the live model if one is connected."""

    def __init__(
        self,
        client: OpenAIChat | None,
        models: Mapping[str, str],
        roots: Sequence[Path],
        *,
        max_concurrency: int = config.DEFAULT_MAX_CONCURRENCY,
        clock: Callable[[], float] = time.monotonic,
        now: Callable[[], datetime] = _utc_now,
    ) -> None:
        self.client, self.roots, self.clock, self.now = client, tuple(roots), clock, now
        self.backend = "replay" if client is None else "live"
        self._models = dict(models)
        self._slots = threading.BoundedSemaphore(max_concurrency)

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
        model = self._models[_check_role(role)]
        key = cache_key(model, messages, temperature, seed, max_tokens, prompt_version)
        entry = lookup(self.roots, key)
        if entry is not None:
            self._audit(role, model, key, "hit", 0)
            return entry["content"]
        if self.client is None:
            self._audit(role, model, key, "miss", 0)
            raise CacheMiss(f"{role} call not in cache ({key[:12]})")
        with self._slots:
            started = self.clock()
            try:
                content = self.client.chat(
                    model, messages, temperature=temperature, seed=seed, max_tokens=max_tokens
                )
            except ModelUnavailable as unavailable:
                self._audit(role, model, key, unavailable.marker, self._since(started))
                raise
        latency_ms = self._since(started)
        entry = {
            "role": role,
            "model": model,
            "prompt_version": prompt_version,
            "content": content,
            "latency_ms": latency_ms,
            "created_at": self.now().isoformat(),
        }
        write_json(entry_path(self.roots[0], key), entry)
        self._audit(role, model, key, "live", latency_ms)
        return content

    def _since(self, started: float) -> int:
        return round((self.clock() - started) * 1000)

    def _audit(self, role: str, model: str, key: str, outcome: str, ms: int) -> None:
        record = {"ts": self.now().isoformat(), "role": role, "model": model, "key": key}
        append_audit(self.roots[0], record | {"outcome": outcome, "ms": ms})


def connect(
    env: Mapping[str, str] = os.environ,
    transport: Transport = urlopen_transport,
    sleep: Sleep = time.sleep,
) -> Router | MockLLM:
    """Live if the endpoint answers, else replay from the cache, else the labelled MOCK.

    BERNLIFE_BACKEND forces a mode; a forced mode that cannot start raises instead of falling back.
    """
    mode = config.backend(env)
    if mode == "mock":
        return MockLLM()
    roots = cache_roots(config.data_dir(env))
    concurrency = config.max_concurrency(env)
    if mode != "replay":
        live = _live_router(env, roots, concurrency, transport, sleep, required=mode == "live")
        if live is not None:
            return live
    recorded = read_models(roots)
    if recorded is not None:
        return Router(None, recorded, roots, max_concurrency=concurrency)
    if mode == "replay":
        raise CacheMiss(f"no {MODELS} under {roots[0]} or {roots[1]}: nothing to replay")
    return MockLLM()


def _live_router(
    env: Mapping[str, str],
    roots: Sequence[Path],
    concurrency: int,
    transport: Transport,
    sleep: Sleep,
    *,
    required: bool,
) -> Router | None:
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
    return Router(client, models, roots, max_concurrency=concurrency)


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
