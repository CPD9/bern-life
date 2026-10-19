import unittest

from evaluator.coverage import exposure_by_size
from evaluator.score import score_all
from records import gold, page, profile, response, result


def snapshot(sizes: dict[tuple[str, str], int]) -> tuple[dict, dict]:
    """Invented pages, one per unit, and that many profiles linking to each."""
    pages, profiles = {}, {}
    for (source, unit), size in sizes.items():
        url = f"https://{source}.test/{unit}"
        pages[url] = page(url, f"Invented page of {unit}.", unit=unit) | {"source_id": source}
        for n in range(size):
            pid = f"person-{source}-{unit.lower()}-{n}"
            profiles[pid] = profile(pid, "person", f"P {unit} {n}", url, source=source)
    return pages, profiles


class ExposureBySizeTest(unittest.TestCase):
    def test_median_split_and_slot_shares(self) -> None:
        pages, profiles = snapshot(
            {
                ("unibe", "U1"): 3,
                ("unibe", "U2"): 1,
                ("unibe", "U3"): 2,
                ("artorg", "A"): 5,
                ("snsf", "Calls"): 9,
            }
        )
        queries = [gold("q100"), gold("q200"), gold("q300", variant="invented", abstain=True)]
        responses = {
            "q100": response(
                [
                    result(1, profiles["person-artorg-a-0"]),
                    result(2, profiles["person-unibe-u1-0"]),
                    result(3, profiles["person-unibe-u2-0"]),
                ]
            ),
            "q200": response([result(1, profiles["person-artorg-a-1"])]),
            "q300": response([result(1, profiles["person-unibe-u3-0"])]),
        }
        sized = exposure_by_size(score_all(queries, responses, None, None), profiles, pages)
        self.assertEqual(sized["median_profiles"], 2.5)
        self.assertEqual(sized["slots_outside"], 0)
        small, large = sized["groups"]
        self.assertEqual(
            (small["name"], small["units"], small["profiles"], small["slots"]), ("small", 2, 3, 1)
        )
        self.assertEqual(
            (large["name"], large["units"], large["profiles"], large["slots"]), ("large", 2, 8, 3)
        )
        self.assertAlmostEqual(small["profile_share"], 3 / 11)
        self.assertAlmostEqual(large["slot_share"], 3 / 4)
        # U3 was shown only for an invented question, which does not count.
        self.assertEqual((small["units_never_shown"], large["units_never_shown"]), (1, 0))

    def test_a_unit_at_the_median_is_small(self) -> None:
        pages, profiles = snapshot(
            {("unibe", "U1"): 1, ("unibe", "U2"): 2, ("unibe", "U3"): 2, ("dcb", "D"): 3}
        )
        queries = [gold("q100")]
        responses = {"q100": response([result(1, profiles["person-unibe-u2-0"])])}
        sized = exposure_by_size(score_all(queries, responses, None, None), profiles, pages)
        small, large = sized["groups"]
        self.assertEqual(sized["median_profiles"], 2)
        self.assertEqual((small["units"], large["units"]), (3, 1))
        self.assertEqual((small["slot_share"], large["slot_share"]), (1.0, 0.0))

    def test_without_the_snapshot_it_is_not_computed(self) -> None:
        results = score_all([gold("q100")], {"q100": response([])}, None, None)
        self.assertIsNone(exposure_by_size(results, None, None))


if __name__ == "__main__":
    unittest.main()
