"""swissTLM3D roads, water network and railways for the map box, through geo.admin's identify API.

The national swissTLM3D download is one 4.8 GB file; the API serves the same features for a small
area. The box is asked for in 500 m cells, one request at a time, at least a second apart, and
every answer is cached on disk, so a rebuild sends no request at all. A feature that crosses
cells comes back from each of them and is kept once, by its feature id.
"""

import json
import time
import urllib.parse
import urllib.request
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from pathlib import Path

from infra.geo.frame import BOX

IDENTIFY = "https://api3.geo.admin.ch/rest/services/api/MapServer/identify"
LAYERS = {
    "roads": "ch.swisstopo.swisstlm3d-strassen",
    "water": "ch.swisstopo.swisstlm3d-gewaessernetz",
    "rail": "ch.swisstopo.swisstlm3d-eisenbahnnetz",
}
CELL_M = 500
PAGE = 200
MIN_DELAY_S = 1.0
USER_AGENT = "BernLife-Navigator/0.1 (research prototype; open geodata, map preprocessing)"


@dataclass(frozen=True)
class Line:
    feature_id: str
    layer: str
    properties: dict[str, object]
    paths: tuple[tuple[tuple[float, float], ...], ...]


def cells() -> Iterator[tuple[float, float, float, float]]:
    e = BOX["min_e"]
    while e < BOX["max_e"]:
        n = BOX["min_n"]
        while n < BOX["max_n"]:
            yield (e, n, min(e + CELL_M, BOX["max_e"]), min(n + CELL_M, BOX["max_n"]))
            n += CELL_M
        e += CELL_M


def identify_url(layer: str, cell: tuple[float, float, float, float], offset: int) -> str:
    extent = ",".join(f"{v:.0f}" for v in cell)
    query = {
        "geometryType": "esriGeometryEnvelope",
        "geometry": extent,
        "mapExtent": extent,
        "imageDisplay": "500,500,96",
        "tolerance": "0",
        "layers": f"all:{LAYERS[layer]}",
        "returnGeometry": "true",
        "geometryFormat": "geojson",
        "sr": "2056",
        "limit": str(PAGE),
        "offset": str(offset),
    }
    return f"{IDENTIFY}?{urllib.parse.urlencode(query)}"


def http_get(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def fetch_all(
    cache: Path,
    get: Callable[[str], bytes] = http_get,
    sleep: Callable[[float], None] = time.sleep,
) -> int:
    """Fills the cache; returns how many requests were sent (0 when everything was cached)."""
    sent = 0
    for layer in LAYERS:
        for cell in cells():
            offset = 0
            while True:
                path = cache / layer / f"{cell[0]:.0f}_{cell[1]:.0f}_{offset}.json"
                if not path.exists():
                    if sent:
                        sleep(MIN_DELAY_S)
                    body = get(identify_url(layer, cell, offset))
                    sent += 1
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(body)
                results = json.loads(path.read_bytes()).get("results", [])
                if len(results) < PAGE:
                    break
                offset += PAGE
    return sent


def _paths(geometry: dict) -> list[tuple[tuple[float, float], ...]]:
    kind, coordinates = geometry.get("type"), geometry.get("coordinates", [])
    lines = (
        [coordinates] if kind == "LineString" else coordinates if kind == "MultiLineString" else []
    )
    return [tuple((float(p[0]), float(p[1])) for p in line) for line in lines if len(line) >= 2]


def read_lines(cache: Path) -> list[Line]:
    seen: dict[str, Line] = {}
    for layer in LAYERS:
        for path in sorted((cache / layer).glob("*.json")):
            for result in json.loads(path.read_bytes()).get("results", []):
                feature_id = f"{layer}:{result.get('featureId', result.get('id'))}"
                paths = _paths(result.get("geometry") or {})
                if paths and feature_id not in seen:
                    properties = result.get("properties") or result.get("attributes") or {}
                    seen[feature_id] = Line(feature_id, layer, dict(properties), tuple(paths))
    return [seen[key] for key in sorted(seen)]
