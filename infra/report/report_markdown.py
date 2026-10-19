"""The Markdown the report uses, turned into HTML: headings, paragraphs, emphasis, inline code,
links, figures (alone or in a row), tables, lists, block quotes, rules and fenced code.

Adapted from CPD9/apertus-redteam-graph track_1a/scripts/report_markdown.py (d1a1fc2,
Apache-2.0); the conversion is unchanged, and HTML comments (the note on how to check the
report's numbers) are dropped.
"""

import re
import textwrap
from html import escape

HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
RULE = re.compile(r"^\s*([-*_])(\s*\1){2,}\s*$")
ITEM = re.compile(r"^(\s*)(?:([-*+])|(\d+)[.)])\s+(.*)$")
TABLE_RULE = re.compile(r"^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$")
CODE_SPAN = re.compile(r"`([^`]+)`")
# A caption may cite a source in brackets, as in "Gap per language, see [2]".
IMAGE = re.compile(r"!\[((?:[^\[\]]|\[[^\[\]]*\])*)\]\(([^)\s]+)\)(?:\{width=(\d+)%\})?")
LINK = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")
BOLD = re.compile(r"\*\*(.+?)\*\*")
ITALIC = re.compile(r"(?<![\w*])([*_])(?![\s*_])(.+?)(?<![\s*_])\1(?![\w*])")
STASHED = re.compile("\x00(\\d+)\x00")
BREAK = "\x01"  # marks a hard line break until the inline markup is done
REFERENCES = re.compile(r"(\d+\.?\s+)?references", re.IGNORECASE)
COMMENT = re.compile(r"<!--.*?-->[ \t]*\n?", re.DOTALL)


def is_references(title: str) -> bool:
    return bool(REFERENCES.fullmatch(title.strip()))


def inline(text: str, stash: list[str] | None = None) -> str:
    """Inline markup. Code, images and links are rendered first and parked in the stash, so the
    escaping and emphasis rules below never touch their contents."""
    stash = [] if stash is None else stash

    def keep(html: str) -> str:
        stash.append(html)
        return f"\x00{len(stash) - 1}\x00"

    text = CODE_SPAN.sub(lambda m: keep(f"<code>{escape(m[1])}</code>"), text)
    text = IMAGE.sub(lambda m: keep(f'<img src="{escape(m[2])}" alt="{escape(m[1])}">'), text)
    text = LINK.sub(lambda m: keep(f'<a href="{escape(m[2])}">{inline(m[1], stash)}</a>'), text)
    text = ITALIC.sub(r"<em>\2</em>", BOLD.sub(r"<strong>\1</strong>", escape(text)))
    while STASHED.search(text):  # a link label can itself hold stashed code
        text = STASHED.sub(lambda m: stash[int(m[1])], text)
    return text.replace(BREAK, "<br>")


def figure(m: re.Match[str], in_row: bool) -> str:
    """An image captioned with its alt text. {width=40%} sets its width, or its share of a row;
    on its own it also lifts the stylesheet's usual maximum, so a wide chart can span the page."""
    style = ""
    if m[3]:
        own = f"width: {m[3]}%; max-width: {m[3]}%"
        style = f' style="flex: 0 1 {m[3]}%"' if in_row else f' style="{own}"'
    caption = f"<figcaption>{inline(m[1])}</figcaption>" if m[1] else ""
    alt = escape(re.sub(r"[*_`]", "", m[1]))
    return f'<figure{style}><img src="{escape(m[2])}" alt="{alt}">{caption}</figure>'


def hard_break(line: str) -> str:
    return line.rstrip(" \\") + BREAK if line.endswith(("  ", "\\")) else line


def paragraph(lines: list[str], i: int) -> tuple[str, int]:
    """A paragraph, or a figure when it holds only an image, or a row of figures for several."""
    start, i = i, i + 1
    while i < len(lines) and lines[i].strip() and not starts_block(lines, i):
        i += 1
    text = "\n".join(hard_break(line) for line in lines[start:i]).rstrip(BREAK)
    images = list(IMAGE.finditer(text))
    if images and not IMAGE.sub("", text).replace(BREAK, "").strip():
        figures = "".join(figure(m, len(images) > 1) for m in images)
        return (f'<div class="figrow">{figures}</div>' if len(images) > 1 else figures), i
    return f"<p>{inline(text)}</p>", i


def fenced(lines: list[str], i: int) -> tuple[str, int]:
    language = lines[i].strip("`").strip()
    end = next((j for j in range(i + 1, len(lines)) if lines[j].startswith("```")), len(lines))
    attr = f' class="language-{escape(language)}"' if language else ""
    code = escape("\n".join(lines[i + 1 : end]))
    return f"<pre><code{attr}>{code}</code></pre>", end + 1


def heading(lines: list[str], i: int) -> tuple[str, int]:
    m = HEADING.match(lines[i])
    assert m is not None
    level, title = len(m[1]), m[2]
    anchor = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    if is_references(title):
        anchor = "references"  # the stylesheet sets everything after it in smaller type
    return f'<h{level} id="{anchor}">{inline(title)}</h{level}>', i + 1


def quote(lines: list[str], i: int) -> tuple[str, int]:
    start = i
    while i < len(lines) and lines[i].startswith(">"):
        i += 1
    inner = "\n".join(re.sub(r"^> ?", "", line) for line in lines[start:i])
    return f"<blockquote>{convert(inner)}</blockquote>", i


def cells(line: str) -> list[str]:
    return [c.strip() for c in line.strip().strip("|").split("|")]


def table(lines: list[str], i: int) -> tuple[str, int]:
    align = [
        ("center" if c.startswith(":") else "right") if c.endswith(":") else None
        for c in cells(lines[i + 1])
    ]

    def style(k: int) -> str:
        return f' style="text-align: {align[k]}"' if k < len(align) and align[k] else ""

    head = "".join(f"<th{style(k)}>{inline(c)}</th>" for k, c in enumerate(cells(lines[i])))
    body, i = [], i + 2
    while i < len(lines) and "|" in lines[i] and lines[i].strip():
        row = "".join(f"<td{style(k)}>{inline(c)}</td>" for k, c in enumerate(cells(lines[i])))
        body.append(f"<tr>{row}</tr>")
        i += 1
    return f"<table><thead><tr>{head}</tr></thead><tbody>{''.join(body)}</tbody></table>", i


def list_block(lines: list[str], i: int) -> tuple[str, int]:
    first = ITEM.match(lines[i])
    assert first is not None
    indent, ordered, items = first[1], bool(first[3]), []

    def starts_item(k: int) -> bool:
        m = ITEM.match(lines[k]) if k < len(lines) else None
        return m is not None and m[1] == indent and bool(m[3]) == ordered

    def continues(k: int) -> bool:
        """Indented content, a nested list, a lazy continuation line, or a blank line that is
        followed by more indented content of the same item."""
        if lines[k].strip():
            return lines[k].startswith(indent + " ") or not starts_block(lines, k)
        following = lines[k + 1] if k + 1 < len(lines) else ""
        return following.startswith(indent + "  ") and bool(following.strip())

    while i < len(lines):
        if starts_item(i):
            m = ITEM.match(lines[i])
            assert m is not None
            items.append([m[4]])
        elif continues(i):
            items[-1].append(lines[i])
        elif lines[i].strip() or not starts_item(i + 1):
            break
        i += 1
    tag = "ol" if ordered else "ul"
    start = f' start="{first[3]}"' if ordered and first[3] != "1" else ""
    inner = "".join(f"<li>{list_item(item)}</li>" for item in items)
    return f"<{tag}{start}>{inner}</{tag}>", i


def list_item(item: list[str]) -> str:
    """The item's opening lines as inline text, then nested lists, code or paragraphs as blocks."""

    def opens_block(line: str) -> bool:
        return not line.strip() or bool(ITEM.match(line)) or line.lstrip().startswith("```")

    split = next((k for k, line in enumerate(item) if k and opens_block(line)), len(item))
    text = " ".join(line.strip() for line in item[:split])
    rest = textwrap.dedent("\n".join(item[split:])).strip("\n")
    return inline(text) + (convert(rest) if rest else "")


def is_table(lines: list[str], i: int) -> bool:
    return "|" in lines[i] and i + 1 < len(lines) and bool(TABLE_RULE.match(lines[i + 1]))


def starts_block(lines: list[str], i: int) -> bool:
    line = lines[i]
    return (
        line.startswith(("```", ">"))
        or bool(HEADING.match(line) or RULE.match(line) or ITEM.match(line))
        or is_table(lines, i)
    )


def convert(markdown: str) -> str:
    lines, i, html = COMMENT.sub("", markdown).splitlines(), 0, []
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.startswith("```"):
            block, i = fenced(lines, i)
        elif HEADING.match(line):
            block, i = heading(lines, i)
        elif RULE.match(line):
            block, i = "<hr>", i + 1
        elif line.startswith(">"):
            block, i = quote(lines, i)
        elif is_table(lines, i):
            block, i = table(lines, i)
        elif ITEM.match(line):
            block, i = list_block(lines, i)
        else:
            block, i = paragraph(lines, i)
        html.append(block)
    return "\n".join(html)
