"""Clean page text, title, links and robots meta flags from one HTML page.

Evidence spans are later checked against this text by plain string matching, so the rules are
fixed and deterministic: navigation, header, footer and cookie banners are dropped, every block
element ends a line, and every Unicode whitespace character (U+00A0, U+202F, tabs, ...) becomes
a plain space with runs collapsed to one. Nothing else is normalised: case, accents and
punctuation stay as the page wrote them, except that e-mail addresses and phone numbers are
replaced by fixed tokens (`redact.py`). Links are read from the whole page, navigation included,
because that is how the crawl finds the other pages.
"""

from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urljoin

from bernlife.redact import redact

DROPPED = frozenset({"script", "style", "noscript", "template", "svg", "iframe", "nav"})
# A header or footer inside <main> or <article> belongs to that content (an article's heading),
# so only the page-level ones are dropped, as HTML's banner and contentinfo roles define them.
PAGE_FRAME = frozenset({"header", "footer"})
CONTENT = frozenset({"main", "article"})
# fmt: off
BLOCKS = frozenset(
    {
        "address", "article", "aside", "blockquote", "br", "caption", "dd", "details", "div",
        "dl", "dt", "figcaption", "figure", "form", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
        "li", "main", "ol", "p", "pre", "section", "summary", "table", "td", "th", "tr", "ul",
    }
)
CONSENT_MARKERS = ("cookie", "consent", "gdpr", "cmplz", "borlabs")
VOID = frozenset({"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
                  "source", "track", "wbr"})
# fmt: on


@dataclass(frozen=True)
class Extracted:
    title: str
    text: str
    declared_lang: str | None
    links: tuple[str, ...]
    noindex: bool
    nofollow: bool


def extract(html: str, url: str) -> Extracted:
    parser = _PageParser()
    parser.feed(html)
    parser.close()
    base = urljoin(url, parser.base_href) if parser.base_href else url
    return Extracted(
        title=collapse("".join(parser.title_parts)),
        text="\n".join(filter(None, (redact(collapse("".join(p))) for p in parser.lines))),
        declared_lang=parser.declared_lang,
        links=tuple(urljoin(base, href) for href in parser.hrefs),
        noindex="noindex" in parser.robots or "none" in parser.robots,
        nofollow="nofollow" in parser.robots or "none" in parser.robots,
    )


def collapse(text: str) -> str:
    """str.split() splits on every Unicode whitespace character, so this is the matching rule."""
    return " ".join(text.split())


class _PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.lines: list[list[str]] = [[]]
        self.title_parts: list[str] = []
        self.hrefs: list[str] = []
        self.robots: set[str] = set()
        self.base_href: str | None = None
        self.declared_lang: str | None = None
        self._dropping: tuple[str, int] | None = None
        self._in_title = False
        self._seen_title = False
        self._content_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {name: value or "" for name, value in attrs}
        self._read_metadata(tag, values)
        if self._dropping:
            name, depth = self._dropping
            if tag == name and tag not in VOID:
                self._dropping = (name, depth + 1)
            return
        if self._drops(tag, values):
            if tag not in VOID:
                self._dropping = (tag, 1)
            return
        if tag == "title" and not self._seen_title:
            self._in_title = True
        if tag in CONTENT:
            self._content_depth += 1
        if tag in BLOCKS:
            self.lines.append([])

    def handle_endtag(self, tag: str) -> None:
        if self._dropping:
            name, depth = self._dropping
            if tag == name:
                self._dropping = (name, depth - 1) if depth > 1 else None
            return
        if tag == "title" and self._in_title:
            self._in_title, self._seen_title = False, True
        if tag in CONTENT and self._content_depth:
            self._content_depth -= 1
        if tag in BLOCKS:
            self.lines.append([])

    def handle_data(self, data: str) -> None:
        if self._dropping:
            return
        if self._in_title:
            self.title_parts.append(data)
        else:
            self.lines[-1].append(data)

    def _drops(self, tag: str, values: dict[str, str]) -> bool:
        if tag in DROPPED or (tag in PAGE_FRAME and not self._content_depth):
            return True
        return tag not in ("html", "body") and _is_consent_banner(values)

    def _read_metadata(self, tag: str, values: dict[str, str]) -> None:
        if tag == "a" and values.get("href"):
            self.hrefs.append(values["href"])
        elif tag == "html" and values.get("lang"):
            self.declared_lang = values["lang"].split("-")[0].strip().lower() or None
        elif tag == "base" and self.base_href is None and values.get("href"):
            self.base_href = values["href"]
        elif tag == "meta" and values.get("name", "").lower() == "robots":
            self.robots |= {part.strip().lower() for part in values.get("content", "").split(",")}


def _is_consent_banner(values: dict[str, str]) -> bool:
    names = f"{values.get('id', '')} {values.get('class', '')}".lower()
    return any(marker in names for marker in CONSENT_MARKERS)
