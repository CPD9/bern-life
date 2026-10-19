import hashlib
import unittest
from datetime import UTC, datetime

from bernlife.explain import explain_top
from bernlife.matching import asked
from bernlife.own_page import (
    WINDOW,
    OwnPage,
    PageWords,
    Passage,
    bounds,
    own_page_passages,
    passage_near,
    passage_record,
)
from bernlife.ranking import AFTER, FUSED, Candidate, with_passages
from search_fakes import FakeChat

FETCHED = datetime(2026, 10, 18, 12, 0, tzinfo=UTC)
TEAM_URL = "https://www.example-institute.test/team"
TEAM = (
    "Sensor Lab\nName / Titel\nDr. Ada Muster\nGroup leader, glucose sensors\n"
    "Name / Titel\nBen Beispiel\nPhD student, sweat patches\nName / Titel\nCleo Exempel\nTechnician"
)
TEAM_NAMES = ("Sensor Lab", "Dr. Ada Muster", "Ben Beispiel", "Cleo Exempel")
COURSE_URL = "https://www.example-institute.test/courses/wearables"
COURSE = (
    "Wearable sensors in sports medicine\nThis course covers sweat analysis.\nLecturer:\nDora Demo"
)


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def own_page(url: str, text: str, names: tuple[str, ...]) -> OwnPage:
    offsets = tuple((text.index(n), text.index(n) + len(n)) for n in names)
    return OwnPage(url, sha(text), text, FETCHED, offsets)


TEAM_PAGE = own_page(TEAM_URL, TEAM, TEAM_NAMES)
COURSE_PAGE = own_page(COURSE_URL, COURSE, ("Dora Demo",))


def near(query: str, page: OwnPage, name: str) -> Passage | None:
    return passage_near(asked(query), PageWords(page), name, page.text.index(name))


def person(pid: str, page: OwnPage, name: str, sha256: str | None = None) -> dict:
    evidence = {
        "page_url": page.url,
        "page_sha256": sha256 or page.sha256,
        "span": name,
        "start": page.text.index(name),
        "fetched_at": "2026-10-18T12:00:00Z",
    }
    return {"id": pid, "name": {"value": name, "method": "selector", "evidence": evidence}}


class FakePages:
    def __init__(self, pages: list[OwnPage]):
        self.pages = {page.url: page for page in pages}
        self.asked: list[list[str]] = []

    def own_pages(self, urls):
        self.asked.append(list(urls))
        return {url: self.pages[url] for url in urls if url in self.pages}


class PassageNearTest(unittest.TestCase):
    def test_the_line_under_a_name_on_a_team_list_is_cited_from_the_name_on(self):
        self.assertEqual(
            near("sweat patches", TEAM_PAGE, "Ben Beispiel"),
            Passage(
                TEAM_URL,
                sha(TEAM),
                "Ben Beispiel\nPhD student, sweat",
                TEAM.index("Ben Beispiel"),
                FETCHED,
            ),
        )

    def test_the_line_of_the_name_above_is_never_lent_to_the_next_name(self):
        self.assertIsNone(near("glucose", TEAM_PAGE, "Ben Beispiel"))
        self.assertIsNone(near("sweat", TEAM_PAGE, "Cleo Exempel"))
        ada = near("glucose", TEAM_PAGE, "Dr. Ada Muster")
        self.assertEqual(ada.span, "Dr. Ada Muster\nGroup leader, glucose")

    def test_the_nearest_matching_word_ends_the_span(self):
        passage = near("sensors for glucose", TEAM_PAGE, "Dr. Ada Muster")
        expected = ("Dr. Ada Muster\nGroup leader, glucose", 24)
        self.assertEqual((passage.span, passage.start), expected)

    def test_a_word_form_matches_as_in_the_claim_rule(self):
        ben = near("patch", TEAM_PAGE, "Ben Beispiel")
        self.assertEqual(ben.span, "Ben Beispiel\nPhD student, sweat patches")

    def test_with_no_other_name_before_it_the_text_before_the_name_counts(self):
        passage = near("sweat", COURSE_PAGE, "Dora Demo")
        self.assertEqual(
            (passage.span, passage.start),
            ("sweat analysis.\nLecturer:\nDora Demo", COURSE.index("sweat")),
        )

    def test_words_of_the_name_and_generic_search_words_never_count(self):
        self.assertIsNone(near("Muster", TEAM_PAGE, "Dr. Ada Muster"))
        self.assertIsNone(near("who does research", COURSE_PAGE, "Dora Demo"))

    def test_a_word_beyond_the_window_is_not_reached(self):
        text = "Emil Exempel\n" + "x" * (WINDOW - 1) + " glucose"
        page = own_page("https://www.demo-centre.test/emil", text, ("Emil Exempel",))
        self.assertIsNone(near("glucose", page, "Emil Exempel"))
        text = "Emil Exempel\n" + "x" * (WINDOW - 9) + " glucose"
        page = own_page("https://www.demo-centre.test/emil", text, ("Emil Exempel",))
        self.assertEqual(near("glucose", page, "Emil Exempel").span, text)

    def test_a_page_whose_text_does_not_hash_to_its_sha256_gives_nothing(self):
        stale = OwnPage(TEAM_URL, sha("other text"), TEAM, FETCHED, TEAM_PAGE.names)
        self.assertIsNone(near("sweat", stale, "Ben Beispiel"))

    def test_a_name_not_at_its_offset_gives_nothing(self):
        words = PageWords(TEAM_PAGE)
        self.assertIsNone(passage_near(asked("sweat"), words, "Ben Beispiel", 3))
        self.assertIsNotNone(passage_near(asked("sweat"), words, "Ben Beispiel", None))


class BoundsTest(unittest.TestCase):
    def test_the_window_ends_at_the_next_name_and_starts_at_the_name_after_another(self):
        names = ((0, 10), (100, 110), (150, 160))
        self.assertEqual(bounds(names, 100, 110, 1000), (100, 150))

    def test_alone_on_its_page_the_window_reaches_both_ways(self):
        self.assertEqual(bounds(((400, 410),), 400, 410, 1000), (400 - WINDOW, 410 + WINDOW))
        self.assertEqual(bounds(((50, 60),), 50, 60, 200), (0, 200))

    def test_a_name_ending_further_back_than_the_window_does_not_stop_it(self):
        self.assertEqual(bounds(((0, 10), (400, 410)), 400, 410, 2000), (100, 710))


class OwnPagePassagesTest(unittest.TestCase):
    def test_each_profile_is_read_against_the_page_its_name_cites(self):
        profiles = {
            "person-ben": person("person-ben", TEAM_PAGE, "Ben Beispiel"),
            "person-cleo": person("person-cleo", TEAM_PAGE, "Cleo Exempel"),
            "person-dora": person("person-dora", COURSE_PAGE, "Dora Demo"),
        }
        store = FakePages([TEAM_PAGE, COURSE_PAGE])
        found = own_page_passages(asked("sweat"), sorted(profiles), store, profiles)
        self.assertEqual(store.asked, [[COURSE_URL, TEAM_URL]])
        self.assertEqual(
            {pid: passage.span for pid, passage in found.items()},
            {
                "person-ben": "Ben Beispiel\nPhD student, sweat",
                "person-dora": "sweat analysis.\nLecturer:\nDora Demo",
            },
        )

    def test_a_name_citing_another_version_of_the_page_gets_no_passage(self):
        profiles = {"person-ben": person("person-ben", TEAM_PAGE, "Ben Beispiel", "a" * 64)}
        found = own_page_passages(asked("sweat"), ["person-ben"], FakePages([TEAM_PAGE]), profiles)
        self.assertEqual(found, {})

    def test_the_record_cites_the_span_its_page_its_offset_and_its_fetch_date(self):
        self.assertEqual(
            passage_record(near("sweat", TEAM_PAGE, "Ben Beispiel")),
            {
                "kind": "own_page",
                "span": "Ben Beispiel\nPhD student, sweat",
                "page_url": TEAM_URL,
                "page_sha256": sha(TEAM),
                "start": TEAM.index("Ben Beispiel"),
                "fetched_at": "2026-10-18T12:00:00Z",
            },
        )


def candidate(profile_id: str, unit: str, fused: float) -> Candidate:
    return Candidate(profile_id, "person", profile_id, unit, fused, 1, 1, 0.5, 0.9)


def ids(ranked: list[Candidate]) -> list[str]:
    return [c.profile_id for c in ranked]


class WithPassagesTest(unittest.TestCase):
    def test_after_keeps_every_claim_result_first_and_in_its_order(self):
        claimed = [candidate("c1", "A", 0.02), candidate("c2", "B", 0.01)]
        passages = [candidate("p1", "C", 0.03), candidate("p2", "D", 0.015)]
        self.assertEqual(ids(with_passages(claimed, passages, AFTER)), ["c1", "c2", "p1", "p2"])

    def test_fused_interleaves_by_score_and_a_claim_result_wins_a_tie(self):
        claimed = [candidate("c1", "A", 0.02), candidate("z2", "B", 0.01)]
        passages = [candidate("p1", "C", 0.03), candidate("a2", "D", 0.01)]
        self.assertEqual(ids(with_passages(claimed, passages, FUSED)), ["p1", "c1", "z2", "a2"])

    def test_after_counts_the_claim_results_against_the_unit_cap(self):
        claimed = [candidate(f"c{i}", "A", 0.05 - i / 1000) for i in range(3)]
        passages = [candidate(f"p{i}", "A", 0.04 - i / 1000) for i in range(3)]
        passages.append(candidate("q", "B", 0.001))
        self.assertEqual(
            ids(with_passages(claimed, passages, AFTER)), ["c0", "c1", "c2", "p0", "q", "p1", "p2"]
        )

    def test_after_adds_nothing_to_a_full_top_ten(self):
        claimed = [candidate(f"c{i:02}", f"U{i}", 0.05 - i / 1000) for i in range(12)]
        passages = [candidate("p", "P", 0.9)]
        self.assertEqual(ids(with_passages(claimed, passages, AFTER)), [*ids(claimed), "p"])


class ExplainSkipsPassageTest(unittest.TestCase):
    def test_a_result_shown_through_its_own_page_keeps_its_plain_reason(self):
        ben = person("person-ben", TEAM_PAGE, "Ben Beispiel") | {"fields": {}}
        plain = {"text": "Name: Ben Beispiel", "cites": ["/name"]}
        passage = passage_record(near("sweat", TEAM_PAGE, "Ben Beispiel"))
        results = [{"rank": 1, "profile": ben, "reason": plain, "passage": passage}]
        llm = FakeChat({"explain": {"text": "Ben Beispiel.", "claims": [1]}})
        self.assertEqual(explain_top(llm, results, ["sweat"]), (results, []))
        self.assertEqual(llm.asked, [])


if __name__ == "__main__":
    unittest.main()
