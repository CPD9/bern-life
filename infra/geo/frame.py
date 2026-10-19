"""The map frame every world feature shares, now anchored to Swiss national coordinates (LV95).

1 unit = 20 m, origin at the Zytglogge ("Bim Zytglogge 1", from the federal building address
register), +x east, -z north. Coordinates are stored as int16 in 1/16 of a unit (1.25 m), which
covers +-2048 units (+-41 km) around the origin, far more than the map needs.
"""

ORIGIN_E = 2600706.2
ORIGIN_N = 1199646.9
METRES_PER_UNIT = 20.0
STEPS_PER_UNIT = 16

# The area of the map: Länggasse and Bremgartenwald in the north-west, Lorraine in the north, the
# Old Town in the Aare loop, Kirchenfeld in the east, Insel and Mattenhof, Liebefeld in the
# south-west. LV95 metres.
BOX = {"min_e": 2597600.0, "max_e": 2602000.0, "min_n": 1197300.0, "max_n": 1201500.0}

INT16_MIN = -32768
INT16_MAX = 32767


class FrameError(Exception):
    """A coordinate outside the stored range: a plain sentence, fit to print as is."""


def to_map(e: float, n: float) -> tuple[float, float]:
    return ((e - ORIGIN_E) / METRES_PER_UNIT, -(n - ORIGIN_N) / METRES_PER_UNIT)


def quantize(value: float) -> int:
    step = round(value * STEPS_PER_UNIT)
    if not INT16_MIN <= step <= INT16_MAX:
        raise FrameError(f"{value} units is outside the stored range")
    return step


def in_box(e: float, n: float) -> bool:
    return BOX["min_e"] <= e <= BOX["max_e"] and BOX["min_n"] <= n <= BOX["max_n"]
