"""Page kind from its URL: the source's own `page_types` patterns first, then path words.

Only the URL is used, so a page's kind can be predicted, and corrected in the source file, without
reading the page.
"""

import re
from urllib.parse import urlsplit

from bernlife.sources import Site

PROJECT_WORDS = frozenset({"project", "projects", "projekt", "projekte", "projet", "projets"})
INFRASTRUCTURE_WORDS = frozenset(
    {"services", "service", "platform", "platforms", "plattform", "plattformen", "facility"}
    | {"facilities", "equipment", "infrastructure", "infrastruktur", "geraete", "instruments"}
)
LISTING_WORDS = frozenset(
    {"team", "teams", "people", "staff", "members", "mitarbeitende", "personen", "personal"}
)
PATH_WORDS = (
    ("project", PROJECT_WORDS),
    ("infrastructure", INFRASTRUCTURE_WORDS),
    ("listing", LISTING_WORDS),
)
SEPARATORS = re.compile(r"[/_\-.]+")


def classify(site: Site, url: str) -> str:
    for page_type in site.page_types:
        if re.search(page_type.url_pattern, url):
            return page_type.kind
    path_words = set(SEPARATORS.split(urlsplit(url).path.lower()))
    for kind, words in PATH_WORDS:
        if path_words & words:
            return kind
    return "other"
