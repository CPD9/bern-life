"""The agent model's message read as one step of a turn: tool calls to run, or its answer.

An endpoint that passes OpenAI `tools` on may return native tool calls, and those are taken first.
One that does not (the Keera gateway answers in plain text) still carries the JSON step protocol of
agent_prompt.py, read here with the llm_json helpers: {"tool": ...} is one call and {"answer": ...}
ends the turn. Text that holds no step is no answer, and the turn falls back to a plain search.

A JSON step goes back to the model as the object it was read as, and the tool's output as the next
user message, {"result": ...}: without native tools there is no tool role to carry it. Earlier
assistant turns go to the model as JSON answers too, so the conversation keeps one format; they
come from the browser, and nothing in them counts as a source.
"""

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from bernlife.llm_json import lenient_json, parse_json


@dataclass(frozen=True)
class Answer:
    text: str
    actions: tuple[Any, ...]


@dataclass(frozen=True)
class ToolStep:
    """Each call is {"name", "arguments"}, with the "id" a native call carries."""

    calls: tuple[Mapping[str, Any], ...]
    content: str | None
    native: bool

    def messages(self, outputs: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
        """The step and the tools' outputs, in order, as the conversation goes on."""
        if not self.native:
            (call,), (output,) = self.calls, outputs
            step = {"tool": call["name"], **call["arguments"]}
            return [
                {"role": "assistant", "content": _json(step)},
                {"role": "user", "content": _json({"result": output})},
            ]
        replies = [
            {"role": "tool", "tool_call_id": call["id"], "content": _json(output)}
            for call, output in zip(self.calls, outputs, strict=True)
        ]
        return [self._native_turn(), *replies]

    def _native_turn(self) -> dict[str, Any]:
        """The model's message as it is sent back, its arguments as the JSON text OpenAI uses."""
        calls = [
            {
                "id": call["id"],
                "type": "function",
                "function": {
                    "name": call["name"],
                    "arguments": json.dumps(call["arguments"], ensure_ascii=False, sort_keys=True),
                },
            }
            for call in self.calls
        ]
        return {"role": "assistant", "content": self.content, "tool_calls": calls}


def read_step(message: Mapping[str, Any]) -> ToolStep | Answer | None:
    """Native tool calls; else the JSON step in the text; None when there is neither."""
    if message["tool_calls"]:
        return ToolStep(tuple(message["tool_calls"]), message["content"], native=True)
    step = _first_object(message["content"] or "")
    if step is None:
        return None
    if "tool" in step:
        arguments = {key: value for key, value in sorted(step.items()) if key != "tool"}
        return ToolStep(({"name": step["tool"], "arguments": arguments},), None, native=False)
    text, actions = step.get("answer"), step.get("actions", [])
    if not isinstance(text, str):
        return None
    return Answer(text, tuple(actions) if isinstance(actions, list) else ())


def history(messages: Sequence[Mapping[str, str]]) -> list[dict[str, str]]:
    """The conversation so far as the model reads it: an earlier reply as the answer it gave."""
    return [
        {"role": "assistant", "content": _json({"answer": m["content"]})}
        if m["role"] == "assistant"
        else {"role": m["role"], "content": m["content"]}
        for m in messages
    ]


def _first_object(text: str) -> dict[str, Any] | None:
    for read in (parse_json, lenient_json):
        try:
            return read(text)
        except (ValueError, RecursionError):
            continue
    return None


def _json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False)
