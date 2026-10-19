"""Where each place's address is, from the federal building address register via geo.admin search.

The search is asked for the street and number found in the verbatim address (as the world's
buildingKey does) with "Bern", one request at a time, at least a second apart, cached on disk. An
address hit carries its building's EGID ("<EGID>_<EDID>"), which matches the EGID in
swissBUILDINGS3D, so a place lands on its own building rather than the nearest one.
"""

import json
import re
import time
import urllib.parse
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from infra.geo.tlm import MIN_DELAY_S, http_get

SEARCH = "https://api3.geo.admin.ch/rest/services/api/SearchServer"
STREET_AND_NUMBER = re.compile(
    r"([^\W\d_][\w.-]*(?:strasse|gasse|weg|platz|rain))\s+(\d+[a-z]?)\b", re.IGNORECASE
)

# Highlighted on the map so a Bern local finds their bearings: Zytglogge, Bundeshaus West and
# East with the Parliament Building, the Münster, the University main building, the Inselspital.
LANDMARK_ADDRESSES = (
    "Bim Zytglogge 1 Bern",
    "Bundesplatz 3 Bern",
    "Münsterplatz 1 Bern",
    "Hochschulstrasse 4 Bern",
    "Freiburgstrasse 18 Bern",
)


@dataclass(frozen=True)
class AddressPoint:
    query: str
    e: float
    n: float
    egid: int | None


def query_for(address: str) -> str | None:
    match = STREET_AND_NUMBER.search(address)
    return f"{match.group(1)} {match.group(2)} Bern" if match else None


def search_url(query: str) -> str:
    params = {"searchText": query, "type": "locations", "origins": "address", "sr": "2056"}
    return f"{SEARCH}?{urllib.parse.urlencode(params)}"


def parse_hit(query: str, body: bytes) -> AddressPoint | None:
    for result in json.loads(body).get("results", []):
        attrs = result.get("attrs", {})
        if attrs.get("origin") != "address":
            continue
        egid_part = str(attrs.get("featureId") or "").split("_")[0]
        egid = int(egid_part) if egid_part.isdigit() else None
        return AddressPoint(query=query, e=float(attrs["y"]), n=float(attrs["x"]), egid=egid)
    return None


def look_up(
    queries: list[str],
    cache: Path,
    get: Callable[[str], bytes] = http_get,
    sleep: Callable[[float], None] = time.sleep,
) -> dict[str, AddressPoint | None]:
    found: dict[str, AddressPoint | None] = {}
    sent = 0
    for query in sorted(set(queries)):
        path = cache / f"{re.sub(r'[^a-z0-9]+', '-', query.lower()).strip('-')}.json"
        if not path.exists():
            if sent:
                sleep(MIN_DELAY_S)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(get(search_url(query)))
            sent += 1
        found[query] = parse_hit(query, path.read_bytes())
    return found
