"""Anchors for addressed places the shipped map has none for, without the CityGML tiles.

    python3 -m infra.geo.build anchors

A place that gains an address after web/public/world/bern.geo was built needs an anchor, and a
full `build` needs the swissBUILDINGS3D tiles. This reads the shipped file instead: its buildings
and lines are copied byte for byte and every anchor in it is kept as it is. Each addressed place
without an anchor is looked up in the address cache (a missing query is fetched once from
geo.admin search, at least a second apart) and anchored at its address point, in the footprint of
the file that contains that point as stored (1/16 unit), the point the web test checks.

The file stores no EGIDs, so the building is matched by containment only, the fallback `build`
uses when the EGID finds no footprint: an address point that falls in a neighbour's footprint
lands in the neighbour. An address point sits on its entrance wall, and a stored footprint is
simplified by 1 m and rounded to 1.25 m steps, so a point can miss its own building by about a
metre: a point in no footprint but within WALL_TOLERANCE_M of one is anchored at the centre of the
nearest, as `build` anchors a point that lies outside its own building's footprint. A place the
search does not find, whose point is farther from every footprint, or whose nearest footprint
has its centre outside itself (an L-shaped building), is named with that reason and nothing is
written (no anchor with building -1): every addressed place must stand inside a building
(web/features/world/bern-geo.test.ts).
"""

import json
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from infra.geo.addresses import look_up, query_for
from infra.geo.encode import AnchorItem, FootprintItem, GeoFormatError, MapPoint, decode
from infra.geo.frame import METRES_PER_UNIT, STEPS_PER_UNIT, quantize, to_map
from infra.geo.simplify import distance_to_ring, inside
from infra.geo.tlm import http_get

WALL_TOLERANCE_M = 2.5


@dataclass(frozen=True)
class Placed:
    """Where a new anchor went: in the footprint at its address point, or on its wall."""

    anchor: AnchorItem
    query: str
    on_wall_m: float | None  # metres outside the footprint when anchored at its centre


def addressed_places(places: Path) -> dict[str, str | None]:
    """Every place with an address, to its search query (None without a street and number)."""
    return {
        place["id"]: query_for(place["address"])
        for place in json.loads(places.read_text())
        if place.get("position_method") == "address"
    }


def _stored(x: float, z: float) -> MapPoint:
    return (quantize(x) / STEPS_PER_UNIT, quantize(z) / STEPS_PER_UNIT)


def stored_point(e: float, n: float) -> MapPoint:
    """An LV95 point in map units, rounded to the 1/16 unit the file stores."""
    return _stored(*to_map(e, n))


def place_in(
    footprints: tuple[FootprintItem, ...], point: MapPoint
) -> tuple[int, MapPoint, float | None] | str:
    """(building, anchor point, metres to its wall or None when inside), or why there is none."""
    for index, footprint in enumerate(footprints):
        if inside(point, list(footprint.ring)):
            return index, point, None
    too_far = f"is more than {WALL_TOLERANCE_M} m from every footprint"
    if not footprints:
        return too_far
    distance, index = min(
        (distance_to_ring(point, list(f.ring)), i) for i, f in enumerate(footprints)
    )
    metres = distance * METRES_PER_UNIT
    if metres > WALL_TOLERANCE_M:
        return too_far
    ring = footprints[index].ring
    centre = _stored(sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring))
    if not inside(centre, list(ring)):
        return f"is {metres:.2f} m outside building {index}, whose centre is outside its footprint"
    return index, centre, metres


def add_anchors(
    out: Path,
    places: Path,
    cache: Path,
    get: Callable[[str], bytes] = http_get,
    sleep: Callable[[float], None] = time.sleep,
) -> list[Placed]:
    """Writes `out` again with an anchor for every addressed place that had none."""
    data = out.read_bytes()
    geo = decode(data)
    if geo.encode(list(geo.anchors)) != data:
        raise GeoFormatError(f"{out.name} does not encode back to itself; rebuild it with `build`")
    anchored = {anchor.place_id for anchor in geo.anchors}
    missing = {p: q for p, q in addressed_places(places).items() if p not in anchored}
    hits = look_up([q for q in missing.values() if q is not None], cache, get=get, sleep=sleep)
    placed: list[Placed] = []
    problems: list[str] = []
    for place_id, query in sorted(missing.items()):
        if query is None:
            problems.append(f"{place_id}: its address has no street and number to look up")
            continue
        hit = hits.get(query)
        if hit is None:
            problems.append(f"{place_id}: geo.admin search found no address for {query!r}")
            continue
        found = place_in(geo.footprints, stored_point(hit.e, hit.n))
        if isinstance(found, str):
            problems.append(f"{place_id}: the address point of {query!r} {found}")
            continue
        building, point, on_wall_m = found
        anchor = AnchorItem(place_id=place_id, point=point, building=building)
        placed.append(Placed(anchor=anchor, query=query, on_wall_m=on_wall_m))
    if problems:
        raise SystemExit("\n".join([f"{out.name} unchanged:", *problems]))
    if placed:
        out.write_bytes(geo.encode([*geo.anchors, *(p.anchor for p in placed)]))
    return placed
