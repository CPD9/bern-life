import io
import json
import struct
import tempfile
import unittest
from pathlib import Path

from infra.geo.addresses import parse_hit, query_for
from infra.geo.citygml import iter_buildings, outline
from infra.geo.encode import AnchorItem, FootprintItem, LineItem, encode
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
