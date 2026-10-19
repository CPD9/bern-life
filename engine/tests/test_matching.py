import unittest

from bernlife.matching import asked, can_explain, forms, matched_claims, names_profile, words
from search_fakes import PROFILES

CLEO, ADA, BEN, DORA, PATCH = PROFILES[:5]


class WordsTest(unittest.TestCase):
    def test_function_and_search_words_never_count_as_a_match(self):
        self.assertEqual(
            words("Who in Bern does research on the Glukose-Überwachung für Kinder?"),
            {"glukose", "uberwachung", "kinder"},
        )

    def test_forms_drop_function_words_in_any_of_their_forms(self):
        self.assertEqual(
            forms("Welche Forscher untersuchen Kohlenhydraten in diesen Mahlzeiten?"),
            {"untersuch", "kohlenhydrat", "mahlzeit"},
        )

    def test_a_shared_function_word_is_not_a_reason(self):
        self.assertEqual(matched_claims(asked("membrane proteins and lipids"), ADA), [])
        self.assertEqual(
            matched_claims(asked("membrane proteins and lipids"), DORA), [("expertise", 0)]
        )


class CanExplainTest(unittest.TestCase):
    def test_a_bare_name_is_not_shown_for_a_topic_query(self):
        self.assertFalse(can_explain(asked("skin-worn patch for diabetes"), BEN))

    def test_a_bare_name_is_shown_when_the_query_names_the_person(self):
        self.assertTrue(names_profile("what does Ben Beispiel build?", BEN))
        self.assertTrue(can_explain(asked("Woran arbeitet Dr. Beispiel?"), BEN))
        self.assertFalse(can_explain(asked("Woran arbeitet Dr. Muster?"), BEN))

    def test_a_titled_surname_names_only_people(self):
        lab = {**ADA, "id": "unit-example-sensor-lab", "kind": "unit"}
        lab = {**lab, "name": {**ADA["name"], "value": "Sensor Lab"}}
        self.assertFalse(names_profile("Dr. Sensor", lab))
        self.assertTrue(names_profile("the Sensor Lab", lab))
        self.assertTrue(names_profile("the GlucoPatch project", PATCH))

    def test_a_claim_besides_the_name_that_shares_a_word_explains_a_result(self):
        self.assertTrue(can_explain(asked("wearable sensors"), ADA))
        self.assertEqual(
            matched_claims(asked("Sensor Lab glucose"), ADA), [("expertise", 0), ("unit", 0)]
        )

    def test_a_claim_matches_another_form_of_a_question_word(self):
        self.assertEqual(matched_claims(asked("sensors"), ADA), [("unit", 0)])
        self.assertEqual(matched_claims(asked("biosensor patch"), ADA), [("expertise", 1)])
        self.assertEqual(matched_claims(asked("proteines"), DORA), [("expertise", 0)])
        self.assertEqual(matched_claims(asked("Kohlenhydraten"), ADA), [])

    def test_a_claim_matches_through_its_enrichment_terms(self):
        enrichment = {"wearable biosensors": ["smart skin patches"]}
        self.assertEqual(matched_claims(asked("patches"), ADA, enrichment), [("expertise", 1)])
        self.assertEqual(matched_claims(asked("patches"), ADA), [])

    def test_the_question_matches_through_its_expansion_terms(self):
        self.assertEqual(
            matched_claims(asked("Blutzucker", ["glucose monitoring"]), ADA), [("expertise", 0)]
        )
        self.assertEqual(asked("Blutzucker", ["glucose monitoring"]).query, "Blutzucker")


if __name__ == "__main__":
    unittest.main()
