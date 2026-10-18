import unittest

from bernlife.lang import language, markers


class LanguageTest(unittest.TestCase):
    def test_four_languages(self):
        cases = {
            "Die Gruppe forscht an Sensoren und ist für die Messung von Glukose bei "
            "Menschen mit Diabetes zuständig.": "de",
            "The group is working on sensors for people with diabetes and it has a "
            "cleanroom which is open to partners.": "en",
            "Le groupe travaille sur des capteurs pour les personnes avec un diabète et "
            "il est ouvert aux partenaires.": "fr",
            "Il gruppo lavora sui sensori per le persone con il diabete e della "
            "ricerca nel laboratorio.": "it",
        }
        for text, expected in cases.items():
            with self.subTest(expected=expected):
                self.assertEqual(language(text), expected)

    def test_too_little_text_is_unknown(self):
        self.assertEqual(language("GlucoPatch 2026"), "unknown")

    def test_declared_language_decides_an_unclear_vote(self):
        self.assertEqual(language("GlucoPatch 2026", "fr"), "fr")
        self.assertEqual(language("GlucoPatch 2026", "rm"), "unknown")

    def test_no_marker_belongs_to_two_languages(self):
        self.assertEqual(set(markers().values()), {"de", "en", "fr", "it"})


if __name__ == "__main__":
    unittest.main()
