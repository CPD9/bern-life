import unittest

from evaluator.load import Target
from evaluator.match import match, name_key, normalise_whitespace, url_key
from records import profile


class MatchTest(unittest.TestCase):
    def test_url_ignores_scheme_trailing_slash_and_query(self) -> None:
        expected = "www.example.test/team/ada"
        for url in (
            "https://www.example.test/team/ada",
            "https://www.example.test/team/ada/",
            "http://WWW.example.test/team/ada?lang=en",
        ):
            with self.subTest(url=url):
                self.assertEqual(url_key(url), expected)

    def test_name_drops_titles_case_and_accents(self) -> None:
        self.assertEqual(name_key("Prof. Dr. med. Zoë  Müller-Brändli"), "zoe muller-brandli")
        self.assertEqual(name_key("PD Dr. phil. nat. Zoe Muller-Brandli"), "zoe muller-brandli")

    def test_gold_notes_spelling_is_accepted(self) -> None:
        self.assertEqual(name_key("Danai Kokana"), name_key("Danai Kokona"))

    def test_unicode_spaces_become_one_plain_space(self) -> None:
        self.assertEqual(normalise_whitespace("we introduced   a\n\tlab "), "we introduced a lab")

    def test_match_by_name_then_url_and_only_within_kind(self) -> None:
        ada = Target("person", "Ada Muster", "https://www.example.test/team/ada")
        by_name = profile("person-a", "person", "Dr. Ada Muster", "https://www.example.test/x")
        by_url = profile("person-b", "person", "Someone Else", "https://www.example.test/team/ada/")
        unit_page = profile("unit-c", "unit", "Ada Muster", "https://www.example.test/team/ada")
        self.assertEqual(
            [match(ada, p) for p in (by_name, by_url, unit_page)], ["name", "url", None]
        )


if __name__ == "__main__":
    unittest.main()
