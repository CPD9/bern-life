"""Hand-written SVG charts for the technical report: horizontal bars with intervals.

Adapted from CPD9/apertus-redteam-graph track_1a/scripts/report_charts.py (501db67, Apache-2.0).
The bar chart stays and gains a reference line (the case's bar), a count axis, rows set apart in
groups and a figure that is only a note; the heatmap and the red-team colours are gone. Label
widths come from Helvetica's average advance per character class, which is close enough to lay
out a figure without a font engine.
"""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from math import ceil
from xml.sax.saxutils import escape

FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif"
INK, SOFT, MUTED = "#1f2430", "#4b5260", "#868b94"
GRID, AXIS = "#e6e4de", "#c3c1b8"
RED, BLUE, GREY = "#c8102e", "#3d6fb6", "#b8b5ad"  # measured; what it is set against; context
HALF, FULL, PAD = 360, 720, 12  # half- and full-width figures print at the same type scale
NOTE_SIZE, NOTE_LEADING = 10, 13.5
STEPS = (1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000)

Series = Sequence[tuple[str, str]]


@dataclass(frozen=True)
class Entry:
    """One bar: its value, its 95% interval when known, a label in place of the formatted value
    and a colour in place of the series colour."""

    value: float
    ci95: tuple[float, float] | None = None
    label: str | None = None
    color: str | None = None


@dataclass(frozen=True)
class Row:
    """One group of bars: a label, one entry per series (None draws nothing), the text of the
    right column, and whether a gap and a rule set the row apart from the ones above."""

    label: str
    entries: tuple[Entry | None, ...]
    right: str | None = None
    apart: bool = False


@dataclass(frozen=True)
class Axis:
    maximum: float
    ticks: tuple[tuple[float, str], ...]
    fmt: Callable[[float], str]


def share(value: float) -> str:
    return f"{value:.2f}"


def count(value: float) -> str:
    return f"{value:,.0f}"


SHARE = Axis(1.0, ((0, "0"), (0.25, "0.25"), (0.5, "0.5"), (0.75, "0.75"), (1, "1")), share)


def count_axis(values: Sequence[float]) -> Axis:
    """Ticks at a round step, at most four of them, up to a round maximum above every value."""
    top = max(values)
    step = next(s for s in STEPS if top / s <= 3)
    maximum = ceil(top / step) * step
    ticks = tuple((k * step, count(k * step)) for k in range(int(maximum // step) + 1))
    return Axis(maximum, ticks, count)


def text_width(s: str, size: float) -> float:
    return size * sum(
        0.28 if c in "fijlrt.,:;'()| " else 0.84 if c in "mwMW%" else 0.67 if c.isupper() else 0.56
        for c in s
    )


def text(
    x: float, y: float, s: object, size: float = 11, fill: str = INK, anchor: str = "start"
) -> str:
    return (
        f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{fill}" '
        f'text-anchor="{anchor}">{escape(str(s))}</text>'
    )


def document(width: int, height: float, title: str, parts: Sequence[str]) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height:.0f}" '
        f'width="{width}" height="{height:.0f}" role="img" aria-labelledby="title" '
        f'font-family="{FONT}">\n<title id="title">{escape(title)}</title>\n'
        '<rect width="100%" height="100%" fill="#ffffff"/>\n' + "\n".join(parts) + "\n</svg>\n"
    )


def bar(x: float, y: float, width: float, height: float, fill: str, tip: str) -> str:
    if width <= 0:
        return ""
    r = min(2.0, width, height / 2)  # square at the baseline, rounded at the data end
    d = (
        f"M{x:.1f},{y:.1f}h{width - r:.1f}a{r:.1f},{r:.1f} 0 0 1 {r:.1f},{r:.1f}"
        f"v{height - 2 * r:.1f}a{r:.1f},{r:.1f} 0 0 1 {-r:.1f},{r:.1f}h{r - width:.1f}z"
    )
    return f'<path d="{d}" fill="{fill}"><title>{escape(tip)}</title></path>'


def whisker(x0: float, x1: float, y: float, cap: float) -> str:
    return (
        f'<path d="M{x0:.1f},{y:.1f}H{x1:.1f}M{x0:.1f},{y - cap:.1f}V{y + cap:.1f}'
        f'M{x1:.1f},{y - cap:.1f}V{y + cap:.1f}" stroke="{SOFT}" fill="none"/>'
    )


def legend(series: Series, y: float, with_ci: bool) -> list[str]:
    parts: list[str] = []
    x: float = PAD
    for name, color in series:
        parts += [
            f'<rect x="{x:.1f}" y="{y - 8.5:.1f}" width="9" height="9" rx="2" fill="{color}"/>',
            text(x + 13, y, name, 10.5, SOFT),
        ]
        x += 13 + text_width(name, 10.5) + 14
    if with_ci:
        parts += [whisker(x, x + 14, y - 4, 3), text(x + 19, y, "95% interval", 10.5, SOFT)]
    return parts


def wrap(sentence: str, width: float, size: float) -> list[str]:
    lines = [""]
    for word in sentence.split():
        trial = f"{lines[-1]} {word}".strip()
        if lines[-1] and text_width(trial, size) > width:
            lines.append(word)
        else:
            lines[-1] = trial
    return lines


def note(sentence: str, top: float, width: int) -> tuple[list[str], float]:
    """The note's lines below top, and the y where the last one ends."""
    lines = wrap(sentence, width - 2 * PAD, NOTE_SIZE)
    baselines = [top + NOTE_LEADING * (k + 1) for k in range(len(lines))]
    parts = [text(PAD, y, line, NOTE_SIZE, SOFT) for y, line in zip(baselines, lines, strict=True)]
    return parts, baselines[-1] + 4  # room for descenders


def note_only(title: str, sentence: str, width: int = HALF) -> str:
    """A figure that holds only its title and a note: what was not computed, and how to."""
    parts = [text(PAD, PAD + 12, title, 11, INK)]
    lines, end = note(sentence, PAD + 18, width)
    return document(width, end + PAD, title, parts + lines)


def tail_width(rows: Sequence[Row], axis: Axis) -> float:
    """Room right of the plot: the right column, or the value labels past the bars."""
    rights = [text_width(r.right, 11) for r in rows if r.right is not None]
    values = [
        text_width(e.label or axis.fmt(e.value), 10) + 4
        for r in rows
        if r.right is None
        for e in r.entries
        if e is not None
    ]
    return max([*rights, *values, 32])


def bar_chart(
    rows: Sequence[Row],
    series: Series,
    sentence: str,
    title: str,
    *,
    right_header: str | None = None,
    reference: tuple[float, str] | None = None,
    axis: Axis = SHARE,
    width: int = HALF,
) -> str:
    """Horizontal bars, one group per row and one bar per series, whiskers where an interval is
    known. A row with right-column text carries it at the right edge; the others carry each bar's
    value past its end. reference is a value and its label: a dashed line across the plot."""
    size, bar_h, gap = (10, 4.5, 5.0) if len(rows) > 12 else (11, 9.0, 9.0)
    x0 = PAD + max(text_width(r.label, size) for r in rows) + 8
    plot_w = width - x0 - PAD - tail_width(rows, axis) - 6

    def at(value: float) -> float:
        return x0 + value / axis.maximum * plot_w

    group_h = len(series) * (bar_h + 1.5) - 1.5
    top = PAD + 28
    row_y, y = [], top
    for r in rows:
        y += gap if r.apart else 0
        row_y.append(y)
        y += group_h + gap
    bottom = row_y[-1] + group_h
    with_ci = any(e is not None and e.ci95 for r in rows for e in r.entries)
    parts = legend(series, PAD + 9, with_ci) if len(series) > 1 or with_ci else []
    for value, label in axis.ticks:
        line = AXIS if value == 0 else GRID
        parts += [
            f'<path d="M{at(value):.1f},{top - 5}V{bottom + 5}" stroke="{line}"/>',
            text(at(value), bottom + 17, label, 10, MUTED, "middle"),
        ]
    for r, y in zip(rows, row_y, strict=True):
        if r.apart:
            parts.append(f'<path d="M{PAD},{y - gap / 2:.1f}H{width - PAD}" stroke="{AXIS}"/>')
    if reference is not None:
        value, label = reference
        parts += [
            f'<path d="M{at(value):.1f},{top - 5}V{bottom + 5}" stroke="{INK}" '
            'stroke-dasharray="3 3"/>',
            text(at(value) - 4, top - 9, label, 10, INK, "end"),
        ]
    if right_header:  # beside the legend when the reference label has the line above the plot
        header_y = PAD + 9 if reference is not None else top - 9
        parts.append(text(width - PAD, header_y, right_header, 10, MUTED, "end"))
    for r, y in zip(rows, row_y, strict=True):
        middle = y + group_h / 2 + size * 0.35
        parts.append(text(x0 - 8, middle, r.label, size, INK, "end"))
        for j, ((name, color), e) in enumerate(zip(series, r.entries, strict=True)):
            if e is None:
                continue
            by, value_x = y + j * (bar_h + 1.5), at(e.value)
            tip = f"{r.label}, {name}: {e.label or axis.fmt(e.value)}"
            parts.append(bar(x0, by, at(e.value) - x0, bar_h, e.color or color, tip))
            if e.ci95:
                low, high = e.ci95
                parts.append(whisker(at(low), at(high), by + bar_h / 2, bar_h / 2 + 1))
                value_x = at(high)  # the value goes past the whisker, not across it
            if r.right is None:
                label = e.label or axis.fmt(e.value)
                parts.append(text(value_x + 4, by + bar_h / 2 + 3.5, label, 10, SOFT))
        if r.right is not None:
            parts.append(text(width - PAD, middle, r.right, size, SOFT, "end"))
    lines, end = note(sentence, bottom + 22.5, width)
    return document(width, end + PAD, title, parts + lines)
