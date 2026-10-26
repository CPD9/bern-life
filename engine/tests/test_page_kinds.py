import unittest
from dataclasses import replace

from bernlife.page_kinds import kind_changes, report
from bernlife.sources import PageType
from extract_fakes import page
from fakes import HOST, site

ROOT = f"https://{HOST}"
GROUPS = (PageType("unit", r"/research/[a-z_]+/?$"),)


class PageKindsTest(unittest.TestCase):
    def setUp(self):
        self.lab = page(f"{ROOT}/research/sensor_lab", "Sensor Lab", "Sensor Lab\nSensors", "other")
        self.twin = replace(self.lab, url=f"{ROOT}/research/sensor_lab/")
        self.news = page(f"{ROOT}/news/", "News", "News\nToday.", "other")
        self.elsewhere = page("https://other.example.test/research/x/", "X", "X", "other")
        self.sites = {HOST: site(page_types=GROUPS)}

    def test_changes_are_listed_in_url_order_and_a_host_without_a_source_is_kept(self):
        changes = kind_changes([self.twin, self.news, self.lab, self.elsewhere], self.sites)
        self.assertEqual(
            [(c.page.url, c.page.kind, c.new_kind) for c in changes],
            [(self.lab.url, "other", "unit"), (self.twin.url, "other", "unit")],
        )

    def test_report_counts_the_direction_and_the_windows_once_per_text(self):
        changes = kind_changes([self.lab, self.twin], self.sites)
        self.assertEqual(
            report(changes),
            f"{self.lab.url}  other -> unit\n"
            f"{self.twin.url}  other -> unit\n"
            "2 pages change kind: other -> unit 2\n"
            "model windows for them: 1 (1 distinct texts)",
        )

    def test_report_without_changes(self):
        self.assertEqual(
            report([]), "0 pages change kind: none\nmodel windows for them: 0 (0 distinct texts)"
        )


if __name__ == "__main__":
    unittest.main()
