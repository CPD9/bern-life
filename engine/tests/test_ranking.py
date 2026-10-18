import unittest

from bernlife.ranking import Candidate, candidates, cap_units, profile_ranks, rrf
from bernlife.search_sql import Hit


def hit(signal: str, profile_id: str, chunk_rank: int, strength: float = 0.5) -> Hit:
    return Hit(signal, profile_id, chunk_rank, strength, "person", profile_id, "Unit A")


def candidate(profile_id: str, unit: str, fused: float) -> Candidate:
    return Candidate(profile_id, "person", profile_id, unit, fused, 1, 1, 0.5, 0.9)


class RrfTest(unittest.TestCase):
    def test_fused_scores_on_hand_built_lists(self):
        fused = rrf([{"a": 1, "b": 2, "c": 3}, {"c": 1, "a": 2}])
        self.assertEqual(fused, {"a": 1 / 61 + 1 / 62, "b": 1 / 62, "c": 1 / 63 + 1 / 61})

    def test_k_changes_the_weights(self):
        self.assertEqual(rrf([{"a": 1}], k=0), {"a": 1.0})

    def test_profiles_credited_by_one_chunk_go_by_id_and_keep_their_best_rank(self):
        hits = [hit("lexical", "z", 1), hit("lexical", "y", 1), hit("lexical", "z", 7)]
        hits.append(hit("vector", "x", 2))
        self.assertEqual(profile_ranks(hits, "lexical"), {"y": 1, "z": 2})

    def test_candidates_carry_both_ranks_and_strengths(self):
        hits = [hit("lexical", "a", 1, 0.8), hit("vector", "b", 1, 0.9), hit("vector", "a", 2)]
        found = candidates(hits)
        self.assertEqual([c.profile_id for c in found], ["a", "b"])
        self.assertEqual(
            (found[0].fused, found[0].lexical_rank, found[0].vector_rank), (1 / 61 + 1 / 62, 1, 2)
        )
        self.assertEqual(
            (found[1].lexical_rank, found[1].coverage, found[1].similarity), (None, 0.0, 0.9)
        )


class UnitCapTest(unittest.TestCase):
    def test_a_unit_with_eight_matches_gets_four_of_the_top_ten(self):
        big = [candidate(f"big-{n}", "Big Unit", 1.0 - n / 100) for n in range(8)]
        small = [candidate(f"small-{n}", f"Unit {n}", 0.5 - n / 100) for n in range(8)]
        ranked = cap_units([*big, *small])
        self.assertEqual(
            [c.profile_id for c in ranked[:10]],
            ["big-0", "big-1", "big-2", "big-3"] + [f"small-{n}" for n in range(6)],
        )
        self.assertEqual(
            [c.profile_id for c in ranked[10:]],
            ["big-4", "big-5", "big-6", "big-7", "small-6", "small-7"],
        )

    def test_the_cap_relaxes_when_no_other_unit_has_candidates(self):
        only = [candidate(f"p-{n}", "One Unit", 1.0 - n / 100) for n in range(12)]
        self.assertEqual(cap_units(only), only)

    def test_fewer_candidates_than_slots_keep_their_order(self):
        few = [candidate("a", "U", 0.9), candidate("b", "U", 0.8), candidate("c", "V", 0.7)]
        self.assertEqual([c.profile_id for c in cap_units(few, cap=1)], ["a", "c", "b"])


if __name__ == "__main__":
    unittest.main()
