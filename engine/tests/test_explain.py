import unittest

from bernlife.cache import CacheMiss
from bernlife.explain import check, explain, explain_top, prompt, unknown_capitals
from bernlife.llm import MockLLM
from bernlife.llm_http import ModelUnavailable
from search_fakes import PROFILES, FakeChat

ADA = PROFILES[1]
QUESTION = "glucose sensors"
OFFERED = ["/fields/expertise/0", "/fields/unit/0"]
PLAIN = {"text": "Expertise: continuous glucose monitoring; Unit: Sensor Lab", "cites": OFFERED}


def reply(text: str, cites: list[str] | None = None) -> dict[str, object]:
    return {"text": text, "cites": cites if cites is not None else ["/fields/expertise/0"]}


class CheckTest(unittest.TestCase):
    def test_a_grounded_reply_is_kept(self):
        text = "Ada Muster works on continuous glucose monitoring. The Sensor Lab is her unit."
        self.assertEqual(check(reply(text, OFFERED), QUESTION, ADA, OFFERED), "kept")

    def test_each_failed_check_is_named(self):
        cases = {
            "shape": [reply("ok", []), {"text": 3, "cites": OFFERED}, "text"],
            "cites": [reply("Works on glucose.", ["/fields/role/0"]), reply("x", ["/fields/x/9"])],
            "length": [reply("x" * 401), reply("   "), reply("glu\x00cose")],
            "names": [reply("Works with Dr. Hugo Brandtner on glucose monitoring.")],
        }
        for outcome, replies in cases.items():
            for bad in replies:
                with self.subTest(outcome=outcome, reply=str(bad)[:40]):
                    self.assertEqual(check(bad, QUESTION, ADA, OFFERED), outcome)

    def test_capitals_that_start_a_sentence_or_come_from_the_question_pass(self):
        self.assertEqual(unknown_capitals("Works on CGM. Also Glucose.", "cgm glucose"), [])
        self.assertEqual(unknown_capitals("Works with Hugo on CGM.", "cgm"), ["hugo"])

    def test_the_prompt_carries_only_the_offered_claims_as_data(self):
        text = prompt(QUESTION, ADA, OFFERED)
        self.assertIn(
            '/fields/expertise/0: continuous glucose monitoring (page says: "continuous', text
        )
        self.assertIn("/fields/unit/0: Sensor Lab", text)
        self.assertNotIn("wearable", text)
        self.assertIn("<result>Ada Muster</result>", text)


class ExplainTest(unittest.TestCase):
    def test_a_kept_explanation_replaces_the_plain_reason(self):
        llm = FakeChat({"explain": reply("Ada Muster works on  continuous glucose monitoring.")})
        self.assertEqual(
            explain(llm, QUESTION, ADA, PLAIN),
            (
                {
                    "text": "Ada Muster works on continuous glucose monitoring.",
                    "cites": ["/fields/expertise/0"],
                },
                "kept",
            ),
        )

    def test_any_failure_keeps_the_plain_reason(self):
        for answer, outcome in (
            (reply("Works with Dr. Hugo Brandtner."), "names"),
            (ModelUnavailable("model_timeout"), "model_timeout"),
            (CacheMiss("x"), "cache_miss"),
        ):
            with self.subTest(outcome=outcome):
                self.assertEqual(
                    explain(FakeChat({"explain": answer}), QUESTION, ADA, PLAIN), (PLAIN, outcome)
                )

    def test_only_the_top_five_are_explained(self):
        results = [{"rank": n, "profile": ADA, "reason": PLAIN} for n in range(1, 8)]
        llm = FakeChat({"explain": reply("Works on continuous glucose monitoring.")})
        explained, outcomes = explain_top(llm, results, [QUESTION] * 7)
        self.assertEqual((llm.asked.count("explain"), outcomes), (5, ["kept"] * 5))
        self.assertEqual(
            [r["reason"]["text"] for r in explained[4:6]],
            ["Works on continuous glucose monitoring.", PLAIN["text"]],
        )
        self.assertEqual(explain_top(MockLLM(), results, [QUESTION] * 7), (results, []))


if __name__ == "__main__":
    unittest.main()
