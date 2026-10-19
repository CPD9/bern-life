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

decode() reads a file back for `build anchors`: buildings and lines stay the bytes they were
stored as, so writing the file again copies them byte for byte.
"""

import struct
from dataclasses import dataclass

from infra.geo.frame import METRES_PER_UNIT, ORIGIN_E, ORIGIN_N, STEPS_PER_UNIT, quantize

MAGIC = b"BGEO"
VERSION = 1
BUILDINGS, LINES, ANCHORS = 1, 2, 3
ROAD, WATER, RAIL = 1, 2, 3
LANDMARK = 1

HEADER = struct.Struct("<HHfddH")
SECTION = struct.Struct("<BII")

MapPoint = tuple[float, float]


class GeoFormatError(Exception):
    """A file decode() refuses: a plain sentence, fit to print as is."""


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
    return SECTION.pack(kind, len(items), len(body)) + body


def building_item(building: FootprintItem) -> bytes:
    flags = LANDMARK if building.landmark else 0
    head = struct.pack("<BBH", flags, _byte(building.height_m), len(building.ring))
    return head + _points(building.ring)


def line_item(line: LineItem) -> bytes:
    return struct.pack(
        "<BBBH", line.category, _byte(line.width_m), line.objektart, len(line.points)
    ) + _points(line.points)


def anchor_item(anchor: AnchorItem) -> bytes:
    name = anchor.place_id.encode()
    x, z = anchor.point
    return (
        struct.pack("<B", len(name))
        + name
        + struct.pack("<hhi", quantize(x), quantize(z), anchor.building)
    )


def assemble(
    building_items: list[bytes], line_items: list[bytes], anchors: list[AnchorItem]
) -> bytes:
    """The header and the three sections, around building and line items already encoded."""
    header = MAGIC + HEADER.pack(VERSION, STEPS_PER_UNIT, METRES_PER_UNIT, ORIGIN_E, ORIGIN_N, 3)
    anchor_items = [anchor_item(a) for a in sorted(anchors, key=lambda a: a.place_id)]
    return (
        header
        + _section(BUILDINGS, building_items)
        + _section(LINES, line_items)
        + _section(ANCHORS, anchor_items)
    )


def encode(
    buildings: list[FootprintItem], lines: list[LineItem], anchors: list[AnchorItem]
) -> bytes:
    return assemble(
        [building_item(b) for b in buildings],
        [line_item(line) for line in sorted(lines, key=lambda line: (line.category, line.points))],
        anchors,
    )


@dataclass(frozen=True)
class DecodedGeo:
    """A decoded file. Points are in map units, read back from their 1/16 steps exactly."""

    building_items: tuple[bytes, ...]
    line_items: tuple[bytes, ...]
    footprints: tuple[FootprintItem, ...]
    anchors: tuple[AnchorItem, ...]

    def encode(self, anchors: list[AnchorItem]) -> bytes:
        """The same buildings and lines byte for byte, with these anchors."""
        return assemble(list(self.building_items), list(self.line_items), anchors)


class _Reader:
    def __init__(self, data: bytes) -> None:
        self.data = data
        self.offset = 0

    def take(self, size: int) -> bytes:
        if self.offset + size > len(self.data):
            raise GeoFormatError("bern.geo is truncated")
        chunk = self.data[self.offset : self.offset + size]
        self.offset += size
        return chunk

    def unpack(self, layout: str | struct.Struct) -> tuple:
        layout = layout if isinstance(layout, struct.Struct) else struct.Struct(layout)
        return layout.unpack(self.take(layout.size))

    def points(self, count: int) -> tuple[MapPoint, ...]:
        steps = self.unpack(f"<{2 * count}h")
        return tuple(
            (steps[i] / STEPS_PER_UNIT, steps[i + 1] / STEPS_PER_UNIT)
            for i in range(0, len(steps), 2)
        )


def decode(data: bytes) -> DecodedGeo:
    """Reads a file encode() wrote in this frame; anything else is a GeoFormatError."""
    read = _Reader(data)
    if read.take(len(MAGIC)) != MAGIC:
        raise GeoFormatError("not a bern.geo file")
    version, steps, metres, origin_e, origin_n, sections = read.unpack(HEADER)
    if version != VERSION:
        raise GeoFormatError(f"bern.geo version {version} is not {VERSION}")
    if (steps, metres, origin_e, origin_n) != (
        STEPS_PER_UNIT,
        METRES_PER_UNIT,
        ORIGIN_E,
        ORIGIN_N,
    ):
        raise GeoFormatError("bern.geo is in another map frame than infra/geo/frame.py")
    if sections != 3:
        raise GeoFormatError(f"bern.geo has {sections} sections, not 3")
    building_items: list[bytes] = []
    line_items: list[bytes] = []
    footprints: list[FootprintItem] = []
    anchors: list[AnchorItem] = []
    for expected in (BUILDINGS, LINES, ANCHORS):
        kind, count, length = read.unpack(SECTION)
        if kind != expected:
            raise GeoFormatError(f"bern.geo section {kind} where section {expected} belongs")
        end = read.offset + length
        for _ in range(count):
            start = read.offset
            if kind == BUILDINGS:
                flags, height, point_count = read.unpack("<BBH")
                ring = read.points(point_count)
                footprints.append(FootprintItem(ring, height, bool(flags & LANDMARK)))
                building_items.append(data[start : read.offset])
            elif kind == LINES:
                category, _width, _objektart, point_count = read.unpack("<BBBH")
                if category not in (ROAD, WATER, RAIL):
                    raise GeoFormatError(f"bern.geo has a line of unknown category {category}")
                read.points(point_count)
                line_items.append(data[start : read.offset])
            else:
                (name_length,) = read.unpack("<B")
                place_id = read.take(name_length).decode()
                x, z, building = read.unpack("<hhi")
                point = (x / STEPS_PER_UNIT, z / STEPS_PER_UNIT)
                anchors.append(AnchorItem(place_id, point, building))
        if read.offset != end:
            raise GeoFormatError(f"bern.geo section {kind} length does not match")
    if read.offset != len(data):
        raise GeoFormatError("bern.geo has bytes after the last section")
    return DecodedGeo(tuple(building_items), tuple(line_items), tuple(footprints), tuple(anchors))
