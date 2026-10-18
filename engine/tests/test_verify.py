import unittest

from bernlife.extract_records import Candidate, RelationCandidate, Subject
from bernlife.extract_selectors import person_subject
from bernlife.verify import recheck, verify_all, verify_claim, verify_relation
from extract_fakes import ADA_PAGE, LAB, LAB_PAGE, TEAM_PAGE

ADA = person_subject("example", "Ada Muster")
CARA = person_subject("example", "Cara Probst")
LAB_UNIT = Subject("unit", "example", "url:" + LAB, "Sensor Lab")
LONG_TEXT = "x" * 301


def claim(subject: Subject, value: str, span: str, page_url: str, field: str = "expertise"):
    return Candidate(subject, field, value, span, "model", page_url)


class VerifyClaimTest(unittest.TestCase):
    def outcome(self, candidate: Candidate, page=ADA_PAGE, own=ADA) -> str:
        result = verify_claim(candidate, page, own)
        return result if isinstance(result, str) else f"kept at {result.evidence.start}"

    def test_table(self):
        cases = [
            (claim(ADA, "wearable biosensors", "wearable biosensors", ADA_PAGE.url), "kept at 190"),
            (
                claim(ADA, "wearable biosensors", "wearable  biosensors", ADA_PAGE.url),
                "span_not_in_page",
            ),
            (
                claim(ADA, "Wearable Biosensors", "develops wearable biosensors", ADA_PAGE.url),
                "kept at 181",
            ),
            (claim(ADA, "insulin pumps", "wearable biosensors", ADA_PAGE.url), "value_not_in_span"),
            (claim(ADA, "", "wearable biosensors", ADA_PAGE.url), "value_not_in_span"),
            (claim(ADA, "", "", ADA_PAGE.url), "span_not_in_page"),
            (claim(ADA, "[phone]", "[phone]", ADA_PAGE.url, "role"), "contact_only"),
            (claim(ADA, "x", LONG_TEXT, ADA_PAGE.url), "too_long"),
            (claim(ADA, "y" * 201, "wearable biosensors", ADA_PAGE.url), "too_long"),
        ]
        for candidate, expected in cases:
            with self.subTest(span=candidate.span[:30], value=candidate.value[:30]):
                self.assertEqual(self.outcome(candidate), expected)

    def test_a_span_on_another_page_is_dropped(self):
        candidate = claim(ADA, "cleanroom", "We operate a cleanroom", ADA_PAGE.url)
        self.assertEqual(self.outcome(candidate), "span_not_in_page")

    def test_a_person_claim_from_a_list_line_must_name_the_person(self):
        naming = claim(
            CARA, "Lab Manager", "Cara Probst, PhD\nFunktion\nLab Manager", TEAM_PAGE.url
        )
        bare = claim(CARA, "Lab Manager", "Lab Manager", TEAM_PAGE.url, "role")
        self.assertEqual(self.outcome(naming, TEAM_PAGE, None), "kept at 52")
        self.assertEqual(self.outcome(bare, TEAM_PAGE, None), "wrong_page")

    def test_an_invented_person_is_not_a_name(self):
        company = person_subject("example", "Sensor Lab")
        candidate = claim(company, "Sensor Lab", "Sensor Lab", LAB_PAGE.url, "name")
        self.assertEqual(self.outcome(candidate, LAB_PAGE, LAB_UNIT), "not_a_name")

    def test_kept_claim_carries_page_hash_and_fetch_date(self):
        kept = verify_claim(claim(ADA, "Group Leader", "Group Leader", ADA_PAGE.url), ADA_PAGE, ADA)
        self.assertEqual(
            kept.evidence.as_record(),
            {
                "page_url": ADA_PAGE.url,
                "page_sha256": ADA_PAGE.sha256,
                "span": "Group Leader",
                "start": 62,
                "fetched_at": "2026-10-18T12:00:00Z",
            },
        )


class VerifyRelationTest(unittest.TestCase):
    def relation(self, span: str, kind: str = "leads") -> str:
        candidate = RelationCandidate(ADA, LAB_UNIT, kind, span, "model", LAB_PAGE.url)
        result = verify_relation(candidate, LAB_PAGE, LAB_UNIT)
        return result if isinstance(result, str) else result.kind

    def test_leads_needs_a_leadership_word_else_member(self):
        self.assertEqual(self.relation("headed by Dr. Ada Muster"), "leads")
        self.assertEqual(self.relation("Dr. Ada Muster"), "member_of")

    def test_relation_span_must_name_the_person_and_be_on_the_page(self):
        self.assertEqual(self.relation("The Sensor Lab is"), "wrong_page")
        self.assertEqual(self.relation("Ada Muster heads the lab"), "span_not_in_page")


class VerifyAllTest(unittest.TestCase):
    def test_counts_every_drop_by_reason(self):
        pages = {page.url: page for page in (ADA_PAGE, LAB_PAGE)}
        candidates = [
            claim(ADA, "wearable biosensors", "wearable biosensors", ADA_PAGE.url),
            claim(ADA, "insulin pumps", "insulin pumps", ADA_PAGE.url),
            claim(ADA, "cleanroom", "We operate a cleanroom", LAB_PAGE.url),
        ]
        result = verify_all(candidates, [], pages, {ADA_PAGE.url: ADA, LAB_PAGE.url: LAB_UNIT})
        self.assertEqual([c.value for c in result.claims], ["wearable biosensors"])
        self.assertEqual(dict(result.dropped), {"span_not_in_page": 1, "wrong_page": 1})


class RecheckTest(unittest.TestCase):
    def test_reports_a_span_that_moved(self):
        evidence = {
            "page_url": ADA_PAGE.url,
            "page_sha256": ADA_PAGE.sha256,
            "span": "Group Leader",
            "start": 60,
        }
        profile = {
            "id": "person-example-ada-muster",
            "name": {"value": "Group Leader", "evidence": evidence},
            "fields": {},
        }
        self.assertEqual(
            recheck([profile], [], {ADA_PAGE.url: ADA_PAGE}),
            [f"person-example-ada-muster: span not at 60 in {ADA_PAGE.url}"],
        )


if __name__ == "__main__":
    unittest.main()
