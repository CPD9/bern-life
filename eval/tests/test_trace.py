import unittest

from evaluator.trace import Miss, PageIndex, check_claims, invented
from records import claim, page, profile, result

URL = "https://www.example.test/team/ada"
TEXT = "Prof. Dr. Ada Muster leads the Sensor Lab and builds glucose patches."
LAB_URL = "https://www.example.test/projects/sensor-lab"
LAB_TEXT = "The Sensor Lab develops wearable sweat sensors for athletes."


class TraceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.page = page(URL, TEXT)
        self.lab_page = page(LAB_URL, LAB_TEXT)
        self.index = PageIndex({URL: self.page, LAB_URL: self.lab_page})
        self.sha = self.page["sha256"]
        self.lab_sha = self.lab_page["sha256"]

    def ada(self) -> dict:
        ada = profile("person-ada", "person", "Ada Muster", URL, sha=self.sha)
        ada["name"] = claim("Ada Muster", URL, self.sha, span="Prof. Dr. Ada Muster")
        return ada

    def test_span_with_normalised_spaces_is_traceable(self) -> None:
        self.assertEqual(check_claims("q100", [result(1, self.ada())], self.index), (1, []))

    def test_each_kind_of_miss_is_listed(self) -> None:
        ada = self.ada()
        ada["fields"]["expertise"] = [
            claim("glucose patches", URL, self.sha, span="builds glucose plasters"),
            claim("glucose patches", URL, "f" * 64),
            claim("glucose patches", "https://www.example.test/elsewhere", self.sha),
        ]
        checked, misses = check_claims("q100", [result(1, ada)], self.index)
        self.assertEqual(checked, 4)
        self.assertEqual(
            misses,
            [
                Miss("q100", "person-ada", "/fields/expertise/0", "span_not_on_page"),
                Miss("q100", "person-ada", "/fields/expertise/1", "page_sha256_differs"),
                Miss("q100", "person-ada", "/fields/expertise/2", "page_not_in_snapshot"),
            ],
        )

    def via(
        self, span: str = "leads the Sensor Lab", related: str = "wearable sweat sensors"
    ) -> dict:
        return {
            "kind": "leads",
            "span": span,
            "page_url": URL,
            "page_sha256": self.sha,
            "related_profile_id": "project-sensor-lab",
            "related_name": "Sensor Lab",
            "related_claims": [claim("sweat sensors", LAB_URL, self.lab_sha, span=related)],
        }

    def test_a_via_relation_and_its_related_claims_are_checked_too(self) -> None:
        shown = result(1, self.ada())
        shown["via"] = self.via()
        self.assertEqual(check_claims("q100", [shown], self.index), (3, []))

        shown["via"] = self.via(span="co-leads the Sensor Lab", related="sweat plasters")
        self.assertEqual(
            check_claims("q100", [shown], self.index),
            (
                3,
                [
                    Miss("q100", "person-ada", "/via", "span_not_on_page"),
                    Miss("q100", "person-ada", "/via/related_claims/0", "span_not_on_page"),
                ],
            ),
        )

    def test_a_passage_on_the_results_own_page_is_checked_too(self) -> None:
        shown = result(1, self.ada())
        shown["passage"] = {
            "kind": "own_page",
            "span": "Ada Muster leads the Sensor Lab and builds glucose",
            "page_url": URL,
            "page_sha256": self.sha,
            "start": 10,
            "fetched_at": "2026-10-18T12:00:00Z",
        }
        self.assertEqual(check_claims("q100", [shown], self.index), (2, []))

        shown["passage"] = shown["passage"] | {"span": "Ada Muster builds glucose"}
        self.assertEqual(
            check_claims("q100", [shown], self.index),
            (2, [Miss("q100", "person-ada", "/passage", "span_not_on_page")]),
        )
        shown["passage"] = shown["passage"] | {"page_sha256": "f" * 64}
        self.assertEqual(
            check_claims("q100", [shown], self.index),
            (2, [Miss("q100", "person-ada", "/passage", "page_sha256_differs")]),
        )

    def test_a_related_profile_missing_from_snapshot_is_invented(self) -> None:
        shown = result(1, self.ada())
        shown["via"] = self.via()
        self.assertEqual(invented([shown], {"person-ada": self.ada()}), ("project-sensor-lab",))
        self.assertEqual(
            invented([shown], {"person-ada": self.ada(), "project-sensor-lab": {}}), ()
        )

    def test_profile_missing_from_snapshot_is_invented(self) -> None:
        shown = [result(1, self.ada()), result(2, profile("person-ghost", "person", "Ghost", URL))]
        self.assertEqual(invented(shown, {"person-ada": self.ada()}), ("person-ghost",))


if __name__ == "__main__":
    unittest.main()
