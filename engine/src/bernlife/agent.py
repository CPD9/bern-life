"""The Navigator agent (POST /api/agent): Apertus with three tools, answering only from them.

The model may call search, brief and profile, MAX_TOOL_CALLS times a turn at most, as native tool
calls or as the JSON steps any chat endpoint carries (agent_steps.py); each runs the engine's own
functions, never HTTP, and every search or brief it ran comes back in `results`, so the app shows
the evidence the reply rests on. The conversation so far goes to the model as context, never as
evidence. The reply is checked in code: a person it names must be a profile among those results
(grounding.py), every word must be a word of their names or claims or a linking word
(reply_support.py), and it may hold no e-mail address or phone number. Otherwise it is replaced by
a summary of the results' cited claims, so a premise in the question ("Prof. X, who leads Y") does
not come back as a fact. A reply with no result behind it is NO_SOURCE_REPLY, whatever the model
wrote: there is nothing it could have been written from.

With no model (mock, a replay miss, a refused budget, a failure marker), with a reply that holds no
step, or when the model ran no search, the turn is deterministic: the user's last message is
searched, or for a follow-up with nothing to search the earlier question (agent_follow_up.py), and
the summary is the reply. Its mode is the mode that search ran in, replay or live; only the mock
engine answers "mock". Actions point only at returned results (agent_actions.py).
"""

import unicodedata
from collections.abc import Mapping, Sequence
from importlib.metadata import version
from typing import Any, Protocol

from bernlife.agent_actions import actions
from bernlife.agent_follow_up import search_query
from bernlife.agent_prompt import AGENT_PROMPT_VERSION, PROMPT, TOOLS
from bernlife.agent_steps import Answer, ToolStep, history, read_step
from bernlife.agent_views import profile_view, results_view, summary
from bernlife.api_requests import MAX_BRIEF, MAX_QUERY, is_clean
from bernlife.brief_search import brief_search
from bernlife.cache import CacheMiss
from bernlife.embed import Embedder
from bernlife.extract_records import PEOPLE_KINDS, PROFILE_KINDS
from bernlife.grounding import ground, shown_names
from bernlife.llm import Chat, ToolChat
from bernlife.llm_gate import request_mode
from bernlife.llm_http import ModelUnavailable
from bernlife.redact import redact
from bernlife.reply_support import unsupported_words
from bernlife.search import NO_MODEL, NO_PROMPTS, search
from bernlife.store import Store

MAX_TOOL_CALLS = 4
MAX_ROUNDS = MAX_TOOL_CALLS + 1
MAX_TOKENS = 600
MAX_REPLY = 800


class AgentTools(Protocol):
    def search(self, query: str, kinds: Sequence[str] | None = None) -> dict[str, Any]: ...
    def brief(self, text: str) -> dict[str, Any]: ...
    def profile(self, profile_id: str) -> dict[str, Any] | None: ...
    def snapshot(self) -> str: ...


class EngineTools:
    """The tools on the engine's own functions, answering as POST /api/search, POST /api/brief
    and GET /api/profile do. It holds no lock: the caller serialises use of the store."""

    def __init__(self, store: Store, embedder: Embedder, llm: Chat) -> None:
        self._store, self._embedder, self._llm = store, embedder, llm

    def search(self, query: str, kinds: Sequence[str] | None = None) -> dict[str, Any]:
        return search(query, None, self._store, self._embedder, self._llm, kinds or PEOPLE_KINDS)

    def brief(self, text: str) -> dict[str, Any]:
        return brief_search(text, None, self._store, self._embedder, self._llm)

    def profile(self, profile_id: str) -> dict[str, Any] | None:
        return self._store.profiles([profile_id]).get(profile_id)

    def snapshot(self) -> str:
        return self._store.snapshot()


class Turn:
    """The tools one turn ran: what the reply lists and what the model reads back."""

    def __init__(self, tools: AgentTools) -> None:
        self.tools = tools
        self.calls: list[dict[str, str]] = []
        self.responses: list[dict[str, Any]] = []
        self.made_by: list[str] = []

    def run(self, call: Mapping[str, Any]) -> dict[str, Any]:
        """The model's call answered: a refused call costs nothing, so only calls that ran count
        towards MAX_TOOL_CALLS (MAX_ROUNDS bounds the rest)."""
        name, arguments = call["name"], call["arguments"]
        if not self.allowed(name, arguments):
            return {"error": "bad_arguments"}
        if len(self.calls) >= MAX_TOOL_CALLS:
            return {"error": "tool_limit"}
        if name == "search":
            response = self.search(arguments["query"].strip(), arguments.get("kinds"))
            return {"found": results_view(response)}
        if name == "brief":
            text = arguments["text"]
            response = self.searched("brief", text, self.tools.brief(text))
            needs = [need["term"] for need in response.get("brief_terms", [])]
            return {"needs": needs, "found": results_view(response)}
        self.calls.append({"tool": "profile", "query": arguments["id"]})
        profile = self.tools.profile(arguments["id"])
        return {"error": "not_found"} if profile is None else profile_view(profile)

    def allowed(self, name: str, arguments: Mapping[str, Any]) -> bool:
        if name == "search":
            return _search_arguments(arguments)
        if name == "brief":
            return _text(arguments.get("text"), MAX_BRIEF)
        profile_id = arguments.get("id")
        return name == "profile" and isinstance(profile_id, str) and profile_id in self.shown_ids()

    def search(self, query: str, kinds: Sequence[str] | None = None) -> dict[str, Any]:
        return self.searched("search", query, self.tools.search(query, kinds))

    def searched(self, tool: str, query: str, response: dict[str, Any]) -> dict[str, Any]:
        self.calls.append({"tool": tool, "query": query})
        self.responses.append(response)
        self.made_by.append(tool)
        return response

    def shown_ids(self) -> set[str]:
        return {named.profile_id for named in shown_names(self.responses)}


def answer(
    messages: Sequence[Mapping[str, str]], tools: AgentTools, llm: ToolChat
) -> dict[str, Any]:
    """One turn: `messages` is the conversation so far, newest last, and the last is the user's."""
    turn = Turn(tools)
    said = _converse(messages, turn, llm) if _may_ask(llm) else None
    model_searched = bool(turn.responses)
    if not model_searched:
        query = search_query(messages)
        if query:
            turn.search(query)
    found = any(response["results"] for response in turn.responses)
    text = said.text.strip() if said and model_searched and found and _fits(said.text) else ""
    if text and not _supported(text, turn.responses):
        text = ""
    reply = text or summary(turn.responses)
    mentions = ground(reply, turn.responses).mentions
    proposed = said.actions if said and text else ()
    mentioned = [profile_id for profile_id, _ in mentions]
    return {
        "reply": reply,
        "mode": NO_MODEL if llm.backend == "mock" else request_mode(llm.backend),
        "abstained": not found,
        "actions": actions(turn.responses, turn.made_by, mentioned, proposed),
        "results": turn.responses,
        "mentions": [{"profile_id": profile_id, "name": name} for profile_id, name in mentions],
        "tool_calls": turn.calls,
        "versions": {
            "engine": version("bernlife"),
            "snapshot": tools.snapshot(),
            "prompts": AGENT_PROMPT_VERSION if model_searched else NO_PROMPTS,
            "models": {"agent": llm.models()["agent"]} if model_searched else {},
        },
    }


def _may_ask(llm: ToolChat) -> bool:
    """Never without a model, and never a reasoning (`-thinking`) model: its reasoning is not an
    answer written from the results."""
    return llm.backend != "mock" and "thinking" not in llm.models().get("agent", "").lower()


def _converse(messages: Sequence[Mapping[str, str]], turn: Turn, llm: ToolChat) -> Answer | None:
    """The model's answer, or None when it failed, wrote no step or was still calling tools at
    the end."""
    conversation: list[dict[str, Any]] = [{"role": "system", "content": PROMPT}]
    conversation += history(messages)
    for _ in range(MAX_ROUNDS):
        try:
            message = llm.chat_tools(
                conversation,
                role="agent",
                prompt_version=AGENT_PROMPT_VERSION,
                tools=TOOLS,
                max_tokens=MAX_TOKENS,
            )
        except (ModelUnavailable, CacheMiss):
            return None
        step = read_step(message)
        if not isinstance(step, ToolStep):
            return step
        conversation += step.messages([turn.run(call) for call in step.calls])
    return None


def _search_arguments(arguments: Mapping[str, Any]) -> bool:
    kinds = arguments.get("kinds")
    kinds_ok = kinds is None or (
        isinstance(kinds, list) and bool(kinds) and all(kind in PROFILE_KINDS for kind in kinds)
    )
    return _text(arguments.get("query"), MAX_QUERY) and kinds_ok


def _text(value: object, limit: int) -> bool:
    return isinstance(value, str) and 0 < len(value.strip()) <= limit and is_clean(value)


def _fits(text: str) -> bool:
    """Short and printable, with no e-mail address or phone number."""
    controls = [c for c in text if c not in "\n\t" and unicodedata.category(c) == "Cc"]
    return (
        len(text.strip()) <= MAX_REPLY and not controls and is_clean(text) and redact(text) == text
    )


def _supported(reply: str, responses: Sequence[Mapping[str, Any]]) -> bool:
    return ground(reply, responses).holds and not unsupported_words(reply, responses)
