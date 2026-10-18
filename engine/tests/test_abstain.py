import unittest

from bernlife.abstain import (
    MIN_COVERAGE,
    MIN_SIMILARITY,
    abstain_reason,
    named_people,
    unmatched_person,
    weak_support,
)
from bernlife.ranking import Candidate


def candidate(name: str, kind: str = "person", coverage=0.9, similarity=0.9) -> Candidate:
    return Candidate(f"{kind}-x", kind, name, "Unit", 0.03, 1, 1, coverage, similarity)


class NamedPeopleTest(unittest.TestCase):
    def test_names_after_titles_in_three_languages(self):
        self.assertEqual(
            named_people("What does Prof. Dr. Ada Muster's lab publish?"), [("ada", "muster")]
        )
        self.assertEqual(named_people("Travaux de Mme Dora Demo, svp"), [("dora", "demo")])
        self.assertEqual(
            named_people("Woran forscht Prof. Dr. med. Ben Beispiel?"), [("ben", "beispiel")]
        )

    def test_particles_are_skipped_and_a_name_stops_at_punctuation(self):
        self.assertEqual(named_people("Dr. Ada von Muster, glucose"), [("ada", "muster")])

    def test_no_title_no_name(self):
        self.assertEqual(named_people("Ada Muster glucose sensors"), [])
        self.assertEqual(named_people("Dr. who studies sleep"), [])


class AbstainTest(unittest.TestCase):
    def test_an_invented_titled_name_abstains_with_the_dev_thresholds(self):
        found = [candidate("Ada Muster"), candidate("Glucose Lab", "unit")]
        query = "What does Prof. Hugo Brandtner publish on glucose sensors?"
        self.assertTrue(unmatched_person(query, found))
        self.assertEqual(abstain_reason(query, found), "no_verifiable_source")

    def test_a_named_person_found_among_candidates_passes(self):
        found = [candidate("Prof. Dr. Ada Muster")]
        self.assertIsNone(abstain_reason("What does Prof. Muster publish?", found))

    def test_a_name_on_a_unit_profile_does_not_count_as_the_person(self):
        found = [candidate("Muster Lab", "unit")]
        self.assertTrue(unmatched_person("Dr. Muster", found))

    def test_weak_support_needs_both_signals_below_the_dev_thresholds(self):
        below = candidate(
            "Ada Muster", coverage=MIN_COVERAGE - 0.01, similarity=MIN_SIMILARITY - 0.01
        )
        lexical_only = candidate("Ada Muster", coverage=MIN_COVERAGE, similarity=0.0)
        vector_only = candidate("Ada Muster", coverage=0.0, similarity=MIN_SIMILARITY)
        self.assertTrue(weak_support([below]))
        self.assertFalse(weak_support([below, lexical_only]))
        self.assertFalse(weak_support([vector_only]))
        self.assertEqual(abstain_reason("glucose", [below]), "no_verifiable_source")

    def test_no_candidates_abstains(self):
        self.assertEqual(abstain_reason("glucose", []), "no_verifiable_source")

    def test_thresholds_are_the_ones_docs_search_md_records(self):
        self.assertEqual((MIN_COVERAGE, MIN_SIMILARITY), (0.332, 0.824))


if __name__ == "__main__":
    unittest.main()
