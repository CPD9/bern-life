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

    def test_slots_outside_the_case_sources_or_on_unstored_pages_are_counted_apart(self) -> None:
        pages, profiles = snapshot({("unibe", "U1"): 1, ("dcb", "D"): 2, ("snsf", "Calls"): 4})
        unstored = profile("person-unibe-gone", "person", "P gone", "https://unibe.test/gone")
        queries = [gold("q100")]
        responses = {
            "q100": response(
                [
                    result(1, profiles["person-snsf-calls-0"]),
                    result(2, unstored),
                    result(3, profiles["person-dcb-d-0"]),
                ]
            )
        }
        sized = exposure_by_size(score_all(queries, responses, None, None), profiles, pages)
        self.assertEqual(sized["slots_outside"], 2)
        small, large = sized["groups"]
        self.assertEqual((small["units"], small["slots"]), (1, 0))
        self.assertEqual((large["units"], large["slots"], large["slot_share"]), (1, 1, 1.0))

    def test_the_same_groups_within_each_source(self) -> None:
        pages, profiles = snapshot(
            {
                ("unibe", "U1"): 1,
                ("unibe", "U2"): 2,
                ("unibe", "U3"): 6,
                ("artorg", "A"): 5,
            }
        )
        queries = [gold("q100"), gold("q200")]
        responses = {
            "q100": response(
                [
                    result(1, profiles["person-artorg-a-0"]),
                    result(2, profiles["person-artorg-a-1"]),
                    result(3, profiles["person-unibe-u3-0"]),
                ]
            ),
            "q200": response([result(1, profiles["person-unibe-u1-0"])]),
        }
        sized = exposure_by_size(score_all(queries, responses, None, None), profiles, pages)
        self.assertEqual(sized["median_profiles"], 3.5)
        by_source = {row["source"]: row["groups"] for row in sized["by_source"]}
        self.assertEqual(list(by_source), ["unibe", "artorg"])
        small, large = by_source["unibe"]
        self.assertEqual((small["units"], small["profiles"], small["slots"]), (2, 3, 1))
        self.assertEqual((large["units"], large["profiles"], large["slots"]), (1, 6, 1))
        # Shares of UniBE's own 9 profiles and 2 slots; U2 is never shown.
        self.assertAlmostEqual(small["profile_share"], 3 / 9)
        self.assertEqual((small["slot_share"], small["units_never_shown"]), (0.5, 1))
        # ARTORG has one large unit and no small one, so it has one row.
        (artorg,) = by_source["artorg"]
        self.assertEqual((artorg["name"], artorg["units"], artorg["slot_share"]), ("large", 1, 1.0))

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
