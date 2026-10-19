"""Buildings out of a swissBUILDINGS3D 3.0 CityGML tile, streamed.

A tile is one 1-2 GB XML document, so it is read with iterparse straight from the zip and each
building is cleared once read. A building yields its ground rings (LV95 metres, 2D), its height
above the terrain point, its EGID (the federal building id the address register also carries, so
places can be matched to their building exactly) and its OBJEKTART.

The ground surface comes as a mesh of triangles, so the footprint is its outline: the edges used by
one triangle only, chained into rings. Outer rings are kept and courtyard holes dropped. A mesh
whose outline does not close, and a building without a ground surface, fall back to the convex
hull of its points.
"""

from collections.abc import Iterator
from dataclasses import dataclass
from typing import IO
from xml.etree import ElementTree

BLDG = "{http://www.opengis.net/citygml/building/2.0}"
GML = "{http://www.opengis.net/gml}"
GEN = "{http://www.opengis.net/citygml/generics/2.0}"

Point = tuple[float, float]


@dataclass(frozen=True)
class Building:
    egid: int | None
    kind: str
    rings: tuple[tuple[Point, ...], ...]
    height_m: float


def _rings(surface: ElementTree.Element) -> list[list[tuple[float, float, float]]]:
    rings = []
    for pos_list in surface.iter(f"{GML}posList"):
        values = [float(v) for v in (pos_list.text or "").split()]
        rings.append([(values[i], values[i + 1], values[i + 2]) for i in range(0, len(values), 3)])
    return rings


def _attributes(building: ElementTree.Element, name: str) -> list[str]:
    return [
        (attribute.findtext(f"{GEN}value") or "").strip()
        for tag in ("stringAttribute", "intAttribute", "doubleAttribute", "measureAttribute")
        for attribute in building.iter(f"{GEN}{tag}")
        if attribute.get("name") == name
    ]


def _hull(points: list[Point]) -> list[Point]:
    unique = sorted(set(points))
    if len(unique) < 3:
        return unique

    def half(sequence: list[Point]) -> list[Point]:
        chain: list[Point] = []
        for p in sequence:
            while len(chain) >= 2:
                (ax, ay), (bx, by) = chain[-2], chain[-1]
                if (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax) > 0:
                    break
                chain.pop()
            chain.append(p)
        return chain

    lower, upper = half(unique), half(list(reversed(unique)))
    return lower[:-1] + upper[:-1]


def _key(point: Point) -> tuple[int, int]:
    return (round(point[0] * 100), round(point[1] * 100))


def _area(ring: list[Point]) -> float:
    return (
        abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, [*ring[1:], ring[0]], strict=True)))
        / 2
    )


def _contains(ring: list[Point], point: Point) -> bool:
    x, y = point
    inside = False
    for (xi, yi), (xj, yj) in zip(ring, [ring[-1], *ring[:-1]], strict=True):
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
    return inside


def _normalised(ring: list[Point]) -> list[Point]:
    """Counter-clockwise, starting at the smallest point, so the same mesh gives the same ring."""
    signed = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, [*ring[1:], ring[0]], strict=True))
    ordered = ring if signed > 0 else list(reversed(ring))
    start = ordered.index(min(ordered))
    return ordered[start:] + ordered[:start]


def outline(pieces: list[list[Point]]) -> list[list[Point]] | None:
    """Outer rings of a mesh of polygons, largest first; None when the outline does not close."""
    count: dict[frozenset, int] = {}
    position: dict[tuple[int, int], Point] = {}
    for piece in pieces:
        points = piece[:-1] if len(piece) > 1 and _key(piece[0]) == _key(piece[-1]) else piece
        for a, b in zip(points, [*points[1:], points[0]], strict=True):
            ka, kb = _key(a), _key(b)
            if ka == kb:
                continue
            position[ka], position[kb] = a, b
            edge = frozenset((ka, kb))
            count[edge] = count.get(edge, 0) + 1
    neighbours: dict[tuple[int, int], list[tuple[int, int]]] = {}
    for edge, uses in count.items():
        if uses == 1:
            ka, kb = tuple(edge)
            neighbours.setdefault(ka, []).append(kb)
            neighbours.setdefault(kb, []).append(ka)
    if not neighbours or any(len(n) != 2 for n in neighbours.values()):
        return None
    rings, unused = [], set(neighbours)
    while unused:
        start = min(unused)
        ring, previous, current = [start], None, start
        while True:
            unused.discard(current)
            following = [n for n in neighbours[current] if n != previous]
            nxt = following[0] if following else neighbours[current][0]
            if nxt == start:
                break
            ring.append(nxt)
            previous, current = current, nxt
        rings.append(_normalised([position[k] for k in ring]))
    rings.sort(key=_area, reverse=True)
    return [r for i, r in enumerate(rings) if not any(_contains(o, r[0]) for o in rings[:i])]


def _numbers(values: list[str]) -> list[float]:
    numbers = []
    for value in values:
        try:
            numbers.append(float(value))
        except ValueError:
            continue
    return numbers


def read_building(element: ElementTree.Element) -> Building | None:
    ground = [ring for s in element.iter(f"{BLDG}GroundSurface") for ring in _rings(s)]
    flat = [[(x, y) for x, y, _ in ring] for ring in ground]
    outer = outline(flat) if flat else None
    if outer:
        rings = [tuple(ring) for ring in outer]
    else:
        points = [p for ring in flat for p in ring] or [
            (x, y) for s in element.iter(f"{BLDG}RoofSurface") for r in _rings(s) for x, y, _ in r
        ]
        if not points:
            return None
        rings = [tuple(_hull(points))]
    roof_max = _numbers(_attributes(element, "DACH_MAX"))
    terrain = _numbers(_attributes(element, "GELAENDEPUNKT"))
    heights = [z for s in element.iter(f"{BLDG}RoofSurface") for r in _rings(s) for _, _, z in r]
    top = max(roof_max) if roof_max else max(heights, default=0.0)
    bottom = min(terrain) if terrain else min((z for r in ground for _, _, z in r), default=top)
    egids = [int(v) for v in _numbers(_attributes(element, "EGID")) if v > 0]
    kinds = [k for k in _attributes(element, "OBJEKTART") if k]
    return Building(
        egid=egids[0] if egids else None,
        kind=kinds[0] if kinds else "",
        rings=tuple(rings),
        height_m=max(0.0, top - bottom),
    )


def iter_buildings(stream: IO[bytes]) -> Iterator[Building]:
    events = ElementTree.iterparse(stream, events=("start", "end"))
    root = None
    for event, element in events:
        if root is None and event == "start":
            root = element
        if event == "end" and element.tag == f"{BLDG}Building":
            building = read_building(element)
            if building is not None:
                yield building
            element.clear()
            if root is not None:
                root.clear()
