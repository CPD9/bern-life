"""Which person pages the topics pass reads, on invented pages and profiles."""

import unittest
from dataclasses import replace

from bernlife.extract_topics import MIN_TEXT, missing_topics, report
from extract_fakes import ADA_PAGE, HOST, INSTITUTE, LAB_PAGE, page

FRITZ = f"{HOST}/about_us/people/fiktiv_fritz/index_eng.html"
GRETA = f"{HOST}/about_us/people/gedacht_greta/index_eng.html"
TEAM = f"{HOST}/about_us/people/flow_team/index_eng.html"
RESEARCH = (
    "Fritz Fiktiv studies the mechanics of heart valves with ultrasound imaging and builds the "
    "ValveSim model of flow through a stented valve. He runs the institute's flow lab, a pulse "
    "duplicator that mimics the heartbeat, and offers flow measurements to clinics in Bern."
)
FRITZ_PAGE = page(
    FRITZ,
    f"About us: Dr. Fritz Fiktiv - {INSTITUTE}",
    f"{INSTITUTE}\nPeople\nDr. Fritz Fiktiv\nPostdoc\nResearch\n{RESEARCH}",
    "person",
)
GRETA_PAGE = replace(
    FRITZ_PAGE,
    url=GRETA,
    title=f"About us: Greta Gedacht - {INSTITUTE}",
    text=f"{INSTITUTE}\nPeople\nGreta Gedacht\nPhD student\nResearch\n{RESEARCH}",
)
TEAM_PAGE = replace(
    FRITZ_PAGE, url=TEAM, title=f"About us: Flow Team - {INSTITUTE}", text=f"Flow\n{RESEARCH}"
)


def profile(url: str, name: str, expertise: bool) -> dict[str, object]:
    evidence = {"page_url": url, "page_sha256": "x", "span": name, "start": 0, "fetched_at": ""}
    fields = {"expertise": [{"value": "valves", "evidence": evidence}] if expertise else []}
    return {"name": {"value": name, "evidence": evidence}, "fields": fields}


class MissingTopicsTest(unittest.TestCase):
    def test_person_pages_with_text_and_a_profile_without_expertise_in_page_order(self):
        pages = [GRETA_PAGE, LAB_PAGE, ADA_PAGE, FRITZ_PAGE, TEAM_PAGE]
        profiles = [profile(page.url, "Someone", False) for page in pages]
        self.assertGreaterEqual(len(FRITZ_PAGE.text), MIN_TEXT)
        self.assertLess(len(ADA_PAGE.text), MIN_TEXT)
        # The lab page is a unit page, Ada's is too short, the team page has no readable name.
        self.assertEqual([p.url for p in missing_topics(pages, profiles)], [GRETA, FRITZ])

    def test_a_page_whose_titled_twin_profile_has_expertise_is_not_read_again(self):
        profiles = [profile(FRITZ, "Fritz Fiktiv", False), profile(FRITZ, "Fritz Fiktiv, MD", True)]
        self.assertEqual(missing_topics([FRITZ_PAGE, GRETA_PAGE], profiles), [])

    def test_a_page_no_profile_cites_is_not_read(self):
        self.assertEqual(missing_topics([FRITZ_PAGE], [profile(GRETA, "Greta Gedacht", False)]), [])

    def test_report_lists_the_pages_and_counts_the_windows(self):
        long_page = replace(FRITZ_PAGE, text=FRITZ_PAGE.text + "\n" + "x" * 8000)
        self.assertEqual(
            report([FRITZ_PAGE, long_page]),
            f"{FRITZ}\n{FRITZ}\n2 person pages without an expertise claim; "
            "model windows for them: 3",
        )
        self.assertEqual(
            report([]), "0 person pages without an expertise claim; model windows for them: 0"
        )


if __name__ == "__main__":
    unittest.main()
