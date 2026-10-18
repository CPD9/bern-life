"""Page addresses listed in a sitemap.xml (a `urlset`) or the sitemaps listed in an index."""

import xml.etree.ElementTree as ET
from dataclasses import dataclass


@dataclass(frozen=True)
class Sitemap:
    pages: tuple[str, ...]
    children: tuple[str, ...]


def parse(xml_text: str) -> Sitemap | None:
    """None when the body is not a sitemap, e.g. an HTML error page served with status 200."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return None
    locs = tuple(
        (loc.text or "").strip()
        for entry in root
        for loc in entry
        if _local(loc.tag) == "loc" and (loc.text or "").strip()
    )
    match _local(root.tag):
        case "urlset":
            return Sitemap(locs, ())
        case "sitemapindex":
            return Sitemap((), locs)
        case _:
            return None


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]
