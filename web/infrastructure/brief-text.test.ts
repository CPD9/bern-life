import { describe, expect, test } from "bun:test";
import { type ReadPdf, readBriefText, uploadTooLarge } from "./brief-text";

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

describe("readBriefText", () => {
  test("pasted text is trimmed and passed on", async () => {
    expect(await readBriefText(formWith({ text: "  We need a partner.  " }), neverCalled)).toEqual({
      ok: true,
      text: "We need a partner.",
    });
  });

  test("nothing given is rejected as empty", async () => {
    expect(await readBriefText(formWith({ text: "   " }), neverCalled)).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  test("a PDF within limits gives its text", async () => {
    const read = readsPages(20, " Wearable glucose sensor. ");
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
