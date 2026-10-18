import unittest

from bernlife.cache import CacheMiss
from bernlife.expand import Expansion, expand, expanded_text, parse_expansion
from bernlife.llm import MockLLM
from bernlife.llm_http import ModelUnavailable
from bernlife.terms import Term
from search_fakes import FakeChat

QUERY = "Wer erforscht Glukosesensoren bei Prof. Ada Muster?"


def term(text: str, kind: str = "synonym", lang: str = "en") -> dict[str, str]:
    return {"term": text, "kind": kind, "lang": lang}


class ParseExpansionTest(unittest.TestCase):
    def test_terms_are_kept_under_topics_copied_from_the_question(self):
        reply = {
            "topics": [
                {"topic": "Glukosesensoren", "terms": [term("glucose sensors", "translation")]},
                {"topic": "insulin pumps", "terms": [term("insulin pump")]},
            ]
        }
        self.assertEqual(
            parse_expansion(reply, QUERY),
            Expansion((("Glukosesensoren", (Term("glucose sensors", "translation", "en"),)),)),
        )

    def test_names_unknown_kinds_repeats_and_the_topic_itself_are_dropped(self):
        terms = [
            term("CGM", "acronym"),
            term("cgm", "acronym"),
            term("Glukosesensoren"),
            term("Muster lab"),
            term("sensor", "guess"),
            term("capteur", "translation", "xx"),
            "not an object",
        ]
        reply = {"topics": [{"topic": "Glukosesensoren", "terms": terms}, {"topic": "Ada Muster"}]}
        self.assertEqual(parse_expansion(reply, QUERY).terms(), [Term("CGM", "acronym", "en")])

    def test_a_reply_of_the_wrong_shape_expands_nothing(self):
        for reply in ([], {"topics": "x"}, {"topics": [{"topic": 3}]}):
            self.assertEqual(parse_expansion(reply, QUERY), Expansion(()))

    def test_at_most_twelve_terms(self):
        reply = {
            "topics": [{"topic": "Glukosesensoren", "terms": [term(f"t{n}") for n in range(20)]}]
        }
        self.assertEqual(len(parse_expansion(reply, QUERY).terms()), 12)


class ExpandTest(unittest.TestCase):
    def test_a_model_reply_becomes_an_expansion(self):
        llm = FakeChat(
            {
                "expand": {
                    "topics": [{"topic": "Glukosesensoren", "terms": [term("CGM", "acronym")]}]
                }
            }
        )
        expansion = expand(llm, QUERY)
        self.assertEqual(expansion.by_topic(), {"Glukosesensoren": ["CGM"]})
        self.assertEqual(llm.asked, ["expand"])
        self.assertEqual(expanded_text(QUERY, expansion.terms()), f"{QUERY}\nCGM")

    def test_failures_and_mock_mean_no_expansion(self):
        self.assertIsNone(expand(FakeChat({"expand": ModelUnavailable("model_timeout")}), QUERY))
        self.assertIsNone(expand(FakeChat({"expand": CacheMiss("x")}), QUERY))
        self.assertIsNone(expand(FakeChat({"expand": {"topics": []}}), QUERY))
        self.assertIsNone(expand(MockLLM(), QUERY))


if __name__ == "__main__":
    unittest.main()
