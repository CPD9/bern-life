// A brief arrives as form data: either pasted `text` or a PDF `file`. The PDF is read in memory
// and dropped after its text is extracted; nothing is written anywhere.

export const briefLimits = { maxBytes: 5 * 1024 * 1024, maxPages: 20 } as const;

export type BriefRejection =
  "empty" | "too_large" | "not_pdf" | "too_many_pages" | "unreadable" | "no_text";

export type PdfText = { readonly pages: number; readonly text: string | null };

/** Returns the page count, and the text only when the page count is within `maxPages`. */
export type ReadPdf = (bytes: Uint8Array, maxPages: number) => Promise<PdfText>;

export type BriefText = { ok: true; text: string } | { ok: false; reason: BriefRejection };

const pdfMagic = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

function isPdf(bytes: Uint8Array): boolean {
  return pdfMagic.every((byte, index) => bytes[index] === byte);
}

async function textFromPdf(file: File, readPdf: ReadPdf): Promise<BriefText> {
  if (file.size > briefLimits.maxBytes) return { ok: false, reason: "too_large" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(bytes)) return { ok: false, reason: "not_pdf" };
  let pdf: PdfText;
  try {
    pdf = await readPdf(bytes, briefLimits.maxPages);
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  if (pdf.pages > briefLimits.maxPages) return { ok: false, reason: "too_many_pages" };
  const text = pdf.text?.trim() ?? "";
  return text === "" ? { ok: false, reason: "no_text" } : { ok: true, text };
}

export async function readBriefText(form: FormData, readPdf: ReadPdf): Promise<BriefText> {
  const file = form.get("file");
  if (file instanceof File && file.size > 0) return textFromPdf(file, readPdf);
  const pasted = form.get("text");
  const text = typeof pasted === "string" ? pasted.trim() : "";
  return text === "" ? { ok: false, reason: "empty" } : { ok: true, text };
}
