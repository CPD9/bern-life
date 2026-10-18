import unittest

from bernlife.names import display_name, looks_like_person, mentions, person_key, slug, twin_key


class NamesTest(unittest.TestCase):
    def test_titles_go_from_both_ends(self):
        self.assertEqual(display_name("Prof. em. Dr. Erika Erfunden"), "Erika Erfunden")
        self.assertEqual(display_name("Cara Probst, PhD"), "Cara Probst")
        self.assertEqual(display_name("Dr. phil. nat. Ben Beispiel"), "Ben Beispiel")

    def test_person_key_ignores_titles_accents_and_case(self):
        self.assertEqual(person_key("Prof. Dr. Ada Muster"), "ada muster")
        self.assertEqual(person_key("ADA MÜSTER"), "ada muster")

    def test_looks_like_person(self):
        self.assertTrue(looks_like_person("Carla Pou i Miralbell"))
        self.assertTrue(looks_like_person("Philipp V'kovski-Kratzel"))
        self.assertFalse(looks_like_person("QUMEA AG"))
        self.assertFalse(looks_like_person("Universität Bern"))
        self.assertFalse(looks_like_person("Sensing & Monitoring Lab"))
        self.assertFalse(looks_like_person("Ada"))
        self.assertFalse(looks_like_person("Room 3010 Bern"))

    def test_mentions_matches_whole_words(self):
        self.assertTrue(mentions("Project team: Prof. Ada Muster, QUMEA AG", "Ada Muster"))
        self.assertFalse(mentions("Ada Mustermann leads", "Ada Muster"))

    def test_slug_and_twin_key(self):
        self.assertEqual(slug("Vermathen & Kreis Lab"), "vermathen-and-kreis-lab")
        self.assertEqual(twin_key("https://x.test/a/index_ger.html"), "https://x.test/a/index.html")


if __name__ == "__main__":
    unittest.main()
