"""Douglas-Peucker for open lines and closed rings; a ring's area, and where a point is from it.

A footprint keeps its corners and loses the near-straight points the 3D model carries along walls;
1 m of tolerance is below what one stored step (1.25 m) can show anyway.
"""

Point = tuple[float, float]


def _distance_to_segment(p: Point, a: Point, b: Point) -> float:
    dx, dy = b[0] - a[0], b[1] - a[1]
    length_sq = dx * dx + dy * dy
    if length_sq == 0:
        return ((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2) ** 0.5
    t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length_sq))
    return ((p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2) ** 0.5


def simplify_line(points: list[Point], tolerance: float) -> list[Point]:
    if len(points) < 3:
        return list(points)
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        far, far_index = 0.0, -1
        for i in range(first + 1, last):
            distance = _distance_to_segment(points[i], points[first], points[last])
            if distance > far:
                far, far_index = distance, i
        if far > tolerance:
            keep[far_index] = True
            stack.extend([(first, far_index), (far_index, last)])
    return [point for point, kept in zip(points, keep, strict=True) if kept]


def simplify_ring(ring: list[Point], tolerance: float) -> list[Point]:
    """A closed ring without its repeated last point; split at the point farthest from the first."""
    points = ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else list(ring)
    if len(points) <= 3:
        return points
    far_index = max(
        range(len(points)),
        key=lambda i: (points[i][0] - points[0][0]) ** 2 + (points[i][1] - points[0][1]) ** 2,
    )
    first_half = simplify_line(points[: far_index + 1], tolerance)
    second_half = simplify_line([*points[far_index:], points[0]], tolerance)
    return first_half[:-1] + second_half[:-1]


def ring_area(ring: list[Point]) -> float:
    total = 0.0
    for (x1, y1), (x2, y2) in zip(ring, [*ring[1:], ring[0]], strict=True):
        total += x1 * y2 - x2 * y1
    return abs(total) / 2


def inside(point: Point, ring: list[Point]) -> bool:
    """Even-odd rule, the same test as pointInPolygon in web/features/world/geometry.ts."""
    x, y = point
    result = False
    for (xi, yi), (xj, yj) in zip(ring, [ring[-1], *ring[:-1]], strict=True):
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            result = not result
    return result


def distance_to_ring(point: Point, ring: list[Point]) -> float:
    """Distance from the point to the nearest edge of the ring (0 on an edge)."""
    return min(
        _distance_to_segment(point, a, b) for a, b in zip(ring, [*ring[1:], ring[0]], strict=True)
    )
