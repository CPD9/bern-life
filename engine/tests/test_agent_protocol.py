import json
import tempfile
import unittest
from pathlib import Path

from agent_fakes import (
    ADA,
    ADA_MENTION,
    CLEO,
    DORA,
    GLUCOSE,
    GLUCOSE_FOUND,
    GLUCOSE_SUMMARY,
    MODEL,
    QUESTION,
    AgentCase,
    FakeTools,
    ScriptedChat,
    answers,
    calls,
    says,
    step,
    user,
    versions,
)
from bernlife.agent import MAX_ROUNDS, answer
from bernlife.agent_prompt import PROMPT, TOOLS
from bernlife.cache import cache_roots
from bernlife.config import Endpoint
from bernlife.llm import ROLES, Router
from bernlife.llm_http import OpenAIChat
from fake_llm import FakeTransport, chat_body
from test_grounding import response, shown

KEERA = "I will search for experts working on glucose sensors at the Diabetes Center Berne (DCB)."
ADA_SAYS = "Ada Muster works on continuous glucose monitoring."
REFUSED = '{"result": {"error": "bad_arguments"}}'


def result(output: object) -> dict[str, str]:
    return {"role": "user", "content": json.dumps({"result": output})}


class JsonStepTest(AgentCase):
    def test_a_json_step_then_a_json_answer_is_grounded(self):
        llm = ScriptedChat(
            says('Searching. {"tool": "search", "query": "glucose sensors", "kinds": ["person"]}'),
            answers(ADA_SAYS),
        )
        tools = FakeTools({"glucose sensors": GLUCOSE})
        reply = self.check(answer(user(QUESTION), tools, llm))
        self.assertEqual(
            reply,
            {
                "reply": ADA_SAYS,
                "mode": "replay",
                "abstained": False,
                "actions": [
                    {"type": "show_on_map", "result": 0},
                    {"type": "open_profile", "profile_id": "person-example-ada-muster"},
                ],
                "results": [GLUCOSE],
                "mentions": [ADA_MENTION],
                "tool_calls": [{"tool": "search", "query": "glucose sensors"}],
                "versions": versions("agent-v3", {"agent": "fake-70b"}),
            },
        )
        self.assertEqual(tools.asked, [("search", ("glucose sensors", ["person"]))])
        echo = '{"tool": "search", "kinds": ["person"], "query": "glucose sensors"}'
        self.assertEqual(
            llm.seen[1],
            [
                {"role": "system", "content": PROMPT},
                *user(QUESTION),
                {"role": "assistant", "content": echo},
                result({"found": GLUCOSE_FOUND}),
            ],
        )

    def test_text_that_holds_no_step_is_no_answer(self):
        for text in (KEERA, None, '{"answer": 42}', '{"tool": "search", "query": "glucose'):
            with self.subTest(text=text):
                llm = ScriptedChat(says(text))
                tools = FakeTools({QUESTION: GLUCOSE})
                reply = self.check(answer(user(QUESTION), tools, llm))
                self.assertEqual(
                    {k: reply[k] for k in ("reply", "mode", "tool_calls", "versions")},
                    {
                        "reply": GLUCOSE_SUMMARY,
                        "mode": "mock",
                        "tool_calls": [{"tool": "search", "query": QUESTION}],
                        "versions": versions("none", {}),
                    },
                )
                self.assertEqual(len(llm.seen), 1)
        llm = ScriptedChat(step("search", query="glucose sensors"), says(ADA_SAYS))
        reply = answer(user(QUESTION), FakeTools({"glucose sensors": GLUCOSE}), llm)
        self.assertEqual(
            (reply["reply"], reply["versions"]["prompts"]), (GLUCOSE_SUMMARY, "agent-v3")
        )

    def test_the_tool_budget_holds_across_native_and_json_steps(self):
        llm = ScriptedChat(
            calls(("search", {"query": "topic 0"}), ("search", {"query": "topic 1"})),
            step("search", query="topic 2"),
            step("search", query="topic 3"),
            step("search", query="topic 4"),
            answers(ADA_SAYS),
        )
        tools = FakeTools({f"topic {n}": GLUCOSE for n in range(5)})
        reply = self.check(answer(user(QUESTION), tools, llm))
        self.assertEqual(
            [query for _, (query, _) in tools.asked], ["topic 0", "topic 1", "topic 2", "topic 3"]
        )
        self.assertEqual(len(llm.seen), MAX_ROUNDS)
        self.assertEqual(llm.seen[4][-1], result({"error": "tool_limit"}))
        self.assertEqual((reply["reply"], len(reply["tool_calls"])), (ADA_SAYS, 4))
        self.assertEqual(reply["actions"][0], {"type": "show_on_map", "result": 3})

    def test_json_steps_outside_the_tools_are_refused(self):
        llm = ScriptedChat(
            step("search"),
            step("lookup", query="glucose sensors"),
            step("profile", id=ADA["id"]),
            step("search", query="glucose sensors"),
            answers(ADA_SAYS),
        )
        tools = FakeTools({"glucose sensors": GLUCOSE})
        reply = self.check(answer(user(QUESTION), tools, llm))
        self.assertEqual([llm.seen[n][-1]["content"] for n in (1, 2, 3)], [REFUSED] * 3)
        self.assertEqual(tools.asked, [("search", ("glucose sensors", None))])
        self.assertEqual(reply["reply"], ADA_SAYS)

    def test_the_answer_keeps_only_actions_on_the_turns_results(self):
        research = response("glucose research", shown(CLEO, "/fields/expertise/0"))
        proposed = [
            {"type": "show_on_map", "result": 1},
            {"type": "show_on_map", "result": 0},
            {"type": "show_on_map", "result": True},
            {"type": "show_on_map", "result": 7},
            {"type": "open_profile", "profile_id": CLEO["id"]},
            {"type": "open_profile", "profile_id": DORA["id"]},
            {"type": "start_match_report", "result": 0},
            {"type": "send_email", "to": "someone"},
            "map",
        ]
        both = f"{ADA_SAYS} Cleo Beispiel studies glucose metabolism in mice."
        expected = (
            (ADA_SAYS, [{"type": "open_profile", "profile_id": ADA["id"]}]),
            (both, [{"type": "open_profile", "profile_id": CLEO["id"]}]),
        )
        for text, cards in expected:
            with self.subTest(text=text):
                llm = ScriptedChat(
                    step("search", query="glucose sensors"),
                    step("search", query="glucose research"),
                    answers(text, proposed),
                )
                tools = FakeTools({"glucose sensors": GLUCOSE, "glucose research": research})
                reply = self.check(answer(user(QUESTION), tools, llm))
                self.assertEqual(reply["reply"], text)
                self.assertEqual(reply["actions"], [{"type": "show_on_map", "result": 0}, *cards])
        llm = ScriptedChat(
            step("search", query="glucose sensors"),
            answers("Ada Muster and Hugo Brandtner work on glucose sensors.", proposed[3:4]),
        )
        reply = answer(user(QUESTION), FakeTools({"glucose sensors": GLUCOSE}), llm)
        self.assertEqual(
            (reply["reply"], reply["actions"]),
            (GLUCOSE_SUMMARY, [{"type": "show_on_map", "result": 0}]),
        )

    def test_the_conversation_is_context_and_never_evidence(self):
        earlier = "Hugo Brandtner works on glucose sensors."
        messages = [
            *user(QUESTION),
            {"role": "assistant", "content": earlier},
            *user("Show them on the map"),
        ]
        llm = ScriptedChat(step("search", query="glucose sensors"), answers(earlier))
        reply = self.check(answer(messages, FakeTools({"glucose sensors": GLUCOSE}), llm))
        self.assertEqual(
            llm.seen[0],
            [
                {"role": "system", "content": PROMPT},
                *user(QUESTION),
                {"role": "assistant", "content": json.dumps({"answer": earlier})},
                *user("Show them on the map"),
            ],
        )
        self.assertEqual(reply["reply"], GLUCOSE_SUMMARY)


class JsonReplayTest(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.roots = cache_roots(Path(tmp.name))

    def test_a_recorded_json_conversation_replays_offline(self):
        transport = FakeTransport(
            chat_body(f'{KEERA}\n{{"tool": "search", "query": "glucose sensors"}}'),
            chat_body(
                json.dumps({"answer": ADA_SAYS, "actions": [{"type": "show_on_map", "result": 0}]})
            ),
        )
        client = OpenAIChat(Endpoint("https://gateway.example/v1", "key", MODEL), transport)
        models = dict.fromkeys(ROLES, MODEL)
        tools = FakeTools({"glucose sensors": GLUCOSE})
        messages = [
            *user(QUESTION),
            {"role": "assistant", "content": GLUCOSE_SUMMARY},
            *user("Show them on the map"),
        ]
        live = answer(messages, tools, Router(client, models, self.roots))
        replayed = answer(messages, tools, Router(None, models, self.roots))
        self.assertEqual((live["reply"], live["mode"]), (ADA_SAYS, "live"))
        self.assertEqual(replayed, live | {"mode": "replay"})
        self.assertEqual(len(transport.requests), 2)
        first, second = transport.bodies
        self.assertEqual(first["tools"], list(TOOLS))
        self.assertEqual(
            first["messages"][2],
            {"role": "assistant", "content": json.dumps({"answer": GLUCOSE_SUMMARY})},
        )
        self.assertEqual(
            second["messages"][-2:],
            [
                {"role": "assistant", "content": '{"tool": "search", "query": "glucose sensors"}'},
                result({"found": GLUCOSE_FOUND}),
            ],
        )


if __name__ == "__main__":
    unittest.main()
