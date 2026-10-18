import unittest

from bernlife.listing_names import is_listing_name


class ListingNamesTest(unittest.TestCase):
    def test_listing_headings_match(self):
        for name in ("Services", "Dienstleistungen", "Thesis Projects", "Ended Projects"):
            self.assertTrue(is_listing_name(name), name)

    def test_the_match_is_exact(self):
        for name in ("IT Services", "services", "Services ", "Example Core Facilities", "Project"):
            self.assertFalse(is_listing_name(name), name)


if __name__ == "__main__":
    unittest.main()
