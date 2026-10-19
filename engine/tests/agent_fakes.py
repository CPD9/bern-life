"""The agent's model as a script of replies and its tools as canned searches, for the agent tests.

Every name is invented (search_fakes.py). `step` and `answers` write the JSON step protocol a model
without native tools uses; `calls` writes native tool calls.
"""

import copy
import json
import unittest
from collections.abc import Mapping, Sequence
from importlib.metadata import version
from typing import Any

from bernlife.agent_prompt import AGENT_PROMPT_VERSION, TOOLS
from contract_schemas import validator
from search_fakes import PROFILES
from test_grounding import response, shown

MODEL = "swiss-ai/Apertus-v1.5-70B"
CLEO, ADA, BEN, DORA, PATCH, EMIL, CARB = PROFILES
QUESTION = "Who works on glucose sensors?"
GLUCOSE = response(
    "glucose sensors", shown(ADA, "/fields/expertise/0"), shown(CLEO, "/fields/expertise/0")
)
GLUCOSE_SUMMARY = (
    "Here is what the sources show:\n"
    "- Ada Muster: continuous glucose monitoring\n"
    "- Cleo Beispiel: glucose metabolism in mice"
)
ADA_MENTION = {"profile_id": "person-example-ada-muster", "name": "Ada Muster"}
CLEO_MENTION = {"profile_id": "person-demo-cleo-beispiel", "name": "Cleo Beispiel"}
BRIEF = "Invented Demo AG builds a skin-worn patch and needs wearable glucose sensors."
GLUCOSE_FOUND = [
    {
        "id": "person-example-ada-muster",
        "kind": "person",
        "name": "Ada Muster",
        "source": "example",
        "facts": ["continuous glucose monitoring"],
    },
    {
        "id": "person-demo-cleo-beispiel",
        "kind": "person",
        "name": "Cleo Beispiel",
        "source": "demo",
        "facts": ["glucose metabolism in mice"],
    },
]


def user(text: str) -> list[dict[str, str]]:
    return [{"role": "user", "content": text}]


def calls(*steps: tuple[str, dict[str, Any]]) -> dict[str, Any]:
    tool_calls = [
        {"id": f"call-{n}", "name": name, "arguments": arguments}
        for n, (name, arguments) in enumerate(steps, 1)
    ]
    return {"content": None, "tool_calls": tool_calls}


def says(text: str | None) -> dict[str, Any]:
    return {"content": text, "tool_calls": []}


def step(tool: str, **arguments: Any) -> dict[str, Any]:
    return says(json.dumps({"tool": tool, **arguments}))


def answers(text: str, actions: list[Any] | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"answer": text}
    if actions is not None:
        body["actions"] = actions
    return says(json.dumps(body))


class ScriptedChat:
    """The agent model as a script of replies, recording every conversation sent to it."""

    def __init__(
        self, *script: dict[str, Any] | Exception, model: str = "fake-70b", backend="replay"
    ) -> None:
        self.script, self.model, self.backend = list(script), model, backend
        self.seen: list[list[dict[str, Any]]] = []

    def chat(self, messages, *, role, prompt_version, temperature=0.0, seed=None, max_tokens=700):
        raise AssertionError("the agent asks only through chat_tools")

    def chat_tools(
        self, messages, *, role, prompt_version, tools, max_tokens=700, temperature=0.0, seed=None
    ):
        assert (role, prompt_version, tools) == ("agent", AGENT_PROMPT_VERSION, TOOLS)
        self.seen.append(copy.deepcopy(list(messages)))
        reply = self.script.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply

    def models(self) -> dict[str, str]:
        return {"agent": self.model}


class FakeTools:
    """Canned searches by query, an abstained one for any other; records every call."""

    def __init__(self, searches: Mapping[str, dict[str, Any]], brief: dict[str, Any] | None = None):
        self.searches, self.brief_response = searches, brief
        self.asked: list[tuple[str, object]] = []

    def search(self, query: str, kinds: Sequence[str] | None = None) -> dict[str, Any]:
        self.asked.append(("search", (query, kinds)))
        return copy.deepcopy(self.searches.get(query, response(query)))

    def brief(self, text: str) -> dict[str, Any]:
        self.asked.append(("brief", text))
        assert self.brief_response is not None
        return copy.deepcopy(self.brief_response)

    def profile(self, profile_id: str) -> dict[str, Any] | None:
        self.asked.append(("profile", profile_id))
        return next((p for p in PROFILES if p["id"] == profile_id), None)

    def snapshot(self) -> str:
        return "fixture-1"


def versions(prompts: str, models: dict[str, str]) -> dict[str, Any]:
    return {
        "engine": version("bernlife"),
        "snapshot": "fixture-1",
        "prompts": prompts,
        "models": models,
    }


class AgentCase(unittest.TestCase):
    def check(self, reply: dict[str, Any]) -> dict[str, Any]:
        """The reply, once it holds to contracts/agent.schema.json."""
        self.assertEqual(list(validator("agent.schema.json").iter_errors(reply)), [])
        return reply
