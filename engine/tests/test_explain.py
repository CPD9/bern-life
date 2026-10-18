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


def reply(text: str, claims: list[object] | None = None) -> dict[str, object]:
    return {"text": text, "claims": claims if claims is not None else [1]}


class CheckTest(unittest.TestCase):
    def test_a_grounded_reply_is_kept(self):
        text = "Ada Muster works on continuous glucose monitoring. The Sensor Lab is her unit."
        self.assertEqual(check(reply(text, [1, 2]), ADA, OFFERED), "kept")

    def test_each_failed_check_is_named(self):
        cases = {
            "shape": [reply("ok", []), {"text": 3, "claims": [1]}, {"text": "ok"}, "text"],
            "cites": [reply("Works on glucose.", [3]), reply("x", ["1"]), reply("x", [0])],
            "length": [reply("x" * 401), reply("   "), reply("glu\x00cose")],
            "non_answer": [
                reply("The claims do not contain anything about glucose sensors."),
                reply("Ada Muster's page does not mention sensors."),
                reply("There is no information on sensors in the claims."),
            ],
            "names": [reply("Works with Dr. Hugo Brandtner on glucose monitoring.")],
        }
        for outcome, replies in cases.items():
            for bad in replies:
                with self.subTest(outcome=outcome, reply=str(bad)[:40]):
                    self.assertEqual(check(bad, ADA, OFFERED), outcome)

    def test_a_capital_outside_the_name_and_the_cited_claims_fails(self):
        # The cited claim is about glucose monitoring, so the reply must not place the result at
        # an institute or on a topic the claims never mention.
        text = "Ada Muster is the researcher at the IRM who works on Time-of-death estimation."
        self.assertEqual(check(reply(text), ADA, OFFERED), "names")

    def test_a_negative_word_alone_is_not_a_non_answer(self):
        text = "Ada Muster works on continuous glucose monitoring, not on insulin pumps."
        self.assertEqual(check(reply(text), ADA, OFFERED), "kept")

    def test_capitals_that_start_a_sentence_or_come_from_the_allowed_text_pass(self):
        self.assertEqual(unknown_capitals("Works on CGM. Also Glucose.", "cgm glucose"), [])
        self.assertEqual(unknown_capitals("Works with Hugo on CGM.", "cgm"), ["hugo"])

    def test_the_prompt_carries_only_the_offered_claims_as_data(self):
        text = prompt(QUESTION, ADA, OFFERED)
        self.assertIn('[1] continuous glucose monitoring (page says: "continuous', text)
        self.assertIn("[2] Sensor Lab", text)
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

    def test_a_capital_copied_from_the_question_is_not_evidence(self):
        # The question is in the prompt but is not evidence about the result: words the reply
        # copies from it fail the names check.
        question = "Wer forscht am IRM Bern zur Todeszeitschaetzung?"
        text = "Ada Muster is the researcher at IRM Bern who works on Todeszeitschaetzung."
        llm = FakeChat({"explain": reply(text)})
        self.assertEqual(explain(llm, question, ADA, PLAIN), (PLAIN, "names"))

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
