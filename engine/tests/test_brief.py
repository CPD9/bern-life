import unittest

from bernlife.brief import Need, Reading, checked_needs, normalise, read_needs
from bernlife.cache import CacheMiss
from bernlife.llm import MockLLM
from bernlife.llm_gate import BudgetUsed
from bernlife.llm_http import ModelUnavailable
from search_fakes import FakeChat

BRIEF = (
    "Invented Demo AG builds a skin-worn patch.\n"
    "We need wearable sensors for continuous\n glucose monitoring.  "
    "We also need cryogenic electron microscopy of membrane proteins."
)
# As a PDF breaks the text: a word split over two lines with a hyphen, and a real hyphen.
PDF_BRIEF = (
    "Invented Demo AG builds a state-of-the-art patch.\n"
    "We need continuous glu-\ncose monitoring and lac-\r\n  tate sensing."
)


def need(term: str, span: str) -> dict[str, str]:
    return {"term": term, "span": span}


class NormaliseTest(unittest.TestCase):
    def test_hyphenated_line_breaks_join_and_other_hyphens_stay(self):
        self.assertEqual(
            normalise("continuous glu-\ncose and lac-\r\n  tate"), "continuous glucose and lactate"
        )
        self.assertEqual(
            normalise("state-of-the-art, two- and three-dimensional, COVID-\n19"),
            "state-of-the-art, two- and three-dimensional, COVID- 19",
        )

    def test_whitespace_collapses_and_the_ends_are_trimmed(self):
        self.assertEqual(normalise("  We need\n\n  a partner.  \t"), "We need a partner.")


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

    def test_spans_match_under_the_same_normalisation_and_are_cut_from_the_brief(self):
        reply = {
            "needs": [
                need("glucose monitoring", "continuous glu-\ncose monitoring"),
                need("lactate sensing", "lac-\r\ntate   sensing"),
                need("patch design", "state-of-the-art patch"),
                need("spaced hyphen", "state of the art patch"),
            ]
        }
        self.assertEqual(
            checked_needs(reply, PDF_BRIEF),
            [
                Need("glucose monitoring", "continuous glucose monitoring"),
                Need("lactate sensing", "lactate sensing"),
                Need("patch design", "state-of-the-art patch"),
            ],
        )
        text = normalise(PDF_BRIEF)
        for kept in checked_needs(reply, PDF_BRIEF):
            self.assertIn(kept.span, text)

    def test_repeats_bad_terms_and_bad_shapes_are_dropped_and_six_at_most(self):
        span = "skin-worn patch"
        reply = {
            "needs": [
                need("patch", span),
                need("Patch", span),
                need("x", span),
                need("a\x00b", span),
                need("empty span", ""),
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


class ReadNeedsTest(unittest.TestCase):
    def test_a_kept_need_is_read_and_a_reply_with_nothing_quotable_says_so(self):
        reply = {"needs": [need("glucose monitoring", "continuous glu-\ncose monitoring")]}
        self.assertEqual(
            read_needs(FakeChat({"brief": reply}), PDF_BRIEF),
            Reading([Need("glucose monitoring", "continuous glucose monitoring")]),
        )
        invented = {"needs": [need("mass spectrometry", "We need mass spectrometry.")]}
        self.assertEqual(
            read_needs(FakeChat({"brief": invented}), PDF_BRIEF), Reading(unread="no_need_found")
        )

    def test_each_way_of_reading_nothing_is_told_apart(self):
        self.assertEqual(read_needs(MockLLM(), BRIEF), Reading(unread="no_model"))
        failing = {"brief": ModelUnavailable("unreachable")}
        self.assertEqual(read_needs(FakeChat(failing), BRIEF), Reading(unread="model_failed"))
        unrecorded = {"brief": CacheMiss("brief call not in cache")}
        self.assertEqual(read_needs(FakeChat(unrecorded), BRIEF), Reading(unread="not_recorded"))
        spent = {"brief": BudgetUsed("brief call not in cache and today's budget is used")}
        self.assertEqual(read_needs(FakeChat(spent), BRIEF), Reading(unread="budget_used"))


if __name__ == "__main__":
    unittest.main()
