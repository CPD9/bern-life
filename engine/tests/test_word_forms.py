import unittest

from bernlife.word_forms import same_form, word_form


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

    def test_full_text_matches_only_the_words_of_the_same_form(self):
        words = same_form("species")
        self.assertIn("specie", words)
        self.assertNotIn("special", words)
        self.assertIn("kohlenhydraten", same_form("kohlenhydrate"))
        self.assertNotIn("transformation", same_form("transfer"))
        self.assertTrue(all(word_form(w) == word_form("cancers") for w in same_form("cancers")))
        self.assertIn("cancer", same_form("cancers"))
        self.assertEqual(same_form("skin-worn"), ["skin-worn"])
        self.assertEqual(same_form("covid19"), ["covid19"])

    def test_no_derivation(self):
        self.assertNotEqual(word_form("schatzung"), word_form("schatzt"))
        self.assertNotEqual(word_form("genetik"), word_form("genetics"))


if __name__ == "__main__":
    unittest.main()
