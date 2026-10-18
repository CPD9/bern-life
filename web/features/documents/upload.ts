// An upload arrives as form data: a PDF `file` and an optional `visibility`. It is checked in
// memory before anything is stored: the size, the "%PDF-" magic bytes, then a page count from
// actually parsing it.
import { createHash } from "node:crypto";
import { VISIBILITIES, type Visibility } from "./types";

export const documentLimits = { maxBytes: 10 * 1024 * 1024, fileNameMax: 255 } as const;

export type UploadRejection = "bad_request" | "empty" | "too_large" | "not_pdf" | "unreadable";

/** The page count of a PDF; throws when the bytes do not parse as one. */
export type CountPages = (bytes: Uint8Array) => Promise<number>;

export type Upload = {
  readonly fileName: string;
  readonly bytes: Uint8Array;
  readonly sha256: string;
  readonly size: number;
  readonly pages: number;
  readonly visibility: Visibility;
};

export type UploadResult = { ok: true; upload: Upload } | { ok: false; reason: UploadRejection };

// Multipart boundaries, part headers and the visibility field fit easily in this margin.
const formOverheadBytes = 64 * 1024;

/** True when the declared body is too big to hold a 10 MB PDF form, so it is refused unread. */
export function uploadTooLarge(headers: Headers): boolean {
  const declared = Number(headers.get("content-length"));
  return Number.isFinite(declared) && declared > documentLimits.maxBytes + formOverheadBytes;
}

const pdfMagic = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

function isPdf(bytes: Uint8Array): boolean {
  return pdfMagic.every((byte, index) => bytes[index] === byte);
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** The name as shown: no folders, no control characters, at most 255 characters. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).at(-1) ?? "";
  const printable = Array.from(base).filter((c) => c >= " " && c !== "\u007f");
  const clean = printable.slice(0, documentLimits.fileNameMax).join("").trim();
  return clean === "" ? "document.pdf" : clean;
}

function parseVisibility(value: FormDataEntryValue | null): Visibility | null {
  if (value === null) return "private";
  return VISIBILITIES.find((v) => v === value) ?? null;
}

export async function readUpload(form: FormData, countPages: CountPages): Promise<UploadResult> {
  const visibility = parseVisibility(form.get("visibility"));
  if (visibility === null) return { ok: false, reason: "bad_request" };
  const file = form.get("file");
  if (file === null || typeof file === "string" || file.size === 0) {
    return { ok: false, reason: "empty" };
  }
  if (file.size > documentLimits.maxBytes) return { ok: false, reason: "too_large" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(bytes)) return { ok: false, reason: "not_pdf" };
  let pages: number;
  try {
    // The PDF reader may take ownership of the buffer it is given, so it gets a copy.
    pages = await countPages(bytes.slice());
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  if (!Number.isInteger(pages) || pages < 1) return { ok: false, reason: "unreadable" };
  return {
    ok: true,
    upload: {
      fileName: cleanFileName(file.name),
      bytes,
      sha256: sha256Hex(bytes),
      size: bytes.byteLength,
      pages,
      visibility,
    },
  };
}
