// A brief arrives as form data: either pasted `text` or a PDF `file`. The PDF is read in memory
// and dropped after its text is extracted; nothing is written anywhere. The text is normalised
// here, before the engine sees it, because the engine keeps a need only when its span is in the
// brief word for word: a word a PDF split over two lines with a hyphen must be one word again.

export const briefLimits = { maxBytes: 5 * 1024 * 1024, maxPages: 20, maxChars: 20_000 } as const;

export type BriefRejection =
  "empty" | "too_large" | "not_pdf" | "too_many_pages" | "unreadable" | "no_text" | "too_long";

export type PdfText = { readonly pages: number; readonly text: string | null };

/** Returns the page count, and the text only when the page count is within `maxPages`. */
export type ReadPdf = (bytes: Uint8Array, maxPages: number) => Promise<PdfText>;

export type BriefText = { ok: true; text: string } | { ok: false; reason: BriefRejection };

// Multipart boundaries, part headers and a pasted text field fit easily in this margin.
const formOverheadBytes = 64 * 1024;

/** True when the declared body is too big to hold a 5 MB PDF form, so it is refused unread. */
export function uploadTooLarge(headers: Headers): boolean {
  const declared = Number(headers.get("content-length"));
  return Number.isFinite(declared) && declared > briefLimits.maxBytes + formOverheadBytes;
}

// A letter, a hyphen and a line break, then the rest of the word: the hyphen a PDF added to break
// the word. A hyphen followed by a space or inside a line ("state-of-the-art") stays.
const hyphenatedLineBreak = /(\p{L})-\r?\n\s*(\p{L})/gu;

/** The brief as the engine matches it: split words joined, whitespace collapsed, trimmed. */
export function normaliseBriefText(text: string): string {
  return text.replace(hyphenatedLineBreak, "$1$2").replace(/\s+/g, " ").trim();
}

function accepted(raw: string, whenBlank: BriefRejection): BriefText {
  const text = normaliseBriefText(raw);
  if (text === "") return { ok: false, reason: whenBlank };
  if (text.length > briefLimits.maxChars) return { ok: false, reason: "too_long" };
  return { ok: true, text };
}

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
    // pdf.js takes over the buffer it is given and detaches it, so it gets its own copy.
    pdf = await readPdf(bytes.slice(), briefLimits.maxPages);
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  if (pdf.pages > briefLimits.maxPages) return { ok: false, reason: "too_many_pages" };
  return accepted(pdf.text ?? "", "no_text");
}

export async function readBriefText(form: FormData, readPdf: ReadPdf): Promise<BriefText> {
  const file = form.get("file");
  if (file instanceof File && file.size > 0) return textFromPdf(file, readPdf);
  const pasted = form.get("text");
  return accepted(typeof pasted === "string" ? pasted : "", "empty");
}
