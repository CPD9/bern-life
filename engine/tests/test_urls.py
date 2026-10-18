import unittest

from bernlife.urls import is_page_like, normalise, path_and_query

BASE = "https://www.example-institute.test/research/index_eng.html"

TABLE = [
    ("./team/index_eng.html", "https://www.example-institute.test/research/team/index_eng.html"),
    ("../about/", "https://www.example-institute.test/about/"),
    (
        "//www.example-institute.test/index_eng.html",
        "https://www.example-institute.test/index_eng.html",
    ),
    ("http://www.example-institute.test/news/", "https://www.example-institute.test/news/"),
    ("HTTPS://WWW.Example-Institute.TEST/Team/", "https://www.example-institute.test/Team/"),
    ("https://www.example-institute.test.", "https://www.example-institute.test/"),
    ("https://www.example-institute.test:443/a", "https://www.example-institute.test/a"),
    ("https://www.example-institute.test:8443/a", "https://www.example-institute.test:8443/a"),
    ("/team/#contact", "https://www.example-institute.test/team/"),
    ("/team", "https://www.example-institute.test/team"),
    ("/news/?utm_source=x&b=2&fbclid=y&a=1", "https://www.example-institute.test/news/?a=1&b=2"),
    ("/news/?gclid=z", "https://www.example-institute.test/news/"),
    ("  /team/  ", "https://www.example-institute.test/team/"),
    ("mailto:ada@example-institute.test", None),
    ("tel:+41000000000", None),
    ("javascript:void(0)", None),
    ("data:text/plain,hi", None),
    ("", None),
    ("https://www.example-institute.test:99999/", None),
]


class NormaliseTest(unittest.TestCase):
    def test_table(self):
        for href, expected in TABLE:
            with self.subTest(href=href):
                self.assertEqual(normalise(href, BASE), expected)

    def test_path_and_query(self):
        self.assertEqual(path_and_query("https://h.test/a/b?x=1"), "/a/b?x=1")
        self.assertEqual(path_and_query("https://h.test/a/"), "/a/")


class PageLikeTest(unittest.TestCase):
    def test_documents_images_and_feeds_are_skipped(self):
        for path in ("/a.pdf", "/b.PNG", "/c.docx", "/d.zip", "/e.mp4", "/f.xml", "/g.js"):
            with self.subTest(path=path):
                self.assertFalse(is_page_like(f"https://h.test{path}"))

    def test_pages_are_kept(self):
        for path in ("/", "/team/", "/index_eng.html", "/a.php", "/b.htm", "/c"):
            with self.subTest(path=path):
                self.assertTrue(is_page_like(f"https://h.test{path}"))


if __name__ == "__main__":
    unittest.main()
