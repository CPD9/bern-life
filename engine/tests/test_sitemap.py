import unittest

from bernlife.sitemap import Sitemap, parse

URLSET = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.example-institute.test/team/</loc><lastmod>2026-10-01</lastmod></url>
  <url><loc> https://www.example-institute.test/research/ </loc></url>
  <url><lastmod>2026-10-01</lastmod></url>
</urlset>
"""

INDEX = """<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://www.example-institute.test/page-sitemap.xml</loc></sitemap>
  <sitemap><loc>https://www.example-institute.test/project-sitemap.xml</loc></sitemap>
</sitemapindex>
"""


class SitemapTest(unittest.TestCase):
    def test_urlset(self):
        expected = Sitemap(
            (
                "https://www.example-institute.test/team/",
                "https://www.example-institute.test/research/",
            ),
            (),
        )
        self.assertEqual(parse(URLSET), expected)

    def test_index(self):
        expected = Sitemap(
            (),
            (
                "https://www.example-institute.test/page-sitemap.xml",
                "https://www.example-institute.test/project-sitemap.xml",
            ),
        )
        self.assertEqual(parse(INDEX), expected)

    def test_html_error_page_is_not_a_sitemap(self):
        self.assertIsNone(parse("<!DOCTYPE html><html><body>Error</body></html>"))

    def test_other_xml_is_not_a_sitemap(self):
        self.assertIsNone(parse("<rss><channel/></rss>"))


if __name__ == "__main__":
    unittest.main()
