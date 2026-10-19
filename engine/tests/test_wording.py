import tempfile
import unittest
from pathlib import Path

from bernlife.llm_gate import request_scope
from bernlife.wording import Recorded, clean, for_model, normal_form, recorded_wording, wordings

RECORDED = Recorded(["Glucose Sensors", "Nächtliche Hypoglykämie"])


class NormalFormTest(unittest.TestCase):
    def test_whitespace_is_stripped_and_collapsed_before_casefolding(self):
        self.assertEqual(clean("  Glucose \n  Sensors "), "Glucose Sensors")
        self.assertEqual(normal_form("  Glucose \n  Sensors "), "glucose sensors")

    def test_composed_and_decomposed_accents_share_one_form(self):
        self.assertEqual(normal_form("Nächtliche"), "nächtliche")

    def test_casefolding_goes_further_than_lowercase(self):
        self.assertEqual(normal_form("Straße"), "strasse")


class RecordedTest(unittest.TestCase):
    def test_the_recorded_text_is_returned_for_an_equivalent_wording(self):
        self.assertEqual(RECORDED.match("glucose  sensors"), "Glucose Sensors")
        self.assertEqual(RECORDED.match("NÄCHTLICHE HYPOGLYKÄMIE "), "Nächtliche Hypoglykämie")
        self.assertIsNone(RECORDED.match("glucose sensor"))

    def test_the_first_of_two_recordings_with_one_form_wins(self):
        self.assertEqual(Recorded(["CGM", "cgm"]).match("Cgm"), "CGM")

    def test_a_file_yields_its_query_and_queries_fields_and_a_missing_file_nothing(self):
        folder = Path(tempfile.mkdtemp())
        path = folder / "queries.jsonl"
        path.write_text(
            '{"id": "a", "query": "Glucose Sensors", "notes": "not a query"}\n'
            "\n"
            '{"id": "b", "queries": ["CGM", "Blutzucker messen", 3]}\n',
            encoding="utf-8",
        )
        self.assertEqual(list(wordings(path)), ["Glucose Sensors", "CGM", "Blutzucker messen"])
        self.assertEqual(list(wordings(folder / "dev2.jsonl")), [])
        index = Recorded(wordings(path))
        self.assertEqual(index.match(" glucose   sensors"), "Glucose Sensors")
        self.assertEqual(index.match("cgm"), "CGM")
        self.assertIsNone(index.match("insulin pumps"))


class ForModelTest(unittest.TestCase):
    def test_replay_asks_in_the_recorded_wording_and_cleans_an_unrecorded_question(self):
        self.assertEqual(for_model(" glucose  SENSORS", "replay", RECORDED), "Glucose Sensors")
        self.assertEqual(for_model(" insulin  Pumps ", "replay", RECORDED), "insulin Pumps")

    def test_a_request_that_may_go_live_asks_in_the_users_words(self):
        with request_scope(live=True):
            self.assertIsNone(recorded_wording("glucose sensors", "live", RECORDED))
            self.assertEqual(for_model("glucose  sensors", "live", RECORDED), "glucose sensors")
        with request_scope(live=False):
            self.assertEqual(for_model("glucose sensors", "live", RECORDED), "Glucose Sensors")

    def test_a_live_command_outside_a_request_asks_in_its_own_words(self):
        self.assertEqual(for_model("glucose sensors", "live", RECORDED), "glucose sensors")
        self.assertEqual(for_model("glucose sensors", "replay", RECORDED), "Glucose Sensors")
