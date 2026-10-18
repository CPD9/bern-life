import unittest

from bernlife.frontier import Entry, Frontier
from fakes import HOST, site

ROOT = f"https://{HOST}"


def allow_all(url: str) -> bool:
    return True


class FrontierTest(unittest.TestCase):
    def test_breadth_first_order_and_deduplication(self):
        frontier = Frontier(site(), allow_all)
        self.assertIsNone(frontier.admit(f"{ROOT}/", 0, seed=True))
        self.assertIsNone(frontier.admit(f"{ROOT}/b", 1))
        self.assertIsNone(frontier.admit(f"{ROOT}/a", 1))
        self.assertEqual(frontier.admit(f"{ROOT}/b", 2), "seen")
        self.assertEqual(frontier.pop(), Entry(f"{ROOT}/", 0))
        self.assertEqual(frontier.remaining(), [Entry(f"{ROOT}/b", 1), Entry(f"{ROOT}/a", 1)])

    def test_other_hosts_are_off_host(self):
        frontier = Frontier(site(), allow_all)
        self.assertEqual(frontier.admit("https://www.unibe.test/", 1), "off_host")

    def test_deny_allow_and_seed_exemption(self):
        frontier = Frontier(site(allow_paths=("/team/",), deny_paths=("/team/login",)), allow_all)
        self.assertIsNone(frontier.admit(f"{ROOT}/", 0, seed=True))
        self.assertEqual(frontier.admit(f"{ROOT}/news/", 1), "not_allowed_path")
        self.assertIsNone(frontier.admit(f"{ROOT}/team/ada-muster", 1))
        self.assertEqual(frontier.admit(f"{ROOT}/team/login", 1), "denied_path")

    def test_depth_limit(self):
        frontier = Frontier(site(max_depth=1), allow_all)
        self.assertIsNone(frontier.admit(f"{ROOT}/a", 1))
        self.assertEqual(frontier.admit(f"{ROOT}/b", 2), "too_deep")

    def test_no_depth_limit_when_unset(self):
        frontier = Frontier(site(max_depth=None), allow_all)
        self.assertIsNone(frontier.admit(f"{ROOT}/deep", 40))

    def test_non_html_then_robots(self):
        frontier = Frontier(site(), lambda url: not url.endswith("/private/"))
        self.assertEqual(frontier.admit(f"{ROOT}/report.pdf", 1), "not_html")
        self.assertEqual(frontier.admit(f"{ROOT}/private/", 1), "robots")

    def test_a_rejected_url_is_reported_once(self):
        frontier = Frontier(site(max_depth=0), allow_all)
        self.assertEqual(frontier.admit(f"{ROOT}/a", 1), "too_deep")
        self.assertEqual(frontier.admit(f"{ROOT}/a", 1), "seen")


if __name__ == "__main__":
    unittest.main()
