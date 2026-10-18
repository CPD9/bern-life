import unittest

from bernlife.brief import Need, checked_needs, read_needs
from bernlife.llm import MockLLM
from bernlife.llm_http import ModelUnavailable
from search_fakes import FakeChat

BRIEF = (
    "Invented Demo AG builds a skin-worn patch.\n"
    "We need wearable sensors for continuous\n glucose monitoring.  "
    "We also need cryogenic electron microscopy of membrane proteins."
)


def need(term: str, span: str) -> dict[str, str]:
    return {"term": term, "span": span}


class CheckedNeedsTest(unittest.TestCase):
    def test_a_need_is_kept_only_if_its_span_is_in_the_brief(self):
        reply = {
            "needs": [
                need(
                    "wearable glucose sensors",
                    "We need wearable sensors for continuous glucose monitoring.",
                ),
                need("mass spectrometry", "We need mass spectrometry."),
                need("cryo-EM", "cryogenic electron microscopy of membrane proteins"),
            ]
        }
        self.assertEqual(
            checked_needs(reply, BRIEF),
            [
                Need(
                    "wearable glucose sensors",
                    "We need wearable sensors for continuous glucose monitoring.",
                ),
                Need("cryo-EM", "cryogenic electron microscopy of membrane proteins"),
            ],
        )

    def test_repeats_bad_terms_and_bad_shapes_are_dropped_and_six_at_most(self):
        span = "skin-worn patch"
        reply = {
            "needs": [
                need("patch", span),
                need("Patch", span),
                need("x", span),
                need("a\x00b", span),
                {"term": "patch design"},
                "text",
                *(need(f"need {n}", span) for n in range(10)),
            ]
        }
        self.assertEqual(
            [n.term for n in checked_needs(reply, BRIEF)],
            ["patch", *(f"need {n}" for n in range(5))],
        )
        self.assertEqual(checked_needs({"needs": "x"}, BRIEF), [])

    def test_no_model_or_a_failure_reads_no_needs(self):
        self.assertEqual(read_needs(MockLLM(), BRIEF), [])
        self.assertEqual(
            read_needs(FakeChat({"brief": ModelUnavailable("unreachable")}), BRIEF), []
        )


if __name__ == "__main__":
    unittest.main()
