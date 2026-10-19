"""The compact map file the web app loads: web/public/world/bern.geo.

Little-endian. Header: b"BGEO", u16 version (1), u16 steps per unit (16), f32 metres per unit
(20), f64 origin E, f64 origin N (LV95), u16 section count. Each section: u8 kind, u32 item count,
u32 byte length, then its items. Points are (i16 x, i16 z) in 1/16 map unit.

- kind 1, buildings: u8 flags (bit 0: landmark), u8 height in metres (0-255), u16 point count,
  points (the footprint ring, not repeated at the end).
- kind 2, lines: u8 category (1 road, 2 water, 3 rail), u8 width in metres, u8 TLM objektart,
  u16 point count, points.
- kind 3, place anchors: u8 id length, id (UTF-8), i16 x, i16 z, i32 index of the building the
  place stands in (-1 when no footprint matched).

Lines and anchors are sorted here; buildings keep the order they are given in (the builder sorts
them), because anchors refer to buildings by index. The same data gives the same bytes.
"""

import struct
from dataclasses import dataclass

from infra.geo.frame import METRES_PER_UNIT, ORIGIN_E, ORIGIN_N, STEPS_PER_UNIT, quantize

MAGIC = b"BGEO"
VERSION = 1
BUILDINGS, LINES, ANCHORS = 1, 2, 3
ROAD, WATER, RAIL = 1, 2, 3
LANDMARK = 1

MapPoint = tuple[float, float]


@dataclass(frozen=True)
class FootprintItem:
    ring: tuple[MapPoint, ...]
    height_m: float
    landmark: bool


@dataclass(frozen=True)
class LineItem:
    category: int
    width_m: float
    objektart: int
    points: tuple[MapPoint, ...]


@dataclass(frozen=True)
class AnchorItem:
    place_id: str
    point: MapPoint
    building: int


def _points(points: tuple[MapPoint, ...]) -> bytes:
    return b"".join(struct.pack("<hh", quantize(x), quantize(z)) for x, z in points)


def _byte(value: float) -> int:
    return max(0, min(255, round(value)))


def _section(kind: int, items: list[bytes]) -> bytes:
    body = b"".join(items)
    return struct.pack("<BII", kind, len(items), len(body)) + body


def encode(
    buildings: list[FootprintItem], lines: list[LineItem], anchors: list[AnchorItem]
) -> bytes:
    building_items = [
        struct.pack("<BBH", LANDMARK if b.landmark else 0, _byte(b.height_m), len(b.ring))
        + _points(b.ring)
        for b in buildings
    ]
    line_items = [
        struct.pack("<BBBH", line.category, _byte(line.width_m), line.objektart, len(line.points))
        + _points(line.points)
        for line in sorted(lines, key=lambda line: (line.category, line.points))
    ]
    anchor_items = []
    for anchor in sorted(anchors, key=lambda a: a.place_id):
        name = anchor.place_id.encode()
        x, z = anchor.point
        anchor_items.append(
            struct.pack("<B", len(name))
            + name
            + struct.pack("<hhi", quantize(x), quantize(z), anchor.building)
        )
    header = MAGIC + struct.pack(
        "<HHfddH", VERSION, STEPS_PER_UNIT, METRES_PER_UNIT, ORIGIN_E, ORIGIN_N, 3
    )
    return (
        header
        + _section(BUILDINGS, building_items)
        + _section(LINES, line_items)
        + _section(ANCHORS, anchor_items)
    )
