import unittest

from bernlife.word_forms import prefix_form, word_form


class WordFormTest(unittest.TestCase):
    def test_german_and_french_inflections_meet(self):
        pairs = [
            ("kohlenhydrate", "kohlenhydraten", "kohlenhydrat"),
            ("psychotropes", "psychotroper", "psychotrop"),
            ("ribosomopathien", "ribosomopathies", "ribosomopathi"),
            ("forensische", "forensischer", "forensisch"),
            ("kinder", "kindern", "kind"),
            ("cardiaque", "cardiaques", "cardiaqu"),
            ("sensor", "sensors", "sensor"),
            ("cancer", "cancers", "canc"),
        ]
        for one, other, form in pairs:
            self.assertEqual((word_form(one), word_form(other)), (form, form), one)

    def test_at_least_four_letters_stay(self):
        self.assertEqual(
            [word_form(w) for w in ("liver", "live", "genes", "rats")],
            ["liver", "live", "gene", "rats"],
        )

    def test_a_double_s_or_a_final_us_is_no_plural(self):
        self.assertEqual([word_form(w) for w in ("process", "processes")], ["process", "process"])
        self.assertEqual([word_form(w) for w in ("virus", "viruses")], ["virus", "virus"])

    def test_a_plural_s_takes_the_ending_under_it_and_nothing_else(self):
        self.assertEqual(
            [word_form(w) for w in ("patterns", "pattern", "glucose", "glucoses")],
            ["patt", "patt", "glucos", "glucos"],
        )
        self.assertEqual([word_form(w) for w in ("proteins", "proteines")], ["protein", "protein"])

    def test_full_text_matches_a_form_of_five_letters_or_more_as_a_prefix(self):
        self.assertEqual(prefix_form("kohlenhydrate"), "kohlenhydrat")
        self.assertEqual(prefix_form("sensor"), "sensor")
        self.assertIsNone(prefix_form("cancer"))
        self.assertIsNone(prefix_form("skin-worn"))
        self.assertIsNone(prefix_form("covid19"))

    def test_no_derivation(self):
        self.assertNotEqual(word_form("schatzung"), word_form("schatzt"))
        self.assertNotEqual(word_form("genetik"), word_form("genetics"))


if __name__ == "__main__":
    unittest.main()
