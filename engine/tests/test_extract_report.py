import unittest
from functools import partial

from bernlife.extract import extract
from bernlife.extract_model import model_pass
from bernlife.extract_report import summary
from extract_fakes import PAGES, FakeModel


class ReportTest(unittest.TestCase):
    def test_model_proposals_by_field_and_the_not_found_count(self):
        model = partial(model_pass, ask=FakeModel(), is_cached=lambda messages: False)
        report = summary(extract(PAGES, PAGES, model), {p.url: p for p in PAGES}, "fake")
        lines = report.splitlines()
        start = lines.index("model proposals by field")
        self.assertEqual(
            [line.split() for line in lines[start + 1 : start + 12]],
            [
                ["field", "kept", "bad_json", "span_not_in_page", "wrong_page"],
                ["(reply)", "2"],
                ["expertise", "2", "1"],
                ["infrastructure", "1"],
                ["name", "3", "1"],
                ["projects", "1"],
                ["relation", "leads", "2"],
                ["relation", "member_of", "1", "1"],
                ["role", "2", "1"],
                [
                    "model",
                    "proposals",
                    "not",
                    "found",
                    "on",
                    "the",
                    "page:",
                    "3,",
                    "all",
                    "dropped",
                ],
                ["kept", "spans", "replaced", "by", "the", "page's", "own", "text:", "none"],
            ],
        )
        self.assertIn("(reply)                                                2", report)


if __name__ == "__main__":
    unittest.main()
