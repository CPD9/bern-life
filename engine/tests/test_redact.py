import unittest

from bernlife.redact import redact


class RedactTest(unittest.TestCase):
    def test_contact_details_are_replaced(self):
        cases = {
            "E-Mail: ada.muster@example-institute.test": "E-Mail: [email]",
            "Phone +41 00 000 00 00": "Phone [phone]",
            "Tel. 0041 00 000 00 00, Fax 000 000 00 00": "Tel. [phone], Fax [phone]",
            "+41 (0)00 000 00 00": "[phone]",
            "+41000000000": "[phone]",
            "Phone: +41 00 00 0 00 00.": "Phone: [phone].",
            "+41 000 000 00 00": "[phone]",
            "+ 41 00 000 00 00": "[phone]",
            "Telefon+ 41 00 000 00 00": "Telefon[phone]",
            "Telefon: +41-00-000-0000": "Telefon: [phone]",
            "+1 0000000000": "[phone]",
        }
        for text, expected in cases.items():
            with self.subTest(text=text):
                self.assertEqual(redact(text), expected)

    def test_research_numbers_are_left_alone(self):
        for text in (
            "Murtenstrasse 50, 3008 Bern",
            "2 · Dec · 2024",
            "data from 40 patients over 10 days",
            "p = 0.05, 0.12 and 0.33",
            "ISBN 978-3-16-148410-0",
            "Funded 2021–2024 with CHF 250 000",
            "ORCID 0000-0002-1825-0097",
            "ORCID 0000-0002-1825-009X",
            "doi:10.1055/s-0034-1234567",
            "employed 06/2014-12/2016",
        ):
            with self.subTest(text=text):
                self.assertEqual(redact(text), text)


if __name__ == "__main__":
    unittest.main()
