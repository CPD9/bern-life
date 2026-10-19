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
from bernlife.agent_follow_up import is_topical, search_query
from bernlife.agent_views import NO_SOURCE_REPLY
from bernlife.cache import cache_roots
from bernlife.config import Endpoint
from bernlife.llm import ROLES, MockLLM, Router
from bernlife.llm_gate import request_mode, request_scope
from bernlife.llm_http import OpenAIChat
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
            "Zeig sie auf der Karte",
            "Montre-les sur la carte, s'il vous plaît",
            "Where are they?",
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

    def test_the_most_recent_question_with_a_topic_is_the_one_searched(self):
        cases = (
            (after_glucose("Bitte nochmal auf der Karte"), QUESTION),
            (
                after_glucose("Who builds insulin pumps?", "Show them on the map"),
                "Who builds insulin pumps?",
            ),
            (after_glucose("And insulin pumps?"), "And insulin pumps?"),
            (after_glucose("Who works on CT?"), "Who works on CT?"),
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

    def test_topical_words(self):
        texts = (
            "Où sont-ils ?",
            "And on the map?",
            "Tell me more",
            "Wo liegen sie?",
            "DCB?",
            "3D printing",
        )
        self.assertEqual(
            [is_topical(text) for text in texts], [False, False, False, False, True, True]
        )


class ModeTools(FakeTools):
    """Searches that answer in the mode of the request they ran in, as search.py does when the
    model's expansion was used."""

    def __init__(self, backend: str) -> None:
        super().__init__({QUESTION: GLUCOSE})
        self.backend = backend

    def search(self, query: str, kinds: Sequence[str] | None = None) -> dict[str, Any]:
        return super().search(query, kinds) | {"mode": request_mode(self.backend)}


class FallbackModeTest(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.roots = cache_roots(Path(tmp.name))

    def modes(self, llm: Any) -> tuple[str, str]:
        reply = answer(user(QUESTION), ModeTools(llm.backend), llm)
        self.assertEqual(reply["reply"], GLUCOSE_SUMMARY)
        return reply["mode"], reply["results"][0]["mode"]

    def test_a_fallback_answers_in_the_mode_its_search_ran_in(self):
        models = dict.fromkeys(ROLES, MODEL)
        transport = FakeTransport(chat_body(KEERA))
        client = OpenAIChat(Endpoint("https://gateway.example/v1", "key", MODEL), transport)
        router = Router(client, models, self.roots, serving=True, budget=5)
        modes = [self.modes(MockLLM()), self.modes(Router(None, models, self.roots))]
        for live in (True, False):
            with request_scope(live=live):
                modes.append(self.modes(router))
        self.assertEqual(
            modes, [("mock", "mock"), ("replay", "replay"), ("live", "live"), ("replay", "replay")]
        )
        self.assertEqual(len(transport.requests), 1)

    def test_only_the_mock_engine_answers_mock(self):
        reply = answer(user(QUESTION), FakeTools({QUESTION: GLUCOSE}), ScriptedChat(says(KEERA)))
        self.assertEqual((reply["mode"], reply["results"][0]["mode"]), ("replay", "mock"))


if __name__ == "__main__":
    unittest.main()
