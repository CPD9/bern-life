import unittest

from bernlife.matching import can_explain, matched_claims, names_profile, words
from search_fakes import PROFILES

CLEO, ADA, BEN, DORA, PATCH = PROFILES


class WordsTest(unittest.TestCase):
    def test_function_and_search_words_never_count_as_a_match(self):
        self.assertEqual(
            words("Who in Bern does research on the Glukose-Überwachung für Kinder?"),
            {"glukose", "uberwachung", "kinder"},
        )

    def test_a_shared_function_word_is_not_a_reason(self):
        self.assertEqual(matched_claims("membrane proteins and lipids", ADA), [])
        self.assertEqual(matched_claims("membrane proteins and lipids", DORA), [("expertise", 0)])


class CanExplainTest(unittest.TestCase):
    def test_a_bare_name_is_not_shown_for_a_topic_query(self):
        self.assertFalse(can_explain("skin-worn patch for diabetes", BEN))

    def test_a_bare_name_is_shown_when_the_query_names_the_person(self):
        self.assertTrue(names_profile("what does Ben Beispiel build?", BEN))
        self.assertTrue(can_explain("Woran arbeitet Dr. Beispiel?", BEN))
        self.assertFalse(can_explain("Woran arbeitet Dr. Muster?", BEN))

    def test_a_titled_surname_names_only_people(self):
        lab = {**ADA, "id": "unit-example-sensor-lab", "kind": "unit"}
        lab = {**lab, "name": {**ADA["name"], "value": "Sensor Lab"}}
        self.assertFalse(names_profile("Dr. Sensor", lab))
        self.assertTrue(names_profile("the Sensor Lab", lab))
        self.assertTrue(names_profile("the GlucoPatch project", PATCH))

    def test_a_claim_besides_the_name_that_shares_a_word_explains_a_result(self):
        self.assertTrue(can_explain("wearable sensors", ADA))
        self.assertEqual(matched_claims("Sensor Lab glucose", ADA), [("expertise", 0), ("unit", 0)])


if __name__ == "__main__":
    unittest.main()
