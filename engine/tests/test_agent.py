import json
import tempfile
import unittest
from pathlib import Path

from agent_fakes import (
    ADA,
    ADA_MENTION,
    BRIEF,
    CLEO,
    CLEO_MENTION,
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
    user,
    versions,
)
from bernlife.agent import MAX_ROUNDS, EngineTools, answer
from bernlife.agent_prompt import PROMPT, TOOLS
from bernlife.agent_views import NO_SOURCE_REPLY
from bernlife.brief_search import brief_search
from bernlife.cache import CacheMiss, cache_roots
from bernlife.config import Endpoint
from bernlife.database import connect
from bernlife.llm import ROLES, MockLLM, Router
from bernlife.llm_gate import request_scope
from bernlife.llm_http import ModelUnavailable, OpenAIChat
from bernlife.load_command import load
from bernlife.search import search
from bernlife.store import PostgresStore
from contract_schemas import validator
from fake_llm import FakeTransport, chat_body, tool_body
from search_fakes import SOURCES, fake_embedder, truncate_all, write_bundle
from test_grounding import response, shown

from db import database_url


class AgentTest(AgentCase):
    def test_a_native_tool_call_then_a_grounded_reply(self):
        llm = ScriptedChat(
            calls(("search", {"query": "glucose sensors"})),
            answers("Ada Muster works on continuous glucose monitoring."),
        )
        reply = self.check(answer(user(QUESTION), FakeTools({"glucose sensors": GLUCOSE}), llm))
        self.assertEqual(
            reply,
            {
                "reply": "Ada Muster works on continuous glucose monitoring.",
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
        call = {"name": "search", "arguments": '{"query": "glucose sensors"}'}
        self.assertEqual(
            llm.seen[1],
            [
                {"role": "system", "content": PROMPT},
                *user(QUESTION),
                {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [{"id": "call-1", "type": "function", "function": call}],
                },
                {
                    "role": "tool",
                    "tool_call_id": "call-1",
                    "content": json.dumps({"found": GLUCOSE_FOUND}),
                },
            ],
        )

    def test_a_reply_naming_someone_outside_the_results_is_replaced_by_a_summary(self):
        llm = ScriptedChat(
            calls(("search", {"query": "glucose sensors"})),
            answers("Ada Muster and Hugo Brandtner work on glucose sensors."),
        )
        reply = self.check(answer(user(QUESTION), FakeTools({"glucose sensors": GLUCOSE}), llm))
        self.assertEqual(reply["reply"], GLUCOSE_SUMMARY)
        self.assertEqual(reply["mentions"], [ADA_MENTION, CLEO_MENTION])
        self.assertEqual(reply["actions"], [{"type": "show_on_map", "result": 0}])
        self.assertEqual(reply["mode"], "replay")

    def test_a_reply_holding_anything_the_results_do_not_is_replaced_by_a_summary(self):
        question = "Is it true that Prof. Ada Muster, who leads the insulin pump lab, has 40 staff?"
        for text in (
            "Yes, Ada Muster led the 2019 insulin trial and has 40 researchers in her group.",
            "Ada Muster works on wearable biosensors together with J. Smith and K. Weber.",
            "Ada Muster works with the Hans Meier Lab.",
            "Smith, John works on continuous glucose monitoring.",
            "Meier works on continuous glucose monitoring.",
            "Prof. Ada Muster, who leads the insulin pump lab, works on wearable biosensors.",
            "Yes, Ada Muster is the head of the department and is available for contract research.",
            "Ada Muster leads the insulin pump group and has twenty years of industry experience.",
            "Ada Muster does not work on continuous glucose monitoring.",
            "Ada Muster leads the GlucoPatch sensor project.",
            "Ada Muster works on continuous glucose monitoring, ada.muster@sensor.lab.",
        ):
            with self.subTest(text=text):
                llm = ScriptedChat(calls(("search", {"query": "glucose sensors"})), answers(text))
                tools = FakeTools({"glucose sensors": GLUCOSE})
                reply = self.check(answer(user(question), tools, llm))
                self.assertEqual(
                    (reply["reply"], reply["mentions"], reply["abstained"]),
                    (GLUCOSE_SUMMARY, [ADA_MENTION, CLEO_MENTION], False),
                )

    def test_a_reply_in_the_words_of_the_results_is_kept(self):
        text = (
            "Ada Muster’s role is Group Leader in the Sensor Lab, and she works on wearable "
            "biosensors. Cleo Beispiel studies glucose metabolism in mice."
        )
        llm = ScriptedChat(calls(("search", {"query": "glucose sensors"})), answers(text))
        reply = self.check(answer(user(QUESTION), FakeTools({"glucose sensors": GLUCOSE}), llm))
        self.assertEqual((reply["reply"], reply["mentions"]), (text, [ADA_MENTION, CLEO_MENTION]))

    def test_a_premise_the_sources_do_not_support_gets_the_honest_answer(self):
        question = "Prof. Hugo Brandtner leads glucose research at the Demo Centre. Who helps him?"
        llm = ScriptedChat(
            calls(("search", {"query": "Prof. Hugo Brandtner glucose research"})),
            answers("Prof. Hugo Brandtner works with a team on glucose research."),
        )
        reply = self.check(answer(user(question), FakeTools({}), llm))
        self.assertEqual(
            {k: reply[k] for k in ("reply", "abstained", "actions", "mentions", "tool_calls")},
            {
                "reply": NO_SOURCE_REPLY,
                "abstained": True,
                "actions": [],
                "mentions": [],
                "tool_calls": [
                    {"tool": "search", "query": "Prof. Hugo Brandtner glucose research"}
                ],
            },
        )
        demo = response("glucose research", shown(CLEO, "/fields/expertise/0"))
        llm = ScriptedChat(
            calls(("search", {"query": "glucose research"})),
            answers("Yes, Prof. Hugo Brandtner leads it and works with Cleo Beispiel."),
        )
        reply = self.check(answer(user(question), FakeTools({"glucose research": demo}), llm))
        self.assertEqual(
            (reply["reply"], reply["mentions"]),
            (
                "Here is what the sources show:\n- Cleo Beispiel: glucose metabolism in mice",
                [CLEO_MENTION],
            ),
        )

    def test_a_reply_without_a_search_is_not_kept(self):
        tools = FakeTools({})
        reply = answer(
            user("Does Prof. Hugo Brandtner work at the Demo Centre?"),
            tools,
            ScriptedChat(answers("Yes, he leads it.")),
        )
        self.assertEqual((reply["reply"], reply["mode"]), (NO_SOURCE_REPLY, "replay"))
        self.assertEqual(
            tools.asked, [("search", ("Does Prof. Hugo Brandtner work at the Demo Centre?", None))]
        )

    def test_the_tool_budget_holds(self):
        rounds = [
            calls(
                ("search", {"query": f"topic {2 * n}"}), ("search", {"query": f"topic {2 * n + 1}"})
            )
            for n in range(MAX_ROUNDS)
        ]
        llm = ScriptedChat(*rounds)
        tools = FakeTools({f"topic {n}": GLUCOSE for n in range(10)})
        reply = self.check(answer(user(QUESTION), tools, llm))
        self.assertEqual(
            [query for _, (query, _) in tools.asked], ["topic 0", "topic 1", "topic 2", "topic 3"]
        )
        self.assertEqual(len(llm.seen), MAX_ROUNDS)
        self.assertEqual([m["content"] for m in llm.seen[3][-2:]], ['{"error": "tool_limit"}'] * 2)
        self.assertEqual((reply["reply"], len(reply["results"])), (GLUCOSE_SUMMARY, 4))
        self.assertEqual(reply["actions"][0], {"type": "show_on_map", "result": 3})

    def test_bad_arguments_and_profiles_outside_the_results_are_refused(self):
        llm = ScriptedChat(
            calls(("search", {"query": " "}), ("profile", {"id": DORA["id"]}), ("lookup", {})),
            calls(("search", {"query": "glucose sensors", "kinds": ["person", "planet"]})),
            calls(("search", {"query": "glucose sensors", "kinds": ["person"]})),
            calls(("profile", {"id": [ADA["id"]]}), ("profile", {"id": ADA["id"]})),
            answers("Ada Muster is a Group Leader in the Sensor Lab."),
        )
        tools = FakeTools({"glucose sensors": GLUCOSE})
        reply = self.check(answer(user(QUESTION), tools, llm))
        refused = [m["content"] for m in llm.seen[1][-3:]] + [llm.seen[2][-1]["content"]]
        refused.append(llm.seen[4][-2]["content"])
        self.assertEqual(refused, ['{"error": "bad_arguments"}'] * 5)
        self.assertEqual(
            json.loads(llm.seen[4][-1]["content"]),
            {
                "id": "person-example-ada-muster",
                "kind": "person",
                "name": "Ada Muster",
                "source": "example",
                "facts": {
                    "role": ["Group Leader"],
                    "unit": ["Sensor Lab"],
                    "expertise": ["continuous glucose monitoring", "wearable biosensors"],
                },
            },
        )
        self.assertEqual(
            tools.asked, [("search", ("glucose sensors", ["person"])), ("profile", ADA["id"])]
        )
        self.assertEqual(reply["reply"], "Ada Muster is a Group Leader in the Sensor Lab.")
        self.assertEqual(
            reply["tool_calls"],
            [
                {"tool": "search", "query": "glucose sensors"},
                {"tool": "profile", "query": "person-example-ada-muster"},
            ],
        )

    def test_text_that_utf_8_cannot_carry_is_neither_searched_nor_replied(self):
        llm = ScriptedChat(
            calls(("search", {"query": "glucose \ud800"}), ("brief", {"text": "patch \ud800"})),
            calls(("search", {"query": "glucose sensors"})),
            answers("Ada Muster works on glucose sensors \ud800."),
        )
        tools = FakeTools({"glucose sensors": GLUCOSE})
        reply = self.check(answer(user(QUESTION), tools, llm))
        refused = [m["content"] for m in llm.seen[1][-2:]]
        self.assertEqual(refused, ['{"error": "bad_arguments"}'] * 2)
        self.assertEqual(tools.asked, [("search", ("glucose sensors", None))])
        self.assertEqual(reply["reply"], GLUCOSE_SUMMARY)

    def test_a_brief_offers_a_match_report(self):
        briefed = response("wearable glucose sensors", shown(ADA, "/fields/expertise/1"))
        briefed["brief_terms"] = [
            {"term": "wearable glucose sensors", "span": "wearable glucose sensors"}
        ]
        llm = ScriptedChat(
            calls(("brief", {"text": BRIEF})), answers("Ada Muster works on wearable biosensors.")
        )
        reply = self.check(answer(user(BRIEF), FakeTools({}, briefed), llm))
        self.assertEqual(
            reply["actions"],
            [
                {"type": "show_on_map", "result": 0},
                {"type": "start_match_report", "result": 0},
                {"type": "open_profile", "profile_id": "person-example-ada-muster"},
            ],
        )
        self.assertEqual(
            json.loads(llm.seen[1][-1]["content"])["needs"], ["wearable glucose sensors"]
        )

    def test_without_a_model_the_last_message_is_searched_and_summarised(self):
        tools = FakeTools({QUESTION: GLUCOSE})
        messages = [
            *user("Hi"),
            {"role": "assistant", "content": "Hello."},
            *user(f"  {QUESTION}\n"),
        ]
        for llm, mode in (
            (MockLLM(), "mock"),
            (ScriptedChat(ModelUnavailable("timeout")), "replay"),
            (ScriptedChat(CacheMiss("agent call not in cache")), "replay"),
            (
                ScriptedChat(answers("Ada Muster."), model=f"{MODEL}-thinking", backend="live"),
                "live",
            ),
        ):
            with self.subTest(llm=type(llm).__name__, mode=mode):
                reply = self.check(answer(messages, tools, llm))
                self.assertEqual(
                    reply,
                    {
                        "reply": GLUCOSE_SUMMARY,
                        "mode": mode,
                        "abstained": False,
                        "actions": [{"type": "show_on_map", "result": 0}],
                        "results": [GLUCOSE],
                        "mentions": [ADA_MENTION, CLEO_MENTION],
                        "tool_calls": [{"tool": "search", "query": QUESTION}],
                        "versions": versions("none", {}),
                    },
                )

    def test_a_failure_after_a_search_summarises_what_was_found(self):
        llm = ScriptedChat(
            calls(("search", {"query": "glucose sensors"})), ModelUnavailable("http_500")
        )
        reply = answer(user(QUESTION), FakeTools({"glucose sensors": GLUCOSE}), llm)
        self.assertEqual((reply["reply"], reply["mode"]), (GLUCOSE_SUMMARY, "replay"))


class AgentReplayTest(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.roots = cache_roots(Path(tmp.name))

    def test_a_recorded_conversation_replays_offline_and_a_miss_falls_back(self):
        transport = FakeTransport(
            tool_body(None, ("call-1", "search", {"query": "glucose sensors"})),
            chat_body('{"answer": "Ada Muster works on continuous glucose monitoring."}'),
        )
        client = OpenAIChat(Endpoint("https://gateway.example/v1", "key", MODEL), transport)
        models = dict.fromkeys(ROLES, MODEL)
        tools = FakeTools({"glucose sensors": GLUCOSE})
        live = answer(user(QUESTION), tools, Router(client, models, self.roots))
        replayed = answer(user(QUESTION), tools, Router(None, models, self.roots))
        self.assertEqual(live["reply"], "Ada Muster works on continuous glucose monitoring.")
        self.assertEqual(replayed, live | {"mode": "replay"})
        self.assertEqual(len(transport.requests), 2)
        self.assertEqual(transport.bodies[0]["tools"], list(TOOLS))
        other = answer(user("Who builds insulin pumps?"), tools, Router(None, models, self.roots))
        self.assertEqual((other["reply"], other["mode"]), (NO_SOURCE_REPLY, "replay"))

    def test_a_bundle_without_the_agent_role_falls_back(self):
        recorded = {role: MODEL for role in ROLES if role != "agent"}
        reply = answer(
            user(QUESTION), FakeTools({QUESTION: GLUCOSE}), Router(None, recorded, self.roots)
        )
        self.assertEqual((reply["reply"], reply["mode"]), (GLUCOSE_SUMMARY, "replay"))

    def test_a_live_engine_reports_replay_when_no_call_went_live(self):
        transport = FakeTransport(
            tool_body(None, ("call-1", "search", {"query": "glucose sensors"})),
            chat_body('{"answer": "Ada Muster works on continuous glucose monitoring."}'),
        )
        client = OpenAIChat(Endpoint("https://gateway.example/v1", "key", MODEL), transport)
        models = dict.fromkeys(ROLES, MODEL)
        tools = FakeTools({"glucose sensors": GLUCOSE})
        router = Router(client, models, self.roots, serving=True, budget=5)
        with request_scope(live=True):
            recorded = answer(user(QUESTION), tools, router)
        modes = [recorded["mode"]]
        for live in (False, True):
            with request_scope(live=live):
                modes.append(answer(user(QUESTION), tools, router)["mode"])
        self.assertEqual(modes, ["live", "replay", "replay"])
        self.assertEqual(len(transport.requests), 2)

    def test_a_serving_router_outside_a_live_scope_never_calls_the_model(self):
        transport = FakeTransport()
        client = OpenAIChat(Endpoint("https://gateway.example/v1", "key", MODEL), transport)
        router = Router(client, dict.fromkeys(ROLES, MODEL), self.roots, serving=True, budget=5)
        reply = answer(user(QUESTION), FakeTools({QUESTION: GLUCOSE}), router)
        self.assertEqual((reply["reply"], transport.requests), (GLUCOSE_SUMMARY, []))


class EngineToolsDbTest(unittest.TestCase):
    """The tools on the invented bundle in the migrated database, in a rolled-back transaction."""

    @classmethod
    def setUpClass(cls):
        cls.conn = connect(database_url())

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        write_bundle(Path(folder.name))
        transaction = self.conn.transaction(force_rollback=True)
        transaction.__enter__()
        self.addCleanup(transaction.__exit__, None, None, None)
        truncate_all(self.conn)
        self.assertEqual(load(self.conn, Path(folder.name), SOURCES), [])
        self.store = PostgresStore(self.conn)
        self.tools = EngineTools(self.store, fake_embedder(), MockLLM())

    def test_the_tools_answer_as_the_api_does(self):
        self.assertEqual(
            self.tools.search("glucose monitoring"),
            search("glucose monitoring", None, self.store, fake_embedder(), MockLLM()),
        )
        self.assertEqual(
            self.tools.brief(BRIEF),
            brief_search(BRIEF, None, self.store, fake_embedder(), MockLLM()),
        )
        self.assertEqual(self.tools.profile(ADA["id"])["name"]["value"], "Ada Muster")
        self.assertIsNone(self.tools.profile("person-example-nobody"))
        self.assertEqual(self.tools.snapshot(), self.store.snapshot())

    def test_a_turn_over_the_database_validates_against_the_contract(self):
        llm = ScriptedChat(
            calls(("search", {"query": "glucose monitoring"})),
            calls(("profile", {"id": ADA["id"]})),
            answers("Ada Muster is a Group Leader in the Sensor Lab."),
        )
        reply = answer(user("Who works on glucose monitoring?"), self.tools, llm)
        self.assertEqual(list(validator("agent.schema.json").iter_errors(reply)), [])
        self.assertEqual(reply["reply"], "Ada Muster is a Group Leader in the Sensor Lab.")
        self.assertEqual(reply["results"][0]["results"][0]["profile"]["id"], ADA["id"])
        self.assertEqual(json.loads(llm.seen[2][-1]["content"])["facts"]["unit"], ["Sensor Lab"])


if __name__ == "__main__":
    unittest.main()
