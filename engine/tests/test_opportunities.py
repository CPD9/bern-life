import unittest
from dataclasses import replace

from bernlife.chunks import build_chunks, chunk_prefixes
from bernlife.extract_command import opportunity_sources
from bernlife.extract_model import read_reply
from bernlife.extract_prompt import instruction
from bernlife.extract_records import Candidate, Page, Subject, fields_for
from bernlife.extract_selectors import page_name, selector_candidates
from bernlife.sources import PageType, Site, Source
from bernlife.verify import verify_claim

TEXT = (
    "Demo Innovation Call 2027\n"
    "Funded by the Invented Research Foundation.\n"
    "Deadline: 31.03.2027\n"
    "Up to CHF 500'000 per project.\n"
    "Open to start-ups based in Bern.\n"
    "Contact: Dr. Ada Muster"
)
PAGE = Page(
    url="https://www.example-funder.test/calls/demo-2027",
    source_id="example",
    unit="Invented Research Foundation",
    fetched_at="2026-10-18T12:00:00Z",
    sha256="0" * 64,
    kind="call",
    lang="en",
    title="Demo Innovation Call 2027",
    text=TEXT,
)
CALL = Subject(
    "call",
    "example",
    "page:www.example-funder.test:demo innovation call 2027",
    "Demo Innovation Call 2027",
)


def candidate(field: str, value: str, span: str) -> Candidate:
    return Candidate(CALL, field, value, span, "model", PAGE.url)


class FieldsTest(unittest.TestCase):
    def test_each_kind_has_the_base_fields_and_its_own(self):
        base = ("role", "unit", "expertise", "projects", "infrastructure", "services")
        self.assertEqual(fields_for("person"), base)
        self.assertEqual(fields_for("call"), (*base, "funder", "deadline", "amount", "eligibility"))
        self.assertEqual(fields_for("service"), (*base, "eligibility"))
        self.assertEqual(fields_for("space"), (*base, "location", "size"))


class OpportunityPromptTest(unittest.TestCase):
    def test_a_call_page_asks_for_its_fields_and_no_people(self):
        text = instruction("call")
        for field in ("funder", "deadline", "amount", "eligibility", "expertise"):
            self.assertIn(f'"{field}": [{{"value"', text)
        self.assertNotIn('"people"', text)
        self.assertIn("never compute, convert or complete them", text)

    def test_people_pages_keep_their_wording(self):
        self.assertIn('"people": [{"name"', instruction("person"))

    def test_people_in_a_reply_about_an_opportunity_page_are_ignored(self):
        reply = {
            "subject": {"deadline": [{"value": "31.03.2027", "span": "Deadline: 31.03.2027"}]},
            "people": [{"name": {"value": "Ada Muster", "span": "Contact: Dr. Ada Muster"}}],
        }
        candidates, relations = [], []
        self.assertEqual(read_reply(reply, PAGE, CALL, candidates, relations), 0)
        self.assertEqual([(c.field, c.value) for c in candidates], [("deadline", "31.03.2027")])
        self.assertEqual(relations, [])


class VerbatimDatesAndAmountsTest(unittest.TestCase):
    def test_a_deadline_copied_from_its_span_is_kept(self):
        claim = verify_claim(
            candidate("deadline", "31.03.2027", "Deadline: 31.03.2027"), PAGE, CALL
        )
        self.assertEqual(
            (claim.field, claim.value, claim.evidence.span),
            ("deadline", "31.03.2027", "Deadline: 31.03.2027"),
        )

    def test_a_reformatted_or_computed_value_is_dropped(self):
        for field, value, span in (
            ("deadline", "31 March 2027", "Deadline: 31.03.2027"),
            ("amount", "CHF 500000", "Up to CHF 500'000 per project."),
            ("deadline", "31.03.2027", "Deadline: 2027-03-31"),
        ):
            with self.subTest(value=value):
                self.assertIsInstance(verify_claim(candidate(field, value, span), PAGE, CALL), str)


class ChunkPrefixTest(unittest.TestCase):
    def test_passages_cited_only_by_opportunities_have_their_own_prefix(self):
        page = {
            "url": PAGE.url,
            "source_id": "example",
            "sha256": "ab" * 32,
            "title": "T",
            "text": TEXT,
        }
        claim = {
            "value": "Demo Innovation Call 2027",
            "method": "selector",
            "evidence": {"page_url": PAGE.url},
        }
        profile = {
            "id": "call-example-demo-innovation-call-2027",
            "kind": "call",
            "source_id": "example",
            "name": claim,
            "source_url": PAGE.url,
            "fields": {field: [] for field in fields_for("call")},
        }
        ids = [c.id for c in build_chunks([page], [profile], [])]
        self.assertEqual(ids, ["call-example-demo-innovation-call-2027", f"opp-{'ab' * 8}-0"])

    def test_prefixes_per_kind_group(self):
        self.assertEqual(
            chunk_prefixes(["person", "unit", "project", "infrastructure"]),
            ["infrastructure", "page", "person", "project", "unit"],
        )
        self.assertEqual(chunk_prefixes(["call"]), ["call", "opp"])
        self.assertEqual(chunk_prefixes(["person", "space"]), ["opp", "page", "person", "space"])


if __name__ == "__main__":
    unittest.main()


SITE = "Invented Coworking"
ROOM = Page(
    url="https://www.example-cowork.test/raeume/aquarium/",
    source_id="cowork",
    unit=SITE,
    fetched_at="2026-10-18T12:00:00Z",
    sha256="1" * 64,
    kind="space",
    lang="de",
    title=f"Aquarium | Räume | {SITE}",
    text=f"{SITE}\nRaumvermietung\nRaum «Aquarium»\nGrösse\n47m2",
)


class OpportunitySelectorsTest(unittest.TestCase):
    def test_an_opportunity_source_names_no_institute(self):
        page = replace(ROOM, title=f"Raum «Aquarium» - {SITE}")
        people_site, _ = selector_candidates(page)
        opportunity_site, _ = selector_candidates(page, institutes=False)
        self.assertIn("unit", {c.subject.kind for c in people_site})
        self.assertEqual({c.subject.kind for c in opportunity_site}, {"space"})

    def test_a_room_title_finds_the_room_line(self):
        self.assertEqual(page_name(ROOM), "Raum «Aquarium»")

    def test_a_sentence_title_finds_the_heading_that_shares_its_words(self):
        page = replace(
            ROOM,
            kind="service",
            title="Bring your research findings to market with BRIDGE",
            text="BRIDGE Projects\nThe BRIDGE programme helps researchers.",
        )
        self.assertEqual(page_name(page), "BRIDGE Projects")

    def test_people_pages_keep_the_title_rule(self):
        self.assertIsNone(page_name(replace(ROOM, kind="person")))

    def test_sources_with_only_opportunity_and_listing_types_are_opportunity_sources(self):
        def source(source_id, kinds):
            types = tuple(PageType(kind, "^x") for kind in kinds)
            site = Site(
                source_id, f"{source_id}.test", "U", ("https://x/",), (), (), 1, 1.0, None, types
            )
            return Source(source_id, source_id, (site,))

        found = opportunity_sources(
            [
                source("funder", ["call", "listing"]),
                source("lab", ["person", "listing"]),
                source("mixed", ["unit", "service"]),
            ]
        )
        self.assertEqual(found, frozenset({"funder"}))
