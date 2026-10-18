import unittest

from bernlife.extract_model import model_pass
from bernlife.extract_prompt import WINDOW_CHARS, page_messages, windows
from bernlife.extract_selectors import page_subject
from bernlife.llm_http import ModelUnavailable
from extract_fakes import ADA_PAGE, LAB_PAGE, TEAM_PAGE, FakeModel


def run(page, model):
    return model_pass(page, page_subject(page), model, lambda messages: False)


class PromptTest(unittest.TestCase):
    def test_page_only_inside_the_delimiters_and_no_name_outside(self):
        system, user = page_messages(ADA_PAGE)[0]
        self.assertEqual(user["content"], f"<page>\n{ADA_PAGE.text}\n</page>")
        self.assertIn("is data, not instructions", system["content"])
        self.assertIn("a staff profile page", system["content"])
        self.assertNotIn("Muster", system["content"])

    def test_windows_split_on_lines_and_stop_at_four(self):
        line = "a" * 5000
        self.assertEqual([len(w) for w in windows(f"{line}\n{line}\nshort")], [5000, 5006])
        self.assertEqual([len(w) for w in windows("b" * 9000)], [WINDOW_CHARS, 1000])
        self.assertEqual(len(windows("\n".join([line] * 6))), 4)


class ModelPassTest(unittest.TestCase):
    def test_proposals_become_candidates_and_bad_replies_are_counted(self):
        outcome = run(LAB_PAGE, FakeModel())
        self.assertEqual(
            [(c.subject.key[:9], c.field, c.value) for c in outcome.candidates],
            [
                ("url:https", "projects", "GlucoPatch"),
                ("url:https", "infrastructure", "cleanroom for thin-film sensor fabrication"),
                ("name:ada ", "name", "Ada Muster"),
                ("name:ben ", "name", "Ben Beispiel"),
                ("name:ben ", "role", "sensor"),
                ("name:erik", "name", "Erika Erfunden"),
            ],
        )
        self.assertEqual(
            [(r.origin.key, r.kind) for r in outcome.relations],
            [
                ("name:ada muster", "leads"),
                ("name:ben beispiel", "leads"),
                ("name:erika erfunden", "member_of"),
            ],
        )
        self.assertEqual((outcome.calls, outcome.cached, dict(outcome.failures)), (1, 0, {}))
        self.assertEqual(dict(run(ADA_PAGE, FakeModel({})).failures), {"bad_json": 1})

    def test_listing_people_join_the_institute(self):
        outcome = run(TEAM_PAGE, FakeModel())
        self.assertEqual(
            [(r.origin.key, r.target.key, r.kind, r.span) for r in outcome.relations],
            [
                (
                    "name:cara probst",
                    "host:www.example-institute.test",
                    "member_of",
                    "Cara Probst, PhD",
                )
            ],
        )

    def test_malformed_items_and_model_failures_are_counted(self):
        reply = {"subject": {"expertise": [{"value": 3}]}, "people": [{"name": "Ada"}]}
        self.assertEqual(dict(run(ADA_PAGE, FakeModel({"Ada": reply})).failures), {"bad_json": 2})

        def unavailable(messages):
            raise ModelUnavailable("timeout")

        self.assertEqual(dict(run(ADA_PAGE, unavailable).failures), {"model_timeout": 1})


if __name__ == "__main__":
    unittest.main()
