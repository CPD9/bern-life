"""Selectors, model pass, verifier, merge and relations together, on invented pages."""

import unittest
from functools import partial

from bernlife.extract import extract
from bernlife.extract_model import TOPICS_PROMPT, model_pass
from bernlife.verify import recheck
from extract_fakes import ADA_ENG, INSTITUTE, LAB, LAB_PAGE, PAGES, TEAM, FakeModel

ADA_ID, BEN_ID, CARA_ID = (
    f"person-example-{name}" for name in ("ada-muster", "ben-beispiel", "cara-probst")
)
INSTITUTE_ID = "unit-example-example-institute-for-engineering"
LAB_ID = "unit-example-sensor-lab"


def run(model=None):
    model_pass_with = partial(model_pass, ask=model or FakeModel(), is_cached=lambda m: False)
    return extract(PAGES, PAGES, model_pass_with)


class MergeTest(unittest.TestCase):
    def test_twins_and_titled_mentions_meet_in_one_profile(self):
        result = run()
        self.assertEqual(
            [p["id"] for p in result.profiles],
            [ADA_ID, BEN_ID, CARA_ID, "person-example-dora-demo", INSTITUTE_ID, LAB_ID],
        )
        ada = result.profiles[0]
        self.assertEqual((ada["name"]["value"], ada["source_url"]), ("Ada Muster", ADA_ENG))
        values = {field: [c["value"] for c in claims] for field, claims in ada["fields"].items()}
        self.assertEqual(
            values,
            {
                "role": ["Group Leader", "Gruppenleiterin"],
                "unit": [
                    "Example Institute for Engineering",
                    "Sensor Lab",
                    "Beispielinstitut für Technik",
                ],
                "expertise": ["wearable biosensors", "continuous glucose monitoring"],
                "projects": [],
                "infrastructure": [],
                "services": [],
            },
        )
        self.assertEqual(result.profiles[4]["source_url"], TEAM)

    def test_drops_are_counted_and_the_invented_person_is_gone(self):
        result = run()
        self.assertEqual(
            dict(result.dropped), {"bad_json": 2, "span_not_in_page": 3, "wrong_page": 1}
        )
        self.assertNotIn("person-example-erika-erfunden", [p["id"] for p in result.profiles])
        self.assertEqual((result.model_pages, result.model_calls), (5, 5))

    def test_same_input_gives_the_same_output(self):
        self.assertEqual(run(), run())


class TopicsTest(unittest.TestCase):
    def test_topic_claims_join_the_profile_the_selectors_built(self):
        reply = {
            "subject": {
                "expertise": [
                    {"value": "wearable biosensors", "span": "develops wearable biosensors"},
                    {"value": "insulin pumps", "span": "insulin pumps for children"},
                ],
                "projects": [{"value": "GlucoPatch", "span": "GlucoPatch"}],
            },
            "people": [{"name": {"value": "Erika Erfunden", "span": "Ada Muster"}}],
        }
        topics = partial(model_pass, ask=FakeModel({"Ada Muster": reply}), is_cached=lambda m: True)
        topics = partial(topics, prompt=TOPICS_PROMPT)
        seen: list[list[str]] = []

        def select(profiles):
            seen.append([p["id"] for p in profiles])
            return [p for p in PAGES if p.url == ADA_ENG]

        result = extract(PAGES, topics=(select, topics))
        self.assertEqual(seen, [[p["id"] for p in extract(PAGES).profiles]])
        self.assertEqual(
            [p["id"] for p in result.profiles], [p["id"] for p in extract(PAGES).profiles]
        )
        ada = result.profiles[0]
        self.assertEqual(
            {field: [c["value"] for c in claims] for field, claims in ada["fields"].items()},
            {
                "role": ["Group Leader", "Gruppenleiterin"],
                "unit": [
                    "Example Institute for Engineering",
                    "Sensor Lab",
                    "Beispielinstitut für Technik",
                ],
                "expertise": ["wearable biosensors"],
                "projects": [],
                "infrastructure": [],
                "services": [],
            },
        )
        self.assertEqual(
            ada["fields"]["expertise"][0],
            {
                "value": "wearable biosensors",
                "method": "model",
                "evidence": {
                    "page_url": ADA_ENG,
                    "page_sha256": PAGES[0].sha256,
                    "span": "develops wearable biosensors",
                    "start": PAGES[0].text.index("develops wearable"),
                    "fetched_at": "2026-10-18T12:00:00Z",
                },
            },
        )
        self.assertEqual(dict(result.dropped), {"span_not_in_page": 2})
        self.assertEqual(
            (result.model_pages, result.topic_pages, result.topic_calls, result.topic_cached),
            (0, 1, 1, 1),
        )


class RelationsTest(unittest.TestCase):
    def test_rows_carry_verified_spans_in_entity_relation_columns(self):
        relations = run().relations
        rows = [
            (r["from_profile_id"], r["to_profile_id"], r["kind"], r["method"], r["span"])
            for r in relations
        ]
        affiliation = "University of Bern, Example Institute for Engineering, Sensor Lab"
        self.assertEqual(
            rows,
            [
                (
                    ADA_ID,
                    INSTITUTE_ID,
                    "member_of",
                    "selector",
                    "Example Institute for Engineering",
                ),
                (ADA_ID, LAB_ID, "leads", "model", "headed by Dr. Ada Muster"),
                (ADA_ID, LAB_ID, "member_of", "selector", affiliation),
                (BEN_ID, LAB_ID, "member_of", "model", "Ben Beispiel works on GlucoPatch"),
                (CARA_ID, INSTITUTE_ID, "member_of", "model", "Cara Probst, PhD"),
                (LAB_ID, INSTITUTE_ID, "part_of", "selector", "Example Institute for Engineering"),
            ],
        )
        self.assertEqual(
            list(relations[5].items())[4:],
            [
                ("page_url", LAB),
                ("page_sha256", LAB_PAGE.sha256),
                ("span", INSTITUTE),
                ("start", 0),
            ],
        )

    def test_relation_without_a_profile_is_dropped(self):
        result = extract(PAGES)
        self.assertEqual(result.dropped["no_profile"], 0)
        lonely = extract([p for p in PAGES if p.url != LAB])
        self.assertEqual(lonely.dropped["no_profile"], 1)


class EvidenceTest(unittest.TestCase):
    def test_zero_stored_claims_without_a_verbatim_span(self):
        result = run()
        pages = {page.url: page for page in PAGES}
        self.assertEqual(recheck(result.profiles, result.relations, pages), [])
        claims = [p["name"] for p in result.profiles]
        claims += [c for p in result.profiles for f in p["fields"].values() for c in f]
        for claim in [*claims, *result.relations]:
            evidence = claim.get("evidence", claim)
            text = pages[evidence["page_url"]].text
            start = evidence["start"]
            self.assertEqual(text[start : start + len(evidence["span"])], evidence["span"])


if __name__ == "__main__":
    unittest.main()
