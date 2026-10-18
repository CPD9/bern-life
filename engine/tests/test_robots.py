import unittest

from bernlife.robots import ALLOW_ALL, parse

ROOT = "https://www.example-institute.test"

# Invented, but written the way the UniBE CMS writes its rules.
WILDCARDS = """
User-Agent: *
Disallow: /*index.html
Disallow: */manage
Disallow: /*?preview$
Disallow: /*index_print_eng.html$
Disallow: /private/
Allow: /private/open/
Crawl-delay: 2  # seconds
Sitemap: https://www.example-institute.test/sitemap_index.xml
"""


class MatchTest(unittest.TestCase):
    def setUp(self):
        self.robots = parse(WILDCARDS)

    def test_wildcards_and_end_anchor(self):
        cases = [
            ("/research/index.html", False),
            ("/research/index_eng.html", True),
            ("/team/manage", False),
            ("/page?preview", False),
            ("/page?preview=1", True),
            ("/news/index_print_eng.html", False),
            ("/news/index_print_eng.html?x=1", True),
            ("/private/notes", False),
            ("/private/open/plan", True),
            ("/", True),
        ]
        for path, allowed in cases:
            with self.subTest(path=path):
                self.assertEqual(self.robots.allows(ROOT + path), allowed)

    def test_crawl_delay_and_sitemaps(self):
        self.assertEqual(self.robots.crawl_delay, 2.0)
        self.assertEqual(self.robots.sitemaps, (f"{ROOT}/sitemap_index.xml",))


class PrecedenceTest(unittest.TestCase):
    def test_longest_match_wins(self):
        robots = parse("User-agent: *\nAllow: /a\nDisallow: /a/b\n")
        self.assertTrue(robots.allows(f"{ROOT}/a/c"))
        self.assertFalse(robots.allows(f"{ROOT}/a/b/c"))

    def test_allow_wins_a_tie(self):
        robots = parse("User-agent: *\nDisallow: /page\nAllow: /page\n")
        self.assertTrue(robots.allows(f"{ROOT}/page"))

    def test_empty_disallow_allows_everything(self):
        self.assertTrue(parse("User-agent: *\nDisallow:\n").allows(f"{ROOT}/x"))

    def test_our_own_group_replaces_the_star_group(self):
        text = (
            "User-agent: *\nDisallow: /\n\n"
            "User-agent: BernLife-Navigator\nDisallow: /drafts/\nCrawl-delay: 5\n"
        )
        robots = parse(text)
        self.assertTrue(robots.allows(f"{ROOT}/team/"))
        self.assertFalse(robots.allows(f"{ROOT}/drafts/x"))
        self.assertEqual(robots.crawl_delay, 5.0)

    def test_one_group_for_several_agents(self):
        robots = parse("User-agent: otherbot\nUser-agent: *\nDisallow: /x/\n")
        self.assertFalse(robots.allows(f"{ROOT}/x/1"))

    def test_other_agents_rules_do_not_apply(self):
        robots = parse("User-agent: otherbot\nDisallow: /\n")
        self.assertTrue(robots.allows(f"{ROOT}/anything"))
        self.assertIsNone(robots.crawl_delay)

    def test_bad_crawl_delay_is_ignored(self):
        self.assertIsNone(parse("User-agent: *\nCrawl-delay: soon\n").crawl_delay)

    def test_allow_all(self):
        self.assertTrue(ALLOW_ALL.allows(f"{ROOT}/x"))


if __name__ == "__main__":
    unittest.main()
