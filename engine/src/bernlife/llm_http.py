"""The HTTP side of model calls: one OpenAI-compatible endpoint, retries, and fail-closed markers.

Adapted from CPD9/apertus-redteam-graph, track_1a/src/redteam/llm.py (Apache-2.0).

A provider's error text can carry request details or internals, so it is never stored, raised or
logged. Callers get `ModelUnavailable` with a marker (`timeout`, `http_<status>`, `bad_json`,
`unreachable`, `model_not_served`). Markers are raised outside `except` blocks so no provider
exception rides along as `__context__`.
"""

import http.client
import json
import time
import urllib.error
import urllib.request
from collections.abc import Callable, Mapping, Sequence
from typing import Any

from .cache import Message
from .config import Endpoint

CALL_TIMEOUT = 120.0
PROBE_TIMEOUT = 5.0
BACKOFF = (1.0, 2.0)  # seconds before the second and the third try

Transport = Callable[[urllib.request.Request, float], bytes]
Sleep = Callable[[float], None]


class ModelUnavailable(RuntimeError):
    def __init__(self, marker: str) -> None:
        super().__init__(marker)
        self.marker = marker


def urlopen_transport(request: urllib.request.Request, timeout: float) -> bytes:
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


class OpenAIChat:
    """CSCS through the event gateway, or vLLM over a loopback tunnel."""

    def __init__(self, endpoint: Endpoint, transport: Transport, sleep: Sleep = time.sleep) -> None:
        self.endpoint, self.transport, self.sleep = endpoint, transport, sleep

    def served_models(self) -> list[str]:
        listing = self._call("/models", None, PROBE_TIMEOUT)
        return _field(listing, lambda body: [model["id"] for model in body["data"]])

    def chat(
        self,
        model: str,
        messages: Sequence[Message],
        *,
        temperature: float,
        seed: int | None,
        max_tokens: int,
    ) -> str:
        request = _completion(model, messages, temperature, seed, max_tokens)
        reply = self._call("/chat/completions", request, CALL_TIMEOUT)
        return _field(reply, lambda body: body["choices"][0]["message"]["content"] or "")

    def chat_tools(
        self,
        model: str,
        messages: Sequence[Mapping[str, Any]],
        *,
        tools: Sequence[Mapping[str, Any]],
        temperature: float,
        seed: int | None,
        max_tokens: int,
    ) -> dict[str, Any]:
        """The model's message: its text, if any, and its tool calls with parsed arguments."""
        request = _completion(model, messages, temperature, seed, max_tokens)
        request["tools"] = list(tools)
        reply = self._call("/chat/completions", request, CALL_TIMEOUT)
        return _field(reply, lambda body: _tool_reply(body["choices"][0]["message"]))

    def _call(self, path: str, body: dict[str, Any] | None, timeout: float) -> Any:
        headers = {"Content-Type": "application/json"}
        if self.endpoint.api_key:
            headers["Authorization"] = f"Bearer {self.endpoint.api_key}"
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(self.endpoint.base_url + path, data, headers)
        outcome = self._attempt(request, timeout)
        for delay in BACKOFF:
            if not (isinstance(outcome, str) and _retryable(outcome)):
                break
            self.sleep(delay)
            outcome = self._attempt(request, timeout)
        if isinstance(outcome, str):
            raise ModelUnavailable(outcome)
        return _field(outcome, json.loads)

    def _attempt(self, request: urllib.request.Request, timeout: float) -> bytes | str:
        """The response body, or the marker that stands in for the failure."""
        try:
            return self.transport(request, timeout)
        except urllib.error.HTTPError as error:
            error.close()
            return f"http_{error.code}"
        except TimeoutError:
            return "timeout"
        except urllib.error.URLError as error:
            return "timeout" if isinstance(error.reason, TimeoutError) else "unreachable"
        except (OSError, http.client.HTTPException):
            return "unreachable"


def _completion(
    model: str,
    messages: Sequence[Mapping[str, Any]],
    temperature: float,
    seed: int | None,
    max_tokens: int,
) -> dict[str, Any]:
    request: dict[str, Any] = {
        "model": model,
        "messages": list(messages),
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if seed is not None:
        request["seed"] = seed
    return request


def _tool_reply(message: Mapping[str, Any]) -> dict[str, Any]:
    content = message.get("content")
    if not (content is None or isinstance(content, str)):
        raise TypeError("content")
    calls = [_tool_call(call) for call in message.get("tool_calls") or []]
    return {"content": content, "tool_calls": calls}


def _tool_call(call: Mapping[str, Any]) -> dict[str, Any]:
    """OpenAI sends the arguments as a JSON string; an empty one means none."""
    function = call["function"]
    arguments = function.get("arguments") or "{}"
    if isinstance(arguments, str):
        arguments = json.loads(arguments)
    if not (isinstance(call["id"], str) and isinstance(function["name"], str)):
        raise TypeError("tool call")
    if not isinstance(arguments, dict):
        raise TypeError("arguments")
    return {"id": call["id"], "name": function["name"], "arguments": arguments}


def _retryable(marker: str) -> bool:
    return marker == "http_429" or marker.startswith("http_5")


def _field(value: Any, read: Callable[[Any], Any]) -> Any:
    try:
        return read(value)
    except (ValueError, KeyError, IndexError, TypeError, AttributeError):
        pass
    raise ModelUnavailable("bad_json")
