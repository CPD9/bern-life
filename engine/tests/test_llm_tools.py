import json
import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path

from bernlife.cache import CacheMiss, cache_key, cache_roots, entry_path, write_json
from bernlife.config import Endpoint
from bernlife.llm import ROLES, MockLLM, Router
from bernlife.llm_http import ModelUnavailable, OpenAIChat
from fake_llm import FakeTransport, chat_body, tool_body

MODEL = "swiss-ai/Apertus-v1.5-70B"
MESSAGES = [{"role": "user", "content": "Who works on glucose sensors?"}]
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search",
            "description": "Search the pages.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        },
    }
]
NOON = datetime(2026, 10, 18, 12, 0, tzinfo=UTC)
SEARCH_CALL = {"id": "call-1", "name": "search", "arguments": {"query": "glucose sensors"}}


class ChatToolsTest(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.roots = cache_roots(Path(tmp.name))
        self.key = cache_key(MODEL, MESSAGES, 0.0, None, 700, "agent-v1", TOOLS)

    def live(self, transport: FakeTransport) -> Router:
        client = OpenAIChat(Endpoint("https://gateway.example/v1", "key", MODEL), transport)
        clock = iter((10.0, 10.5)).__next__
        return Router(
            client, dict.fromkeys(ROLES, MODEL), self.roots, clock=clock, now=lambda: NOON
        )

    def ask(self, router: Router | MockLLM) -> dict[str, object]:
        return router.chat_tools(MESSAGES, role="agent", prompt_version="agent-v1", tools=TOOLS)

    def test_tool_calls_are_parsed_stored_and_replayed(self) -> None:
        transport = FakeTransport(tool_body(None, ("call-1", "search", SEARCH_CALL["arguments"])))
        first = self.ask(self.live(transport))
        replay = Router(None, dict.fromkeys(ROLES, MODEL), self.roots, now=lambda: NOON)
        self.assertEqual(first, {"content": None, "tool_calls": [SEARCH_CALL]})
        self.assertEqual(self.ask(replay), first)
        self.assertEqual(len(transport.requests), 1)
        self.assertEqual(
            transport.bodies[0],
            {"model": MODEL, "messages": MESSAGES, "temperature": 0.0, "max_tokens": 700}
            | {"tools": TOOLS},
        )
        self.assertEqual(
            json.loads(entry_path(self.roots[0], self.key).read_text()),
            {
                "content": "",
                "created_at": "2026-10-18T12:00:00+00:00",
                "latency_ms": 500,
                "model": MODEL,
                "prompt_version": "agent-v1",
                "role": "agent",
                "tool_calls": [SEARCH_CALL],
            },
        )

    def test_contact_details_are_redacted_before_the_reply_is_stored(self) -> None:
        typed = {"query": "glucose sensors for maria.example@invented.test +41 79 555 01 23"}
        content = "Reach Ada Muster at ada.muster@invented.test or +41 31 555 00 00."
        reply = self.ask(self.live(FakeTransport(tool_body(content, ("call-1", "search", typed)))))
        redacted = {
            "content": "Reach Ada Muster at [email] or [phone].",
            "tool_calls": [
                {
                    "id": "call-1",
                    "name": "search",
                    "arguments": {"query": "glucose sensors for [email] [phone]"},
                }
            ],
        }
        self.assertEqual(reply, redacted)
        stored = entry_path(self.roots[0], self.key).read_text()
        self.assertEqual({key: json.loads(stored)[key] for key in redacted}, redacted)
        self.assertNotIn("invented.test", stored)
        self.assertNotIn("555", stored)

    def test_the_tools_are_part_of_the_key(self) -> None:
        plain = cache_key(MODEL, MESSAGES, 0.0, None, 700, "agent-v1")
        self.assertNotEqual(self.key, plain)
        write_json(entry_path(self.roots[1], plain), {"content": "no tools", "model": MODEL})
        replay = Router(None, dict.fromkeys(ROLES, MODEL), self.roots, now=lambda: NOON)
        with self.assertRaises(CacheMiss):
            self.ask(replay)

    def test_a_text_answer_has_no_tool_calls(self) -> None:
        reply = self.ask(self.live(FakeTransport(chat_body("Ada Muster works on CGM."))))
        self.assertEqual(reply, {"content": "Ada Muster works on CGM.", "tool_calls": []})

    def test_unreadable_tool_calls_are_the_bad_json_marker_and_nothing_is_stored(self) -> None:
        bodies = [
            tool_body(None, ("call-1", "search", ["not", "an", "object"])),
            json.dumps(
                {
                    "choices": [
                        {
                            "message": {
                                "content": None,
                                "tool_calls": [
                                    {"id": "c", "function": {"name": "search", "arguments": "{"}}
                                ],
                            }
                        }
                    ]
                }
            ).encode(),
            json.dumps({"choices": [{"message": ["not a message"]}]}).encode(),
        ]
        for body in bodies:
            with self.subTest(body=body[:60]):
                with self.assertRaises(ModelUnavailable) as raised:
                    self.ask(self.live(FakeTransport(body)))
                self.assertEqual(str(raised.exception), "bad_json")
        self.assertFalse(entry_path(self.roots[0], self.key).exists())

    def test_a_role_missing_from_the_recorded_models_is_a_cache_miss(self) -> None:
        recorded = {role: MODEL for role in ROLES if role != "agent"}
        replay = Router(None, recorded, self.roots, now=lambda: NOON)
        with self.assertRaises(CacheMiss) as raised:
            self.ask(replay)
        self.assertEqual(str(raised.exception), "no recorded model for agent")
        with self.assertRaises(CacheMiss):
            replay.chat(MESSAGES, role="agent", prompt_version="agent-v1")

    def test_the_mock_calls_no_tools(self) -> None:
        self.assertEqual(
            self.ask(MockLLM()),
            {"content": "[MOCK] agent: no model is connected.", "tool_calls": []},
        )
        self.assertEqual(MockLLM().models()["agent"], "MOCK-no-model")


if __name__ == "__main__":
    unittest.main()
