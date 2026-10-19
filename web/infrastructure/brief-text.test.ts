import { describe, expect, test } from "bun:test";
import { pdfWithPages } from "@/test/pdf-fixture";
import { type ReadPdf, normaliseBriefText, readBriefText, uploadTooLarge } from "./brief-text";
import { readPdf } from "./pdf-text";

const pdfBytes = new TextEncoder().encode("%PDF-1.7 invented");

function formWith(entries: Record<string, string | File>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) form.set(key, value);
  return form;
}

function pdfFile(bytes: Uint8Array<ArrayBuffer> = pdfBytes): File {
  return new File([bytes], "brief.pdf", { type: "application/pdf" });
}

const readsPages =
  (pages: number, text: string): ReadPdf =>
  async (_bytes, maxPages) => ({ pages, text: pages > maxPages ? null : text });

const neverCalled: ReadPdf = async () => {
  throw new Error("readPdf must not be called");
};

// An invented company; the text of a brief as a PDF breaks it: a word split over two lines with
// a hyphen, a second page, and an umlaut the font encodes in one byte.
const briefPages = [
  [
    "Beispiel Sensorik AG (an invented company) builds a night-time alarm for people",
    "with type 1 diabetes who live alone. We need partners for continuous glu-",
    "cose monitoring and for detecting sleep (and movement) at night.",
  ],
  ["We also need to test the device with older patients in Bärn.", "See our website."],
] as const;
const briefText =
  "Beispiel Sensorik AG (an invented company) builds a night-time alarm for people with type 1 " +
  "diabetes who live alone. We need partners for continuous glucose monitoring and for " +
  "detecting sleep (and movement) at night. We also need to test the device with older " +
  "patients in Bärn. See our website.";

describe("normaliseBriefText", () => {
  test("joins a word split over a line break with a hyphen and keeps every other hyphen", () => {
    expect(normaliseBriefText("continuous glu-\ncose and lac-\r\n  tate")).toBe(
      "continuous glucose and lactate",
    );
    expect(normaliseBriefText("state-of-the-art, two- and three-dimensional, COVID-\n19")).toBe(
      "state-of-the-art, two- and three-dimensional, COVID- 19",
    );
  });

  test("collapses runs of whitespace, line breaks included, and trims", () => {
    expect(normaliseBriefText("  We need\n\n  a partner.  \t")).toBe("We need a partner.");
  });
});

describe("readBriefText", () => {
  test("pasted text is normalised and passed on", async () => {
    const pasted = "  We need continuous glu-\ncose  monitoring. ";
    expect(await readBriefText(formWith({ text: pasted }), neverCalled)).toEqual({
      ok: true,
      text: "We need continuous glucose monitoring.",
    });
  });

  test("nothing given is rejected as empty", async () => {
    expect(await readBriefText(formWith({ text: "   " }), neverCalled)).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  test("text over 20,000 characters is refused, pasted or from a PDF; whitespace does not count", async () => {
    const atLimit = "x".repeat(20_000);
    expect(await readBriefText(formWith({ text: `${atLimit}  \n ` }), neverCalled)).toEqual({
      ok: true,
      text: atLimit,
    });
    expect(await readBriefText(formWith({ text: `${atLimit}y` }), neverCalled)).toEqual({
      ok: false,
      reason: "too_long",
    });
    const longPdf = readsPages(2, `${atLimit} y`);
    expect(await readBriefText(formWith({ file: pdfFile() }), longPdf)).toEqual({
      ok: false,
      reason: "too_long",
    });
  });

  test("a PDF within limits gives its normalised text", async () => {
    const read = readsPages(20, " Wearable glu-\ncose sensor. ");
    expect(await readBriefText(formWith({ file: pdfFile() }), read)).toEqual({
      ok: true,
      text: "Wearable glucose sensor.",
    });
  });

  test("a PDF over 5 MB is rejected before it is parsed", async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(pdfBytes);
    expect(await readBriefText(formWith({ file: pdfFile(big) }), neverCalled)).toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  test("a file that is not a PDF is rejected", async () => {
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "brief.pdf");
    expect(await readBriefText(formWith({ file: png }), neverCalled)).toEqual({
      ok: false,
      reason: "not_pdf",
    });
  });

  test("a PDF over 20 pages is rejected", async () => {
    expect(await readBriefText(formWith({ file: pdfFile() }), readsPages(21, "text"))).toEqual({
      ok: false,
      reason: "too_many_pages",
    });
  });

  test("a PDF with no text, or one that fails to parse, is rejected", async () => {
    expect(await readBriefText(formWith({ file: pdfFile() }), readsPages(3, " "))).toEqual({
      ok: false,
      reason: "no_text",
    });
    const broken: ReadPdf = async () => {
      throw new Error("bad xref");
    };
    expect(await readBriefText(formWith({ file: pdfFile() }), broken)).toEqual({
      ok: false,
      reason: "unreadable",
    });
  });
});

describe("a real PDF through readPdf", () => {
  test("two pages come back as their lines, then as one normalised text", async () => {
    expect(await readPdf(pdfWithPages(briefPages), 20)).toEqual({
      pages: 2,
      text: [...briefPages[0], ...briefPages[1]].join("\n"),
    });
    expect(
      await readBriefText(formWith({ file: pdfFile(pdfWithPages(briefPages)) }), readPdf),
    ).toEqual({ ok: true, text: briefText });
  });

  test("a 21-page PDF is counted and refused without reading its text", async () => {
    const pages = Array.from({ length: 21 }, (_, i) => [`Page ${i + 1}`]);
    expect(await readPdf(pdfWithPages(pages), 20)).toEqual({ pages: 21, text: null });
    expect(await readBriefText(formWith({ file: pdfFile(pdfWithPages(pages)) }), readPdf)).toEqual({
      ok: false,
      reason: "too_many_pages",
    });
  });

  test("the reader takes over the bytes it is given, which is why the upload is copied first", async () => {
    const bytes = pdfWithPages([["One line."]]);
    expect(await readPdf(bytes, 20)).toEqual({ pages: 1, text: "One line." });
    expect(bytes.byteLength).toBe(0);
  });
});

describe("uploadTooLarge", () => {
  const withLength = (value: string) => new Headers({ "content-length": value });
  const limit = 5 * 1024 * 1024 + 64 * 1024;

  test("refuses a declared body over 5 MB plus the form margin", () => {
    expect(uploadTooLarge(withLength(String(limit)))).toBe(false);
    expect(uploadTooLarge(withLength(String(limit + 1)))).toBe(true);
  });

  test("a missing or unreadable header is left to the file-size check", () => {
    expect(uploadTooLarge(new Headers())).toBe(false);
    expect(uploadTooLarge(withLength("lots"))).toBe(false);
  });
});
