import io
import json
import struct
import tempfile
import unittest
import urllib.parse
from pathlib import Path

from infra.geo.addresses import parse_hit, query_for
from infra.geo.anchors import add_anchors
from infra.geo.citygml import iter_buildings, outline
from infra.geo.encode import (
    HEADER,
    MAGIC,
    SECTION,
    AnchorItem,
    FootprintItem,
    GeoFormatError,
    LineItem,
    anchor_item,
    decode,
    encode,
)
from infra.geo.frame import ORIGIN_E, ORIGIN_N, FrameError, quantize, to_map
from infra.geo.simplify import ring_area, simplify_line, simplify_ring
from infra.geo.tlm import cells, fetch_all, read_lines

GML = """<?xml version="1.0" encoding="UTF-8"?>
<core:CityModel xmlns:core="http://www.opengis.net/citygml/2.0"
  xmlns:bldg="http://www.opengis.net/citygml/building/2.0"
  xmlns:gen="http://www.opengis.net/citygml/generics/2.0" xmlns:gml="http://www.opengis.net/gml">
 <core:cityObjectMember><bldg:Building gml:id="a">
  <bldg:boundedBy><bldg:GroundSurface>
   <gen:intAttribute name="EGID"><gen:value>1230408</gen:value></gen:intAttribute>
   <gen:stringAttribute name="OBJEKTART">
    <gen:value>Gebaeude Einzelhaus</gen:value></gen:stringAttribute>
   <gen:doubleAttribute name="GELAENDEPUNKT"><gen:value>540.0</gen:value></gen:doubleAttribute>
   <gen:doubleAttribute name="DACH_MAX"><gen:value>552.5</gen:value></gen:doubleAttribute>
   <bldg:lod2MultiSurface><gml:MultiSurface><gml:surfaceMember><gml:Polygon><gml:exterior>
    <gml:LinearRing><gml:posList>10 20 540 30 20 540 30 40 540 10 40 540 10 20 540</gml:posList>
    </gml:LinearRing></gml:exterior></gml:Polygon></gml:surfaceMember></gml:MultiSurface>
   </bldg:lod2MultiSurface>
  </bldg:GroundSurface></bldg:boundedBy>
 </bldg:Building></core:cityObjectMember>
 <core:cityObjectMember><bldg:Building gml:id="b">
  <bldg:boundedBy><bldg:RoofSurface>
   <bldg:lod2MultiSurface><gml:MultiSurface><gml:surfaceMember><gml:Polygon><gml:exterior>
    <gml:LinearRing><gml:posList>0 0 9 4 0 9 4 4 12 0 4 9 2 2 10 0 0 9</gml:posList>
    </gml:LinearRing></gml:exterior></gml:Polygon></gml:surfaceMember></gml:MultiSurface>
   </bldg:lod2MultiSurface>
  </bldg:RoofSurface></bldg:boundedBy>
 </bldg:Building></core:cityObjectMember>
</core:CityModel>"""


class FrameTest(unittest.TestCase):
    def test_the_zytglogge_is_the_origin_and_one_unit_is_20_metres(self):
        self.assertEqual(to_map(ORIGIN_E, ORIGIN_N), (0.0, 0.0))
        self.assertEqual(to_map(ORIGIN_E + 20, ORIGIN_N + 40), (1.0, -2.0))

    def test_quantize_to_sixteenths_of_a_unit_within_int16(self):
        self.assertEqual([quantize(v) for v in (0, 1, -0.5, 2047.9)], [0, 16, -8, 32766])
        with self.assertRaises(FrameError):
            quantize(2048.1)


class SimplifyTest(unittest.TestCase):
    def test_points_on_a_straight_wall_go_and_corners_stay(self):
        line = [(0, 0), (5, 0.2), (10, 0), (10, 10)]
        self.assertEqual(simplify_line(line, 1.0), [(0, 0), (10, 0), (10, 10)])
        ring = [(0, 0), (5, 0.1), (10, 0), (10, 10), (0, 10), (0, 0)]
        self.assertEqual(simplify_ring(ring, 1.0), [(0, 0), (10, 0), (10, 10), (0, 10)])
        self.assertEqual(ring_area([(0, 0), (10, 0), (10, 10), (0, 10)]), 100.0)


class CityGmlTest(unittest.TestCase):
    def test_ground_ring_height_egid_and_a_roof_only_fallback(self):
        first, second = list(iter_buildings(io.BytesIO(GML.encode())))
        self.assertEqual(first.egid, 1230408)
        self.assertEqual(first.kind, "Gebaeude Einzelhaus")
        self.assertEqual(first.rings, (((10, 20), (30, 20), (30, 40), (10, 40)),))
        self.assertEqual(first.height_m, 12.5)
        self.assertIsNone(second.egid)
        self.assertEqual(second.rings, (((0, 0), (4, 0), (4, 4), (0, 4)),))
        self.assertEqual(second.height_m, 0.0)


class OutlineTest(unittest.TestCase):
    def test_two_triangles_make_one_square_and_a_courtyard_hole_is_dropped(self):
        square = outline([[(0, 0), (4, 0), (4, 4)], [(0, 0), (4, 4), (0, 4)]])
        self.assertEqual(square, [[(0, 0), (4, 0), (4, 4), (0, 4)]])
        edges = (0, 1, 5, 6)
        grid = [
            [
                (edges[i], edges[j]),
                (edges[i + 1], edges[j]),
                (edges[i + 1], edges[j + 1]),
                (edges[i], edges[j + 1]),
            ]
            for i in range(3)
            for j in range(3)
            if (i, j) != (1, 1)
        ]
        rings = outline(grid)
        self.assertEqual(len(rings), 1)
        self.assertEqual(rings[0][0], (0, 0))
        self.assertEqual(
            sorted(rings[0]),
            sorted({(x, y) for x in edges for y in edges if x in (0, 6) or y in (0, 6)}),
        )

    def test_an_outline_that_does_not_close_is_none(self):
        self.assertIsNone(outline([[(0, 0), (4, 0), (4, 4)], [(0, 0), (2, 0), (0, 4)]]))


class EncodeTest(unittest.TestCase):
    def test_header_sections_and_items_byte_for_byte(self):
        data = encode(
            [FootprintItem(ring=((0, 0), (1, 0), (1, 1)), height_m=12.4, landmark=True)],
            [LineItem(category=2, width_m=50, objektart=4, points=((0, 0), (-1, 2)))],
            [AnchorItem(place_id="inf", point=(0.5, -0.25), building=0)],
        )
        header = b"BGEO" + struct.pack("<HHfddH", 1, 16, 20.0, ORIGIN_E, ORIGIN_N, 3)
        building = struct.pack("<BBH", 1, 12, 3) + struct.pack("<hhhhhh", 0, 0, 16, 0, 16, 16)
        line = struct.pack("<BBBH", 2, 50, 4, 2) + struct.pack("<hhhh", 0, 0, -16, 32)
        anchor = struct.pack("<B", 3) + b"inf" + struct.pack("<hhi", 8, -4, 0)
        self.assertEqual(
            data,
            header
            + struct.pack("<BII", 1, 1, len(building))
            + building
            + struct.pack("<BII", 2, 1, len(line))
            + line
            + struct.pack("<BII", 3, 1, len(anchor))
            + anchor,
        )


class DecodeTest(unittest.TestCase):
    def tiny(self) -> bytes:
        return encode(
            [
                FootprintItem(ring=((0, 0), (2, 0), (2, 2), (0, 2)), height_m=18, landmark=False),
                FootprintItem(ring=((5, 5), (6, 5), (6, 6.5)), height_m=40, landmark=True),
            ],
            [
                LineItem(category=1, width_m=7, objektart=8, points=((0, 0), (3.0625, -1))),
                LineItem(category=3, width_m=4, objektart=0, points=((1, 1), (2, 2), (3, 1))),
            ],
            [
                AnchorItem(place_id="zed", point=(9.5, 9.5), building=-1),
                AnchorItem(place_id="abc", point=(1.25, -0.5), building=0),
            ],
        )

    def test_encode_decode_encode_gives_the_same_bytes(self):
        data = self.tiny()
        geo = decode(data)
        self.assertEqual(geo.encode(list(geo.anchors)), data)
        self.assertEqual(
            geo.footprints[1],
            FootprintItem(ring=((5, 5), (6, 5), (6, 6.5)), height_m=40, landmark=True),
        )
        self.assertEqual(
            geo.anchors,
            (
                AnchorItem(place_id="abc", point=(1.25, -0.5), building=0),
                AnchorItem(place_id="zed", point=(9.5, 9.5), building=-1),
            ),
        )
        self.assertEqual(len(geo.line_items), 2)

    def test_another_format_frame_layout_a_cut_off_file_and_trailing_bytes_are_refused(self):
        data = self.tiny()
        buildings = len(MAGIC) + HEADER.size  # the first section's kind, count, byte length
        (length,) = struct.unpack_from("<I", data, buildings + 5)
        first_line = buildings + SECTION.size + length + SECTION.size
        for broken, reason in [
            (b"XGEO" + data[4:], "not a bern.geo file"),
            (data[:4] + struct.pack("<H", 2) + data[6:], "bern.geo version 2 is not 1"),
            (data[:8] + struct.pack("<f", 25.0) + data[12:], "bern.geo is in another map frame"),
            (
                data[: buildings - 2] + struct.pack("<H", 4) + data[buildings:],
                "bern.geo has 4 sections, not 3",
            ),
            (
                data[:buildings] + bytes([2]) + data[buildings + 1 :],
                "bern.geo section 2 where section 1 belongs",
            ),
            (
                data[: buildings + 5] + struct.pack("<I", length + 1) + data[buildings + 9 :],
                "bern.geo section 1 length does not match",
            ),
            (
                data[:first_line] + bytes([9]) + data[first_line + 1 :],
                "bern.geo has a line of unknown category 9",
            ),
            (data[:-1], "bern.geo is truncated"),
            (data + b"\0", "bern.geo has bytes after the last section"),
        ]:
            with self.subTest(reason=reason), self.assertRaises(GeoFormatError) as caught:
                decode(broken)
            self.assertTrue(str(caught.exception).startswith(reason))


def _search_answer(e: float, n: float) -> bytes:
    attrs = {"origin": "address", "y": e, "x": n, "featureId": "1_0"}
    return json.dumps({"results": [{"attrs": attrs}]}).encode()


class AddAnchorsTest(unittest.TestCase):
    """Invented map: two 40 m squares, an L whose centre is outside it, a road, and a place
    already anchored in the first square."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.dir = Path(tmp.name)
        self.out = self.dir / "bern.geo"
        self.out.write_bytes(
            encode(
                [
                    FootprintItem(
                        ring=((0, 0), (2, 0), (2, 2), (0, 2)), height_m=20, landmark=False
                    ),
                    FootprintItem(
                        ring=((10, 0), (12, 0), (12, 2), (10, 2)), height_m=9, landmark=False
                    ),
                    FootprintItem(
                        ring=((20, 0), (24, 0), (24, 1), (21, 1), (21, 4), (20, 4)),
                        height_m=6,
                        landmark=False,
                    ),
                ],
                [LineItem(category=1, width_m=7, objektart=8, points=((0, 3), (12, 3)))],
                [AnchorItem(place_id="kept", point=(0.5, 0.5), building=0)],
            )
        )
        self.places = self.dir / "places.json"
        self.urls: list[str] = []
        self.sleeps: list[float] = []
        # Map units to LV95: x east by 20 m, z south by 20 m. Neustrasse 2 is in the first
        # square, Wandweg 3 1.25 m east of the second as stored, Eckweg 5 1.25 m east of the L,
        # Feldweg 9 far from all three; the search finds no Leerweg 1.
        self.answers = {
            "Neustrasse 2 Bern": _search_answer(ORIGIN_E + 30, ORIGIN_N - 20),
            "Wandweg 3 Bern": _search_answer(ORIGIN_E + 241, ORIGIN_N - 20),
            "Eckweg 5 Bern": _search_answer(ORIGIN_E + 481, ORIGIN_N - 10),
            "Feldweg 9 Bern": _search_answer(ORIGIN_E + 120, ORIGIN_N - 200),
            "Leerweg 1 Bern": json.dumps({"results": []}).encode(),
        }

    def write_places(self, *addresses: tuple[str, str | None]) -> None:
        self.places.write_text(
            json.dumps(
                [
                    {
                        "id": place_id,
                        "position_method": "address" if address else "district",
                        "address": address,
                    }
                    for place_id, address in addresses
                ]
            )
        )

    def get(self, url: str) -> bytes:
        self.urls.append(url)
        query = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)["searchText"][0]
        return self.answers[query]

    def add(self):
        return add_anchors(
            self.out, self.places, self.dir / "addresses", get=self.get, sleep=self.sleeps.append
        )

    def test_a_missing_anchor_is_added_and_everything_else_is_kept_byte_for_byte(self):
        self.write_places(
            ("kept", "Altstrasse 1"),
            ("inner", "Neustrasse 2, Bern"),
            ("wall", "Wandweg 3"),
            ("district", None),
        )
        before = decode(self.out.read_bytes())
        placed = self.add()
        after = decode(self.out.read_bytes())
        self.assertEqual(after.building_items, before.building_items)
        self.assertEqual(after.line_items, before.line_items)
        self.assertEqual(
            after.anchors,
            (
                AnchorItem(place_id="inner", point=(1.5, 1.0), building=0),
                AnchorItem(place_id="kept", point=(0.5, 0.5), building=0),
                AnchorItem(place_id="wall", point=(11.0, 1.0), building=1),
            ),
        )
        self.assertEqual(
            [(p.anchor.place_id, p.on_wall_m) for p in placed], [("inner", None), ("wall", 1.25)]
        )
        self.assertEqual(len(self.urls), 2)
        self.assertEqual(self.sleeps, [1.0])
        data = self.out.read_bytes()
        self.assertEqual(self.add(), [])
        self.assertEqual(self.out.read_bytes(), data)
        self.assertEqual(len(self.urls), 2)

    def test_each_place_that_cannot_be_anchored_is_named_and_the_file_is_unchanged(self):
        self.write_places(
            ("inner", "Neustrasse 2"),
            ("field", "Feldweg 9"),
            ("corner", "Eckweg 5"),
            ("nameless", "Inselspital"),
            ("unknown", "Leerweg 1"),
        )
        data = self.out.read_bytes()
        with self.assertRaises(SystemExit) as caught:
            self.add()
        self.assertEqual(
            str(caught.exception).splitlines(),
            [
                "bern.geo unchanged:",
                "corner: the address point of 'Eckweg 5 Bern' is 1.25 m outside building 2, "
                "whose centre is outside its footprint",
                "field: the address point of 'Feldweg 9 Bern' is more than "
                "2.5 m from every footprint",
                "nameless: its address has no street and number to look up",
                "unknown: geo.admin search found no address for 'Leerweg 1 Bern'",
            ],
        )
        self.assertEqual(self.out.read_bytes(), data)

    def test_a_file_that_does_not_encode_back_to_itself_is_refused_before_any_lookup(self):
        kept = AnchorItem(place_id="kept", point=(0.5, 0.5), building=0)
        stored = self.out.read_bytes()
        anchors_at = len(stored) - SECTION.size - len(anchor_item(kept))
        # Anchors out of order: encode() sorts them, so writing this file again would move them.
        body = anchor_item(AnchorItem(place_id="zed", point=(11, 1), building=1))
        body += anchor_item(kept)
        unsorted = stored[:anchors_at] + SECTION.pack(3, 2, len(body)) + body
        self.out.write_bytes(unsorted)
        self.write_places(("inner", "Neustrasse 2"))
        with self.assertRaises(GeoFormatError) as caught:
            self.add()
        self.assertEqual(
            str(caught.exception),
            "bern.geo does not encode back to itself; rebuild it with `build`",
        )
        self.assertEqual(self.out.read_bytes(), unsorted)
        self.assertEqual(self.urls, [])


class AddressTest(unittest.TestCase):
    def test_the_query_is_the_street_and_number_and_a_hit_carries_the_egid(self):
        self.assertEqual(
            query_for("Inselspital, INO-F; Rosenbühlgasse 27"), "Rosenbühlgasse 27 Bern"
        )
        self.assertEqual(query_for("Murtenstrasse 50, 3008 Bern"), "Murtenstrasse 50 Bern")
        self.assertIsNone(query_for("Inselspital"))
        body = json.dumps(
            {
                "results": [
                    {
                        "attrs": {
                            "origin": "address",
                            "y": 2598931.8,
                            "x": 1199909.0,
                            "featureId": "504011491_0",
                        }
                    }
                ]
            }
        ).encode()
        hit = parse_hit("Murtenstrasse 50 Bern", body)
        self.assertEqual((hit.e, hit.n, hit.egid), (2598931.8, 1199909.0, 504011491))
        self.assertIsNone(parse_hit("x", b'{"results": []}'))


class TlmTest(unittest.TestCase):
    def test_the_box_is_81_cells_and_a_cached_feature_in_two_cells_is_kept_once(self):
        self.assertEqual(len(list(cells())), 81)
        result = {
            "results": [
                {
                    "featureId": 7,
                    "properties": {"objektart": 10},
                    "geometry": {"type": "LineString", "coordinates": [[1, 2], [3, 4]]},
                }
            ]
        }
        with tempfile.TemporaryDirectory() as tmp:
            cache = Path(tmp)
            urls = []

            def get(url):
                urls.append(url)
                return json.dumps(result).encode()

            sleeps = []
            sent = fetch_all(cache, get=get, sleep=sleeps.append)
            self.assertEqual(sent, 243)
            self.assertEqual(sleeps, [1.0] * 242)
            self.assertEqual(fetch_all(cache, get=get, sleep=sleeps.append), 0)
            lines = read_lines(cache)
            self.assertEqual(
                [(line.layer, line.paths) for line in lines],
                [
                    ("rail", (((1.0, 2.0), (3.0, 4.0)),)),
                    ("roads", (((1.0, 2.0), (3.0, 4.0)),)),
                    ("water", (((1.0, 2.0), (3.0, 4.0)),)),
                ],
            )


if __name__ == "__main__":
    unittest.main()
