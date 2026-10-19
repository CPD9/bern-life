// A PDF written object by object, as the file format describes it: a catalog, a page tree, one
// page with one uncompressed text stream each, and the standard Helvetica font. pdf.js reads it
// like any PDF, so a test can put exact text on exact pages without a binary fixture. The text is
// Latin-1 (the font's WinAnsi encoding), one byte per character, so object offsets are string
// offsets. Each line is shown with its own text operator, which a reader sees as one line.

const pageSize = "[0 0 595 842]";

function pdfString(line: string): string {
  return `(${line.replace(/[\\()]/g, (char) => `\\${char}`)})`;
}

function contentStream(lines: readonly string[]): string {
  const shown = lines
    .map((line, index) => `${index === 0 ? "" : "T* "}${pdfString(line)} Tj`)
    .join("\n");
  return `BT /F1 11 Tf 14 TL 72 770 Td\n${shown}\nET`;
}

function latin1(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(text, (char) => {
    const code = char.charCodeAt(0);
    if (code > 0xff) throw new Error(`not Latin-1: ${char}`);
    return code;
  });
}

/** A PDF with one page per entry, each entry the lines of text on that page. */
export function pdfWithPages(pages: readonly (readonly string[])[]): Uint8Array<ArrayBuffer> {
  const fontId = 3 + 2 * pages.length;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + 2 * i} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    ...pages.flatMap((lines, i) => {
      const stream = contentStream(lines);
      return [
        `<< /Type /Page /Parent 2 0 R /MediaBox ${pageSize} /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${4 + 2 * i} 0 R >>`,
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      ];
    }),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let file = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(file.length);
    file += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const startxref = file.length;
  const entries = [
    "0000000000 65535 f ",
    ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
  ];
  file += `xref\n0 ${objects.length + 1}\n${entries.join("\n")}\n`;
  file += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  return latin1(file);
}
