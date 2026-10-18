import unittest
from datetime import UTC, datetime

from bernlife.explain import explain_top
from bernlife.matching import asked
from bernlife.store import Relation
from bernlife.via import VIA_KINDS, relation_reasons, via_record
from search_fakes import APP_PAGE, PROFILES, FakeChat

BY_ID = {p["id"]: p for p in PROFILES}
EMIL, APP = BY_ID["person-demo-emil-exempel"], BY_ID["project-demo-carb-counter"]
FETCHED = datetime(2026, 10, 18, 12, 0, tzinfo=UTC)


def relation(to: str, kind: str = "works_on") -> Relation:
    span = "Project team: Emil Exempel"
    start = str(APP_PAGE["text"]).index(span)
    return Relation(EMIL["id"], to, kind, APP_PAGE["url"], APP_PAGE["sha256"], span, start, FETCHED)


class FakeStore:
    def __init__(self, relations: list[Relation]):
        self._relations = relations
        self.kinds: list[tuple[str, ...]] = []

    def relations(self, ids, kinds):
        self.kinds.append(tuple(kinds))
        return [r for r in self._relations if r.from_profile_id in ids and r.kind in kinds]

    def profiles(self, ids):
        return {i: BY_ID[i] for i in ids}

    def enrichment(self, values):
        return {}


class RelationReasonsTest(unittest.TestCase):
    def test_a_project_with_a_matching_claim_vouches_for_its_team_member(self):
        store = FakeStore([relation(APP["id"])])
        profiles, enrichment = {EMIL["id"]: EMIL}, {}
        found = relation_reasons(asked("meal photos"), [EMIL["id"]], store, profiles, enrichment)
        self.assertEqual(found, {EMIL["id"]: (relation(APP["id"]), [("expertise", 0)])})
        self.assertEqual(store.kinds, [("leads", "works_on")])
        self.assertIn(APP["id"], profiles)

    def test_no_matching_claim_on_the_project_vouches_for_nobody(self):
        store = FakeStore([relation(APP["id"])])
        self.assertEqual(relation_reasons(asked("glucose"), [EMIL["id"]], store, {}, {}), {})

    def test_unit_membership_never_vouches(self):
        self.assertEqual(VIA_KINDS, ("leads", "works_on"))
        store = FakeStore([relation(APP["id"], "member_of")])
        self.assertEqual(relation_reasons(asked("meal photos"), [EMIL["id"]], store, {}, {}), {})

    def test_the_record_carries_the_relation_and_the_matching_claims_inline(self):
        record = via_record(relation(APP["id"]), APP, [("expertise", 0)])
        self.assertEqual(
            record,
            {
                "kind": "works_on",
                "span": "Project team: Emil Exempel",
                "page_url": APP_PAGE["url"],
                "page_sha256": APP_PAGE["sha256"],
                "start": str(APP_PAGE["text"]).index("Project team"),
                "fetched_at": "2026-10-18T12:00:00Z",
                "related_profile_id": "project-demo-carb-counter",
                "related_name": "Carb Counter",
                "related_claims": [APP["fields"]["expertise"][0]],
            },
        )


class ExplainSkipsViaTest(unittest.TestCase):
    def test_a_result_shown_through_a_project_keeps_its_plain_reason(self):
        plain = {"text": "Name: Emil Exempel", "cites": ["/name"]}
        results = [
            {"rank": 1, "profile": EMIL, "reason": plain, "via": {"kind": "works_on"}},
            {"rank": 2, "profile": EMIL, "reason": plain},
        ]
        llm = FakeChat({"explain": {"text": "Emil Exempel.", "claims": [1]}})
        explained, outcomes = explain_top(llm, results, ["meal photos"] * 2)
        self.assertEqual((llm.asked, outcomes), (["explain"], ["kept"]))
        self.assertEqual(explained[0], results[0])
        self.assertEqual(explained[1]["reason"], {"text": "Emil Exempel.", "cites": ["/name"]})


if __name__ == "__main__":
    unittest.main()
