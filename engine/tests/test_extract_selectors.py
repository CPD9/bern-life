import unittest

from bernlife.extract_selectors import page_name, page_subject, selector_candidates, site_line
from extract_fakes import ADA_PAGE, DORA_PAGE, INSTITUTE, LAB, LAB_PAGE, TEAM_PAGE, page


def rows(found):
    candidates, relations = found
    return (
        [(c.subject.key, c.field, c.value, c.span) for c in candidates],
        [(r.origin.key, r.target.key, r.kind, r.span) for r in relations],
    )


class SelectorTest(unittest.TestCase):
    def test_cms_person_page(self):
        affiliation = f"University of Bern, {INSTITUTE}, Sensor Lab"
        ada, institute = "name:ada muster", "host:www.example-institute.test"
        candidates, relations = rows(selector_candidates(ADA_PAGE))
        self.assertEqual(
            candidates,
            [
                (institute, "name", INSTITUTE, INSTITUTE),
                (ada, "name", "Ada Muster", "Prof. Dr. Ada Muster"),
                (ada, "role", "Group Leader", "Group Leader"),
                (ada, "unit", INSTITUTE, affiliation),
                (ada, "unit", "Sensor Lab", affiliation),
                (ada, "unit", INSTITUTE, INSTITUTE),
            ],
        )
        self.assertEqual(
            relations,
            [
                (ada, f"name:{INSTITUTE.lower()}", "member_of", affiliation),
                (ada, "name:sensor lab", "member_of", affiliation),
                (ada, institute, "member_of", INSTITUTE),
            ],
        )

    def test_page_titled_name_dash_site(self):
        self.assertEqual(page_name(DORA_PAGE), "Dr. Dora Demo")
        self.assertIsNone(site_line(DORA_PAGE))
        self.assertEqual(
            rows(selector_candidates(DORA_PAGE)),
            ([("name:dora demo", "name", "Dora Demo", "Dr. Dora Demo")], []),
        )

    def test_label_line_is_not_a_role_and_a_unit_line_is_a_unit(self):
        text = f"{INSTITUTE}\nStaff\nBen Beispiel\nE-Mail\n[email]"
        labelled = page(f"{LAB}x", f"Staff: Ben Beispiel - {INSTITUTE}", text, "person")
        self.assertNotIn("role", [c.field for c in selector_candidates(labelled)[0]])
        text = f"{INSTITUTE}\nStaff\nBen Beispiel\nDepartement für Technik"
        unit_line = page(f"{LAB}y", f"Staff: Ben Beispiel - {INSTITUTE}", text, "person")
        fields = [(c.field, c.value) for c in selector_candidates(unit_line)[0]]
        self.assertIn(("unit", "Departement für Technik"), fields)
        self.assertNotIn("role", [field for field, _ in fields])

    def test_unit_page_is_part_of_its_institute(self):
        candidates, relations = rows(selector_candidates(LAB_PAGE))
        self.assertEqual(
            candidates[1], ("url:" + LAB.replace("_eng", ""), "name", "Sensor Lab", "Sensor Lab")
        )
        self.assertEqual(relations[0][2:], ("part_of", INSTITUTE))

    def test_a_title_name_missing_from_the_text_gives_no_subject(self):
        hidden = page(
            f"{LAB}z", f"Staff: Hidden Person - {INSTITUTE}", f"{INSTITUTE}\nStaff", "person"
        )
        self.assertIsNone(page_subject(hidden))
        self.assertIsNone(page_subject(TEAM_PAGE))

    def test_a_page_named_after_a_listing_heading_has_no_subject(self):
        text = f"{INSTITUTE}\nResearch\nThesis Projects\nGlucoPatch\nSensor Lab"
        listing = page(f"{LAB}t", f"Research: Thesis Projects - {INSTITUTE}", text, "project")
        self.assertIsNone(page_subject(listing))
        institute = "host:www.example-institute.test"
        self.assertEqual(
            rows(selector_candidates(listing)), ([(institute, "name", INSTITUTE, INSTITUTE)], [])
        )
        text = f"{INSTITUTE}\nServices\nIT Services\nWe run the network."
        named = page(f"{LAB}s", f"Services: IT Services - {INSTITUTE}", text, "infrastructure")
        self.assertEqual(page_subject(named).name, "IT Services")

    def test_pages_of_other_sites_pair_by_host_and_name(self):
        en = page(
            "https://dcb.example.test/en/focus-area-sleep/",
            "Focus Area - Sleep - DCB",
            "Sleep",
            "unit",
        )
        de = page(
            "https://dcb.example.test/de/fokus-schlaf/", "Fokus - Sleep - DCB", "Sleep", "unit"
        )
        self.assertEqual(page_subject(en), page_subject(de))


if __name__ == "__main__":
    unittest.main()
