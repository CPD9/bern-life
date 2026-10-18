import unittest

from bernlife.classify import classify
from bernlife.sources import PageType
from fakes import HOST, site

ROOT = f"https://{HOST}"


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


if __name__ == "__main__":
    unittest.main()
