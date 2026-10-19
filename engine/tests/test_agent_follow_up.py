import tempfile
import unittest
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from agent_fakes import (
    GLUCOSE,
    GLUCOSE_SUMMARY,
    MODEL,
    QUESTION,
    AgentCase,
    FakeTools,
    ScriptedChat,
    says,
    user,
)
from bernlife.agent import answer
from bernlife.agent_follow_up import is_follow_up, search_query
from bernlife.agent_views import NO_SOURCE_REPLY
from bernlife.cache import cache_roots
from bernlife.config import Endpoint
from bernlife.llm import ROLES, MockLLM, Router
from bernlife.llm_gate import request_mode, request_scope
from bernlife.llm_http import OpenAIChat
from bernlife.search import NO_MODEL
from fake_llm import FakeTransport, chat_body

KEERA = "I will show the experts working on glucose sensors on the map."
ON_THE_MAP = [{"type": "show_on_map", "result": 0}]


def after_glucose(*follow_ups: str) -> list[dict[str, str]]:
    """The glucose question and its answer, then the user's follow-ups, each answered but the
    last."""
    messages = [*user(QUESTION), {"role": "assistant", "content": GLUCOSE_SUMMARY}]
    for text in follow_ups[:-1]:
        messages += [*user(text), {"role": "assistant", "content": NO_SOURCE_REPLY}]
    return [*messages, *user(follow_ups[-1])]


class FollowUpTest(AgentCase):
    def test_a_follow_up_with_nothing_to_search_searches_the_earlier_question(self):
        follow_ups = (
            "Show them on the map",
            "Can you put them on the map?",
            "Where are they?",
            "Zeig sie auf der Karte",
            "Zeig sie mir auf der Karte an",
            "Kannst du sie auf der Karte zeigen?",
            "Wo befinden sie sich?",
            "Montre-les sur la carte, s'il vous plaît",
            "Montre-les sur la carte, s'il te plaît",
            "Peux-tu les montrer sur la carte ?",
            "Pouvez-vous les afficher sur la carte ?",
            "Où se trouvent-ils ?",
        )
        for text in follow_ups:
            for llm in (MockLLM(), ScriptedChat(says(KEERA))):
                with self.subTest(text=text, llm=type(llm).__name__):
                    tools = FakeTools({QUESTION: GLUCOSE})
                    reply = self.check(answer(after_glucose(text), tools, llm))
                    self.assertEqual(
                        (reply["reply"], reply["actions"], reply["tool_calls"]),
                        (GLUCOSE_SUMMARY, ON_THE_MAP, [{"tool": "search", "query": QUESTION}]),
                    )
                    self.assertEqual(tools.asked, [("search", (QUESTION, None))])

    def test_the_latest_message_that_is_no_follow_up_is_searched(self):
        cases = (
            (after_glucose("Bitte nochmal auf der Karte"), QUESTION),
            (
                after_glucose("Who builds insulin pumps?", "Show them on the map"),
                "Who builds insulin pumps?",
            ),
            (after_glucose("And insulin pumps?"), "And insulin pumps?"),
            (after_glucose("Who works on CT?"), "Who works on CT?"),
            (after_glucose("Who works on maps?"), "Who works on maps?"),
            (after_glucose("Wer forscht zu Karten?"), "Wer forscht zu Karten?"),
            (after_glucose("Qui travaille sur les cartes ?"), "Qui travaille sur les cartes ?"),
            (after_glucose("Who works on maps?", "Show them on the map"), "Who works on maps?"),
            (
                [
                    *user("Hi"),
                    {"role": "assistant", "content": "Hello."},
                    *user("Show them on the map"),
                ],
                "Show them on the map",
            ),
            (user("  Show them\n on the map "), "Show them on the map"),
        )
        for messages, query in cases:
            with self.subTest(last=messages[-1]["content"]):
                self.assertEqual(search_query(messages), query)

    def test_a_follow_up_holds_only_words_of_showing_and_pointing_back(self):
        texts = (
            "Où sont-ils ?",
            "And on the map?",
            "Tell me more",
            "Wo liegen sie?",
            "Mark them on the plan",
            "DCB?",
            "3D printing",
            "Who are they?",
        )
        self.assertEqual([is_follow_up(text) for text in texts], [True] * 5 + [False] * 3)


class ModeTools(FakeTools):
    """Searches that answer in the mode search.py's model_use gives: the request's when the
    model's expansion was used, else "mock"."""

    def __init__(self, backend: str, expanded: bool) -> None:
        super().__init__({QUESTION: GLUCOSE})
        self.backend, self.expanded = backend, expanded

    def search(self, query: str, kinds: Sequence[str] | None = None) -> dict[str, Any]:
        mode = request_mode(self.backend) if self.expanded else NO_MODEL
        return super().search(query, kinds) | {"mode": mode}


class FallbackModeTest(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.roots = cache_roots(Path(tmp.name))

    def mode(self, llm: Any, expanded: bool = True) -> str:
        reply = answer(user(QUESTION), ModeTools(llm.backend, expanded), llm)
        self.assertEqual((reply["reply"], reply["versions"]["prompts"]), (GLUCOSE_SUMMARY, "none"))
        self.assertEqual(reply["mode"], reply["results"][-1]["mode"])
        return reply["mode"]

    def test_a_fallback_answers_in_the_mode_its_search_ran_in(self):
        models = dict.fromkeys(ROLES, MODEL)
        transport = FakeTransport(chat_body(KEERA))
        client = OpenAIChat(Endpoint("https://gateway.example/v1", "key", MODEL), transport)
        router = Router(client, models, self.roots, serving=True, budget=5)
        modes = [self.mode(MockLLM()), self.mode(Router(None, models, self.roots))]
        for live in (True, False):
            with request_scope(live=live):
                modes.append(self.mode(router))
        self.assertEqual(modes, ["mock", "replay", "live", "replay"])
        self.assertEqual(len(transport.requests), 1)

    def test_a_fallback_search_that_used_no_model_answers_mock(self):
        models = dict.fromkeys(ROLES, MODEL)
        transport = FakeTransport(chat_body(KEERA))
        client = OpenAIChat(Endpoint("https://gateway.example/v1", "key", MODEL), transport)
        router = Router(client, models, self.roots, serving=True, budget=5)
        modes = [self.mode(ScriptedChat(says(KEERA)), expanded=False)]
        for live in (True, False):
            with request_scope(live=live):
                modes.append(self.mode(router, expanded=False))
        self.assertEqual(modes, ["mock", "mock", "mock"])


if __name__ == "__main__":
    unittest.main()
