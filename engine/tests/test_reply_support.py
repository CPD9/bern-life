import unittest

from bernlife.reply_support import unsupported_words
from search_fakes import PROFILES
from test_grounding import GLUCOSE, response, shown, through_carb_counter

EMIL = PROFILES[5]


class UnsupportedWordsTest(unittest.TestCase):
    def test_words_of_names_claims_and_linking_words_are_held(self):
        reply = (
            "Here, Ada Muster’s role is Group Leader in the Sensor Lab: she works on continuous "
            "glucose monitoring. Cleo Beispiel studies glucose metabolism in mice."
        )
        self.assertEqual(unsupported_words(reply, [GLUCOSE]), [])

    def test_numbers_premises_and_new_names_are_not(self):
        self.assertEqual(
            unsupported_words(
                "Yes, Ada Muster led the 2019 insulin trial and has 40 researchers in her group.",
                [GLUCOSE],
            ),
            ["yes", "led", "2019", "insulin", "trial", "40", "researchers"],
        )
        self.assertEqual(
            unsupported_words("Prof. Muster works with H. Meier, not with Cleo.", [GLUCOSE]),
            ["prof", "h", "meier", "not"],
        )

    def test_a_plural_matches_its_singular(self):
        self.assertEqual(
            unsupported_words("Ada Muster works on wearable biosensor technologies.", [GLUCOSE]),
            ["technologies"],
        )
        self.assertEqual(
            unsupported_words("Cleo Beispiel studies glucose metabolisms in a mouse.", [GLUCOSE]),
            ["mouse"],
        )

    def test_a_project_a_result_is_shown_through_holds_its_words(self):
        results = response("carbohydrates", shown(EMIL, via=through_carb_counter()))
        reply = "Emil Exempel works on Carb Counter: carbohydrate estimation from meal photos."
        self.assertEqual(unsupported_words(reply, [results]), [])

    def test_no_results_hold_no_words(self):
        self.assertEqual(
            unsupported_words("Ada Muster works on glucose.", []), ["ada", "muster", "glucose"]
        )


if __name__ == "__main__":
    unittest.main()
