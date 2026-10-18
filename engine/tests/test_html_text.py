import unittest

from bernlife.html_text import collapse, extract

URL = "https://www.example-institute.test/team/ada-muster"

PAGE = """<!DOCTYPE html>
<html lang="en-GB">
<head>
  <title>  Dr. Ada&nbsp;Muster |
    Example Institute </title>
  <style>.x { color: red }</style>
  <script>var tracking = "ignore me";</script>
</head>
<body>
  <header><a href="/">Home</a> Site banner</header>
  <nav><ul><li><a href="/team/">Team</a></li><li><a href="/research/">Research</a></li></ul></nav>
  <div id="cookie-notice">We use cookies. <a href="/privacy">Accept</a></div>
  <main>
    <article>
      <header><h1>Dr. Ada Muster</h1></header>
      <p>Group Leader,
         Sensor&nbsp;Lab</p>
      <p>Research: continuous glucose monitoring at 37\u202f°C and wearable <b>bio</b>sensors.</p>
      <ul><li>GlucoPatch</li><li>Thin-film\tsensors</li></ul>
      <table><tr><th>Room</th><td>A&nbsp;101</td></tr></table>
      <svg><title>icon</title></svg>
      Contact via the <a href="contact/">contact page</a>.<br>Thank you.
    </article>
  </main>
  <footer>Imprint <a href="/imprint/">Imprint</a></footer>
</body>
</html>
"""


class ExtractTest(unittest.TestCase):
    def setUp(self):
        self.page = extract(PAGE, URL)

    def test_text_exact(self):
        expected = (
            "Dr. Ada Muster\n"
            "Group Leader, Sensor Lab\n"
            "Research: continuous glucose monitoring at 37 °C and wearable biosensors.\n"
            "GlucoPatch\n"
            "Thin-film sensors\n"
            "Room\n"
            "A 101\n"
            "Contact via the contact page.\n"
            "Thank you."
        )
        self.assertEqual(self.page.text, expected)

    def test_title_and_declared_language(self):
        self.assertEqual(self.page.title, "Dr. Ada Muster | Example Institute")
        self.assertEqual(self.page.declared_lang, "en")

    def test_links_come_from_the_whole_page(self):
        root = "https://www.example-institute.test"
        expected = (
            f"{root}/",
            f"{root}/team/",
            f"{root}/research/",
            f"{root}/privacy",
            f"{root}/team/contact/",
            f"{root}/imprint/",
        )
        self.assertEqual(self.page.links, expected)

    def test_no_robots_flags(self):
        self.assertFalse(self.page.noindex)
        self.assertFalse(self.page.nofollow)


class MetaTest(unittest.TestCase):
    def test_robots_meta(self):
        page = extract('<meta name="ROBOTS" content="noindex, follow"><p>x</p>', URL)
        self.assertEqual((page.noindex, page.nofollow), (True, False))
        page = extract('<meta name="robots" content="none"><p>x</p>', URL)
        self.assertEqual((page.noindex, page.nofollow), (True, True))

    def test_base_href_resolves_links(self):
        html = '<base href="https://www.example-institute.test/de/"><a href="team/">T</a>'
        page = extract(html, URL)
        self.assertEqual(page.links, ("https://www.example-institute.test/de/team/",))

    def test_consent_class_on_body_does_not_drop_the_page(self):
        page = extract('<body class="cookies-not-set"><p>Kept text</p></body>', URL)
        self.assertEqual(page.text, "Kept text")

    def test_nested_elements_inside_a_dropped_block(self):
        html = '<div class="consent"><div>a</div><div>b</div></div><p>after</p>'
        self.assertEqual(extract(html, URL).text, "after")


class CollapseTest(unittest.TestCase):
    def test_unicode_whitespace(self):
        self.assertEqual(collapse(" a\u00a0\u00a0b\u202fc\td\u2009e\n "), "a b c d e")


if __name__ == "__main__":
    unittest.main()
