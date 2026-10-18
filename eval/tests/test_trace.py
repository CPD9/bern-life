import unittest

from evaluator.trace import Miss, PageIndex, check_claims, invented
from records import claim, page, profile, result

URL = "https://www.example.test/team/ada"
TEXT = "Prof. Dr. Ada Muster leads the Sensor Lab and builds glucose patches."


class TraceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.page = page(URL, TEXT)
        self.index = PageIndex({URL: self.page})
        self.sha = self.page["sha256"]

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

    def test_profile_missing_from_snapshot_is_invented(self) -> None:
        shown = [result(1, self.ada()), result(2, profile("person-ghost", "person", "Ghost", URL))]
        self.assertEqual(invented(shown, {"person-ada": self.ada()}), ("person-ghost",))


if __name__ == "__main__":
    unittest.main()
