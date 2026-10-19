import unittest
from datetime import UTC, datetime

from bernlife.matching import asked
from bernlife.reason import reason
from bernlife.store import Relation
from bernlife.via import via_record
from search_fakes import APP_PAGE, PROFILES

ADA, BEN = PROFILES[1], PROFILES[2]
EMIL, CARB = PROFILES[5], PROFILES[6]
FETCHED = datetime(2026, 10, 18, 12, 0, tzinfo=UTC)


def through_carb_counter(kind: str = "works_on") -> dict:
    span = "Project team: Emil Exempel"
    start = str(APP_PAGE["text"]).index(span)
    relation = Relation(
        EMIL["id"], CARB["id"], kind, APP_PAGE["url"], APP_PAGE["sha256"], span, start, FETCHED
    )
    return via_record(relation, CARB, [("expertise", 0)])


class ReasonTest(unittest.TestCase):
    def test_claims_sharing_a_query_word_are_listed_and_cited(self):
        self.assertEqual(
            reason(asked("Glucose sensors in the Sensor Lab"), ADA),
            {
                "text": "Expertise: continuous glucose monitoring; Unit: Sensor Lab",
                "cites": ["/fields/expertise/0", "/fields/unit/0"],
            },
        )

    def test_claims_sharing_the_word_as_written_come_before_those_sharing_its_form(self):
        self.assertEqual(
            reason(asked("glucose sensors"), ADA),
            {"text": "Expertise: continuous glucose monitoring", "cites": ["/fields/expertise/0"]},
        )
        self.assertEqual(
            reason(asked("sensors"), ADA), {"text": "Unit: Sensor Lab", "cites": ["/fields/unit/0"]}
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


class RelationReasonTest(unittest.TestCase):
    def test_a_result_shown_through_a_project_gives_the_relation_sentence(self):
        self.assertEqual(
            reason(asked("carbohydrate estimation"), EMIL, via=through_carb_counter()),
            {
                "text": "Works on Carb Counter: carbohydrate estimation from meal photos",
                "cites": ["/via/related_claims/0"],
            },
        )

    def test_the_verb_follows_the_relation_kind(self):
        found = reason(asked("meal photos"), EMIL, via=through_carb_counter("leads"))
        self.assertEqual(
            found["text"], "Leads Carb Counter: carbohydrate estimation from meal photos"
        )

    def test_the_relation_sentence_stays_within_400_characters(self):
        via = through_carb_counter()
        long_claim = {**via["related_claims"][0], "value": "x" * 200}
        many = reason(asked("meal photos"), EMIL, via=via | {"related_claims": [long_claim] * 4})
        self.assertEqual(many["cites"], ["/via/related_claims/0"])
        self.assertEqual(many["text"], "Works on Carb Counter: " + "x" * 200)
        long_name = via | {"related_name": "C" * 200, "related_claims": [long_claim]}
        self.assertEqual(
            reason(asked("meal photos"), EMIL, via=long_name),
            {"text": "Works on " + "C" * 200, "cites": ["/via/related_claims/0"]},
        )


if __name__ == "__main__":
    unittest.main()
