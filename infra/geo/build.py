"""Builds web/public/world/bern.geo from the raw downloads (which stay outside git).

    python3 -m infra.geo.build fetch   # swissTLM3D lines and address lookups, cached
    python3 -m infra.geo.build build   # tiles + cache -> web/public/world/bern.geo

Raw data lives in $BERNLIFE_DATA_DIR/geo/raw (default ~/Developer/bern-life-data/geo/raw):
the swissBUILDINGS3D 3.0 CityGML tiles (*.citygml.zip), tlm/ and addresses/.
"""

import argparse
import hashlib
import json
import os
import sys
import zipfile
from pathlib import Path

from infra.geo.addresses import LANDMARK_ADDRESSES, AddressPoint, look_up, query_for
from infra.geo.citygml import iter_buildings
from infra.geo.encode import RAIL, ROAD, WATER, AnchorItem, FootprintItem, LineItem, encode
from infra.geo.frame import BOX, in_box, to_map
from infra.geo.simplify import ring_area, simplify_line, simplify_ring
from infra.geo.tlm import fetch_all, read_lines

ROOT = Path(__file__).resolve().parents[2]
PLACES = ROOT / "web/features/world/places.json"
OUT = ROOT / "web/public/world/bern.geo"

SKIPPED_KINDS = {"Mauer gross", "Mauer", "Flugdach", "Treibhaus"}
MIN_FOOTPRINT_M2 = 15.0
FOOTPRINT_TOLERANCE_M = 1.0
LINE_TOLERANCE_M = 1.5

# Road width in metres by swissTLM3D OBJEKTART, from the class names ("10m Strasse", ...).
ROAD_WIDTH_M = {0: 7, 1: 7, 2: 20, 4: 8, 5: 4, 6: 4, 8: 10, 9: 6, 10: 4, 11: 3, 15: 1, 16: 2, 20: 8}
DEFAULT_ROAD_WIDTH_M = 4
AARE_WIDTH_M = 50
STREAM_WIDTH_M = 3
RAIL_WIDTH_M = 4

Point = tuple[float, float]


def raw_dir() -> Path:
    base = os.environ.get("BERNLIFE_DATA_DIR") or str(Path.home() / "Developer/bern-life-data")
    return Path(base) / "geo" / "raw"


def _centre(ring: tuple[Point, ...]) -> Point:
    return (sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring))


def _inside(point: Point, ring: list[Point]) -> bool:
    x, y = point
    inside = False
    for (xi, yi), (xj, yj) in zip(ring, [ring[-1], *ring[:-1]], strict=True):
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
    return inside


def load_footprints(
    raw: Path, landmark_egids: set[int]
) -> list[tuple[int | None, list[Point], float, bool]]:
    """Footprints in the box as (egid, simplified LV95 ring, height, landmark), sorted."""
    footprints = []
    seen = set()
    for tile in sorted(raw.glob("*.citygml.zip")):
        with zipfile.ZipFile(tile) as archive, archive.open(archive.namelist()[0]) as stream:
            for building in iter_buildings(stream):
                if building.kind in SKIPPED_KINDS:
                    continue
                for ring in building.rings:
                    if len(ring) < 3 or not in_box(*_centre(ring)):
                        continue
                    simple = simplify_ring(list(ring), FOOTPRINT_TOLERANCE_M)
                    key = tuple(round(c) for p in simple for c in p)
                    if len(simple) < 3 or ring_area(simple) < MIN_FOOTPRINT_M2 or key in seen:
                        continue
                    seen.add(key)
                    landmark = building.egid in landmark_egids
                    footprints.append((building.egid, simple, building.height_m, landmark))
    footprints.sort(key=lambda f: (round(f[1][0][0]), round(f[1][0][1]), len(f[1])))
    return footprints


def _line_width(category: int, properties: dict) -> float:
    if category == ROAD:
        return ROAD_WIDTH_M.get(int(properties.get("objektart", -1)), DEFAULT_ROAD_WIDTH_M)
    if category == WATER:
        return AARE_WIDTH_M if properties.get("name") == "Aare" else STREAM_WIDTH_M
    return RAIL_WIDTH_M


def load_lines(raw: Path) -> list[LineItem]:
    categories = {"roads": ROAD, "water": WATER, "rail": RAIL}
    items = []
    for line in read_lines(raw / "tlm"):
        category = categories[line.layer]
        for path in line.paths:
            if not any(in_box(e, n) for e, n in path):
                continue
            simple = simplify_line(list(path), LINE_TOLERANCE_M)
            items.append(
                LineItem(
                    category=category,
                    width_m=_line_width(category, line.properties),
                    objektart=max(0, min(255, int(line.properties.get("objektart", 0) or 0))),
                    points=tuple(to_map(e, n) for e, n in simple),
                )
            )
    return items


def place_queries() -> dict[str, str]:
    places = json.loads(PLACES.read_text())
    queries = {}
    for place in places:
        if place.get("position_method") == "address":
            query = query_for(place["address"])
            if query is not None:
                queries[place["id"]] = query
    return queries


def anchors_for(
    queries: dict[str, str],
    hits: dict[str, AddressPoint | None],
    footprints: list[tuple[int | None, list[Point], float, bool]],
) -> list[AnchorItem]:
    anchors = []
    for place_id, query in sorted(queries.items()):
        hit = hits.get(query)
        if hit is None:
            continue
        point = (hit.e, hit.n)
        same_building = [
            i for i, f in enumerate(footprints) if hit.egid is not None and f[0] == hit.egid
        ]
        containing = [i for i in same_building if _inside(point, footprints[i][1])]
        if not containing:
            containing = [i for i, f in enumerate(footprints) if _inside(point, f[1])]
        if containing:
            index = containing[0]
        elif same_building:
            index = max(same_building, key=lambda i: ring_area(footprints[i][1]))
        else:
            index = -1
        anchor_point = (
            point
            if index < 0 or _inside(point, footprints[index][1])
            else _centre(tuple(footprints[index][1]))
        )
        anchors.append(AnchorItem(place_id=place_id, point=to_map(*anchor_point), building=index))
    return anchors


def fetch() -> None:
    raw = raw_dir()
    sent = fetch_all(raw / "tlm")
    look_up([*place_queries().values(), *LANDMARK_ADDRESSES], raw / "addresses")
    print(f"tlm requests sent: {sent}")


def build() -> None:
    raw = raw_dir()
    queries = place_queries()
    hits = look_up([*queries.values(), *LANDMARK_ADDRESSES], raw / "addresses", get=_cached_only)
    landmark_egids = {h.egid for q in LANDMARK_ADDRESSES if (h := hits.get(q)) and h.egid}
    footprints = load_footprints(raw, landmark_egids)
    buildings = [
        FootprintItem(ring=tuple(to_map(e, n) for e, n in ring), height_m=height, landmark=landmark)
        for _, ring, height, landmark in footprints
    ]
    anchors = anchors_for(queries, hits, footprints)
    data = encode(buildings, load_lines(raw), anchors)
    OUT.write_bytes(data)
    unmatched = sorted(a.place_id for a in anchors if a.building < 0)
    print(
        f"{OUT.relative_to(ROOT)}: {len(data)} bytes, sha256 {hashlib.sha256(data).hexdigest()}\n"
        f"buildings {len(buildings)} (landmarks {sum(b.landmark for b in buildings)}), "
        f"anchors {len(anchors)}, unmatched {unmatched}, box {BOX}"
    )


def _cached_only(url: str) -> bytes:
    raise SystemExit(f"not cached, run fetch first: {url}")


def main(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(prog="python3 -m infra.geo.build")
    parser.add_argument("command", choices=["fetch", "build"])
    {"fetch": fetch, "build": build}[parser.parse_args(argv).command]()


if __name__ == "__main__":
    main(sys.argv[1:])
