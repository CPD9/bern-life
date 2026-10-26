"""Turn the technical report from Markdown into an A4 PDF with headless Chrome.

    python3 -m infra.report.build_report [--md docs/report/technical_report.md]
                                         [--out docs/report/Bern-Life_Report.pdf]

Adapted from CPD9/apertus-redteam-graph track_1a/scripts/build_report.py (501db67, Apache-2.0).
The page limit and the body-only print are gone, because this report has none; the A4 page, the
fonts, the stylesheet and the rule that References is the last section stay, and a long table may
break between its rows with its header repeated. CHROME names the executable when it is not on
PATH or in the usual place on a Mac.
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from html import escape, unescape
from pathlib import Path
from urllib.parse import unquote, urlparse

from infra.report.report_markdown import HEADING, convert, is_references

ROOT = Path(__file__).resolve().parents[2]
CHROMES = (
    "google-chrome",
    "chromium",
    "chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
)

STYLE = """
:root { --sans: 'Helvetica Neue', Helvetica, Arial, sans-serif; --ink: #1f2430;
  --soft: #4b5260; --rule: #e6e4de; }
@page { size: A4; margin: 17mm 18mm 18mm;
  @bottom-center { content: counter(page); color: #868b94;
    font: 8pt 'Helvetica Neue', Helvetica, Arial, sans-serif; } }
html { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
body { margin: 0; color: var(--ink); text-align: justify; hyphens: auto;
  font: 10.5pt/1.42 Charter, 'Bitstream Charter', 'Iowan Old Style', Georgia, serif; }
h1, h2, h3, h4, figcaption, table, blockquote { font-family: var(--sans); text-align: left; }
h1, h2, h3, h4 { line-height: 1.2; break-after: avoid; }
h1 { font-size: 19pt; font-weight: 650; letter-spacing: -0.01em; margin: 0 0 3mm; }
h2 { font-size: 12.5pt; font-weight: 650; margin: 6mm 0 2mm; }
h3 { font-size: 10.5pt; font-weight: 650; margin: 4mm 0 1.5mm; }
h4 { font-size: 10pt; font-weight: 600; font-style: italic; margin: 3mm 0 1mm; }
p { margin: 0 0 2.4mm; orphans: 3; widows: 3; }
a { color: #1d4f91; text-decoration: none; }
strong { font-weight: 650; }
code { font: 8.8pt 'SF Mono', Menlo, Consolas, monospace; background: #f3f2ee;
  padding: 0.2mm 0.7mm; border-radius: 0.8mm; overflow-wrap: anywhere; hyphens: none; }
pre { background: #f6f5f1; border-radius: 1.5mm; padding: 2.5mm 3mm; margin: 0 0 3mm;
  white-space: pre-wrap; break-inside: avoid; text-align: left; }
pre code { background: none; padding: 0; font-size: 8.4pt; line-height: 1.4; }
li > pre { margin: 1mm 0 1.5mm; }
blockquote { margin: 0 0 4mm; padding: 1.5mm 0 1.5mm 4mm; border-left: 0.6mm solid #c8102e;
  font-size: 9.8pt; color: #333a46; break-inside: avoid; }
blockquote p:last-child { margin-bottom: 0; }
hr { border: 0; border-top: 0.3mm solid #d8d5cc; margin: 4mm 0; }
ul, ol { margin: 0 0 2.4mm; padding-left: 5.5mm; }
li { margin: 0 0 0.8mm; }
li > ul, li > ol { margin: 0.8mm 0 0; }
table { border-collapse: collapse; width: 100%; margin: 1mm 0 4mm; font-size: 8.6pt;
  line-height: 1.35; font-variant-numeric: tabular-nums; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th { font-weight: 600; padding: 1mm 2mm; border-top: 0.4mm solid var(--ink);
  border-bottom: 0.25mm solid var(--ink); }
td { padding: 1mm 2mm; border-bottom: 0.2mm solid var(--rule); vertical-align: top; }
tbody tr:last-child td { border-bottom: 0.4mm solid var(--ink); }
figure { margin: 2mm auto 4mm; max-width: 72%; break-inside: avoid; }
figure img { display: block; width: 100%; height: auto; max-height: 105mm; object-fit: contain; }
figcaption { font-size: 8.6pt; line-height: 1.35; color: var(--soft); margin-top: 1.5mm; }
.figrow { display: flex; gap: 6mm; align-items: flex-start; margin: 2mm 0 4mm;
  break-inside: avoid; }
.figrow figure { flex: 1 1 0; margin: 0; }
#references ~ * { font-size: 9pt; }
"""


def check_references_last(markdown: str) -> None:
    """References has to be the last section: the stylesheet sets everything after it small."""
    lines, in_code, seen, level = markdown.splitlines(), False, False, 0
    for line in lines:
        in_code ^= line.startswith("```")
        m = None if in_code else HEADING.match(line)
        if m and seen and len(m[1]) <= level:
            raise SystemExit(f"References must be the last section, but '{m[2]}' follows it")
        if m and is_references(m[2]):
            seen, level = True, len(m[1])


def document(markdown: str, base: Path) -> str:
    title = next((m[2] for m in map(HEADING.match, markdown.splitlines()) if m), "Report")
    return (
        f'<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
        f"<title>{escape(re.sub(r'[`*_]', '', title))}</title>"
        f'<base href="{base.as_uri()}/"><style>{STYLE}</style></head>\n'
        f"<body>\n{convert(markdown)}\n</body></html>\n"
    )


def missing_images(html: str, base: Path) -> list[str]:
    """Local images the page refers to that do not exist; Chrome would print a broken icon."""
    sources = [unescape(src) for src in re.findall(r'<img src="([^"]*)"', html)]
    return [
        src for src in sources if not urlparse(src).scheme and not (base / unquote(src)).is_file()
    ]


def chrome() -> str:
    for candidate in filter(None, (os.environ.get("CHROME"), *CHROMES)):
        if found := shutil.which(candidate):
            return found
    raise SystemExit("Chrome or Chromium not found; set CHROME to its executable")


def print_pdf(html: str, pdf_path: Path) -> int:
    with tempfile.TemporaryDirectory() as tmp:
        page = Path(tmp) / "report.html"
        page.write_text(html, encoding="utf-8")
        subprocess.run(
            [
                chrome(),
                "--headless=new",
                "--disable-gpu",
                "--no-pdf-header-footer",
                f"--user-data-dir={tmp}/profile",
                f"--print-to-pdf={pdf_path}",
                page.as_uri(),
            ],
            check=True,
            capture_output=True,
            timeout=180,
        )
    return count_pages(pdf_path.read_bytes())


def count_pages(pdf: bytes) -> int:
    return len(re.findall(rb"/Type\s*/Page\b", pdf))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Build the PDF report from Markdown.")
    ap.add_argument("--md", type=Path, default=ROOT / "docs/report/technical_report.md")
    ap.add_argument("--out", type=Path, default=ROOT / "docs/report/Bern-Life_Report.pdf")
    a = ap.parse_args(argv)
    markdown, base = a.md.read_text(encoding="utf-8"), a.md.resolve().parent
    check_references_last(markdown)
    html = document(markdown, base)
    if missing := missing_images(html, base):
        raise SystemExit(f"images not found next to {a.md}: {', '.join(missing)}")
    pages = print_pdf(html, a.out.resolve())
    print(f"{a.out}: {pages} pages, {a.out.stat().st_size:,} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
