import unittest

from bernlife.matching import asked
from bernlife.reason import reason
from search_fakes import PROFILES

ADA, BEN = PROFILES[1], PROFILES[2]


class ReasonTest(unittest.TestCase):
    def test_claims_sharing_a_query_word_are_listed_and_cited(self):
        self.assertEqual(
            reason(asked("Glucose sensors in the Sensor Lab"), ADA),
            {
                "text": "Expertise: continuous glucose monitoring; Unit: Sensor Lab",
                "cites": ["/fields/expertise/0", "/fields/unit/0"],
            },
        )

    def test_a_meaning_only_match_describes_the_profile(self):
        self.assertEqual(
            reason(asked("blood sugar"), ADA),
            {
                "text": "Role: Group Leader; Unit: Sensor Lab;"
                " Expertise: continuous glucose monitoring",
                "cites": ["/fields/role/0", "/fields/unit/0", "/fields/expertise/0"],
            },
        )

    def test_a_profile_with_no_fields_cites_its_name(self):
        self.assertEqual(
            reason(asked("patch"), BEN), {"text": "Name: Ben Beispiel", "cites": ["/name"]}
        )

    def test_text_stays_within_400_characters_by_dropping_claims(self):
        long_value = {**ADA["fields"]["expertise"][0], "value": "glucose " + "x" * 190}
        many = {**ADA, "fields": {**ADA["fields"], "expertise": [long_value] * 4}}
        result = reason(asked("glucose"), many)
        self.assertEqual(result["cites"], ["/fields/expertise/0"])
        self.assertLessEqual(len(result["text"]), 400)


if __name__ == "__main__":
    unittest.main()
