import unittest
from datetime import date

from bernlife.admin import activity_summary, company_shape
from contract_schemas import validator


def record(ts: str, role: str, outcome: str) -> dict[str, object]:
    return {"ts": ts, "role": role, "model": "fake-70b", "key": "ab" * 32, "outcome": outcome}


# Three UTC days, written in Bern time (UTC+2), so the second line of 19 Oct Bern time falls on
# 18 Oct UTC. Nothing here is a real question or page.
RECORDS = [
    record("2026-10-17T09:00:00+02:00", "extract", "live"),
    record("2026-10-17T09:00:04+02:00", "extract", "http_504"),
    record("2026-10-18T23:30:00+02:00", "expand", "hit"),
    record("2026-10-19T01:30:00+02:00", "explain", "live"),
    record("2026-10-19T10:00:00+02:00", "expand", "hit"),
    record("2026-10-19T10:00:01+02:00", "expand", "hit"),
    record("2026-10-19T10:00:02+02:00", "explain", "live"),
    record("2026-10-19T10:00:03+02:00", "explain", "timeout"),
    record("2026-10-19T10:00:04+02:00", "brief", "miss"),
    record("2026-10-19T10:00:05+02:00", "brief", "budget"),
    record("2026-10-19T10:00:06+02:00", "agent", "Error: provider said something secret"),
    {"role": "expand", "outcome": "live"},
    {"ts": "not a time", "role": "expand", "outcome": "live"},
]
TODAY = date(2026, 10, 19)
BUDGET = {"limit": 50, "used": 3}


class CompanyShapeTest(unittest.TestCase):
    def test_a_last_word_naming_a_trade_or_a_legal_form_gives_the_shape(self):
        names = {
            "Example Digital": "ends in Digital",
            "Sample Health": "ends in Health",
            "Demo Medical": "ends in Medical",
            "Invented Photonics": "ends in Photonics",
            "Muster AG": "ends in AG",
            "Beispiel GmbH": "ends in GmbH",
            "Example Ltd.": "ends in Ltd.",
            "Sensor Lab": "ends in Lab",
            "Demo Group": "ends in Group",
            "Example Center": "ends in Center",
            "Centre de Démonstration": None,
            "Ada Muster": None,
            "Prof. Dr. Ada Muster": None,
            "Ada Muster, PhD": None,
            "Ada Muster-Beispiel": None,
            "Jean-Luc de la Santé": None,
            "": None,
        }
        self.assertEqual({name: company_shape(name) for name in names}, names)

    def test_the_rule_reads_word_shapes_not_case_or_accents(self):
        self.assertEqual(company_shape("example digital"), "ends in digital")
        self.assertEqual(company_shape("Demo Universität"), "ends in Universität")


class ActivitySummaryTest(unittest.TestCase):
    def test_calls_per_utc_day_by_role_and_outcome_newest_first(self):
        self.assertEqual(
            activity_summary(RECORDS, TODAY, BUDGET),
            {
                "today": "2026-10-19",
                "live_today": 3,
                "budget": {"limit": 50, "used": 3},
                "days": [
                    {
                        "day": "2026-10-19",
                        "calls": 7,
                        "by_role": {"agent": 1, "brief": 2, "expand": 2, "explain": 2},
                        "by_outcome": {
                            "budget": 1,
                            "hit": 2,
                            "live": 1,
                            "miss": 1,
                            "other": 1,
                            "timeout": 1,
                        },
                        "failures": {"other": 1, "timeout": 1},
                    },
                    {
                        "day": "2026-10-18",
                        "calls": 2,
                        "by_role": {"expand": 1, "explain": 1},
                        "by_outcome": {"hit": 1, "live": 1},
                        "failures": {},
                    },
                    {
                        "day": "2026-10-17",
                        "calls": 2,
                        "by_role": {"extract": 2},
                        "by_outcome": {"http_504": 1, "live": 1},
                        "failures": {"http_504": 1},
                    },
                ],
                "failures": {"http_504": 1, "other": 1, "timeout": 1},
            },
        )

    def test_the_summary_never_carries_error_text(self):
        summary = activity_summary(RECORDS, TODAY, BUDGET)
        self.assertNotIn("secret", str(summary))
        self.assertNotIn("Error", str(summary))

    def test_only_the_newest_days_are_kept_and_their_failures_summed(self):
        summary = activity_summary(RECORDS, TODAY, None, kept_days=2)
        self.assertEqual([day["day"] for day in summary["days"]], ["2026-10-19", "2026-10-18"])
        self.assertEqual(summary["failures"], {"other": 1, "timeout": 1})
        self.assertIsNone(summary["budget"])

    def test_an_empty_audit_is_an_empty_summary(self):
        self.assertEqual(
            activity_summary([], TODAY, None),
            {"today": "2026-10-19", "live_today": 0, "budget": None, "days": [], "failures": {}},
        )

    def test_the_summary_validates_against_the_contract(self):
        schema = validator("admin-activity.schema.json")
        for summary in (
            activity_summary(RECORDS, TODAY, BUDGET),
            activity_summary([], TODAY, None),
        ):
            self.assertEqual(list(schema.iter_errors(summary)), [])


if __name__ == "__main__":
    unittest.main()
