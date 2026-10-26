import unittest
from urllib.parse import urlsplit

from bernlife.classify import classify
from bernlife.sources import PageType, load_sources
from fakes import HOST, site

ROOT = f"https://{HOST}"
IFIK = "https://www.ifik.unibe.ch"
IAP = "https://www.iap.unibe.ch"
ITP = "https://www.itp.unibe.ch"
NEURO = "https://www.neuroscience.unibe.ch/research/research_groups"


class ClassifyTest(unittest.TestCase):
    def test_source_pattern_first(self):
        self.assertEqual(classify(site(), f"{ROOT}/team/ada-muster"), "person")

    def test_patterns_are_tried_in_order(self):
        types = (PageType("unit", r"/groups/"), PageType("person", r"/groups/[a-z]+$"))
        self.assertEqual(classify(site(page_types=types), f"{ROOT}/groups/sensor"), "unit")

    def test_path_words(self):
        cases = {
            f"{ROOT}/research/projects/glucopatch/": "project",
            f"{ROOT}/en/project/moonwalk/": "project",
            f"{ROOT}/services/applications/": "infrastructure",
            f"{ROOT}/core_facilities/index_eng.html": "infrastructure",
            f"{ROOT}/about_us/team/index_eng.html": "listing",
            f"{ROOT}/ueber_uns/mitarbeitende/index_ger.html": "listing",
            f"{ROOT}/news/2026/index_eng.html": "other",
            f"{ROOT}/": "other",
        }
        for url, kind in cases.items():
            with self.subTest(url=url):
                self.assertEqual(classify(site(page_types=()), url), kind)


class CaseSourcesTest(unittest.TestCase):
    """The patterns of sources/unibe.json and sources/artorg.json on the sites' real URL shapes;
    every name in a URL is invented."""

    def setUp(self):
        self.sites = {s.host: s for source in load_sources() for s in source.sites}

    def kind(self, url: str) -> str:
        return classify(self.sites[urlsplit(url).hostname or ""], url)

    def test_a_page_one_level_under_research_is_a_unit(self):
        for url in (
            f"{IFIK}/forschung/example_lab___ada_muster/index_ger.html",
            f"{IFIK}/research/example_lab___ada_muster/index_eng.html",
            "https://www.irm.unibe.ch/forschung/beispielabteilung/index_ger.html",
            "https://www.img.unibe.ch/forschung/beispiel_1900_1950/index_ger.html",
            f"{ITP}/research/example_theory/index_eng.html",
            f"{ITP}/research/fields_strings_and_dualities/index_eng.html",
            f"{IAP}/research/example_physics/index_eng.html",
            f"{IAP}/research/example_physics/example_subgroup/index_eng.html",
            f"{NEURO}/example_lab",
            f"{NEURO}/example_lab/",
            f"{NEURO}/support_center_for_example_imaging/",
            "https://www.artorg.unibe.ch/research/index_eng.html",
        ):
            with self.subTest(url=url):
                self.assertEqual(self.kind(url), "unit")

    def test_lists_events_and_index_pages_keep_their_kind(self):
        cases = {
            f"{ITP}/research/publications/index_eng.html": "other",
            f"{IFIK}/forschung/publikationen/index_ger.html": "other",
            f"{ITP}/research/seminars/index_eng.html": "other",
            f"{ITP}/research/recurring_events_and_seminars/index_eng.html": "other",
            f"{ITP}/research/example_research_award/index_eng.html": "other",
            f"{ITP}/research/funding/index_eng.html": "other",
            f"{ITP}/research/research_support/index_eng.html": "other",
            f"{ITP}/research/the_day_of_example_research/index_eng.html": "other",
            f"{ITP}/research/former_pis/index_eng.html": "other",
            f"{ITP}/research/research_groups/index_eng.html": "other",
            f"{IFIK}/forschung/forschungsgruppen/index_ger.html": "other",
            f"{ITP}/research/research_fields/index_eng.html": "other",
            f"{ITP}/research/research_groups_and_themes/index_eng.html": "other",
            f"{ITP}/research/clusters_and_networks/": "other",
            f"{ITP}/research/news/": "other",
            f"{ITP}/research/": "other",
            f"{ITP}/research/all_research_projects/index_eng.html": "project",
            f"{ITP}/research/facilities__instruments/index_eng.html": "infrastructure",
            f"{IFIK}/forschung/personen/muster_ada/index_ger.html": "person",
            f"{IAP}/research/example_physics/members/index_eng.html": "listing",
            f"{IAP}/research/example_physics/research_projects/index_eng.html": "project",
            f"{IAP}/research/example_physics/publications/index_eng.html": "other",
            f"{IAP}/research/example_physics/sub/subsub/index_eng.html": "other",
            f"{NEURO}/": "other",
            f"{NEURO}/example_lab/index_eng.html?error_type=NotFound": "other",
            "https://www.artorg.unibe.ch/research/example/index_eng.html": "unit",
            "https://www.artorg.unibe.ch/research/example/projects/p1/index_eng.html": "project",
        }
        for url, kind in cases.items():
            with self.subTest(url=url):
                self.assertEqual(self.kind(url), kind)


if __name__ == "__main__":
    unittest.main()
