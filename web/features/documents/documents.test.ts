import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Sql } from "@/infrastructure/db";
import { SKIPPED, emptyTables, openTestDb } from "@/infrastructure/test-database";
import { addDocument, removeDocument } from "./documents";
import { diskFiles } from "./files";
import { fileHeaders } from "./http";
import { countPdfPages } from "./pdf-pages";
import { documentsOf, visibleDocument } from "./store";
import type { DocumentView, Visibility } from "./types";
import {
  cleanFileName,
  documentLimits,
  readUpload,
  sha256Hex,
  type Upload,
  uploadTooLarge,
} from "./upload";

const SAMPLE = "%PDF-1.7 invented sample";
const SAMPLE_SHA256 = "370f1c45d2a16d1090b44763e1a71997269e90fc981a3f269409f97876d644bf";
const NOW = new Date("2026-10-18T22:00:00Z");

/** A valid PDF with `pages` empty pages, built by hand so the test needs no fixture file. */
function pdf(pages: number): Uint8Array<ArrayBuffer> {
  const kids = Array.from({ length: pages }, (_, i) => `${i + 3} 0 R`).join(" ");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`,
    ...Array.from(
      { length: pages },
      () => "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>",
    ),
  ];
  let out = "%PDF-1.4\n";
  const offsets = objects.map((body, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((at) => `${String(at).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

function form(
  bytes: Uint8Array<ArrayBuffer> | string,
  name = "lab-notes.pdf",
  visibility?: string,
): FormData {
  const data = new FormData();
  data.set("file", new File([bytes], name, { type: "application/pdf" }));
  if (visibility !== undefined) data.set("visibility", visibility);
  return data;
}

const onePage = async () => 1;

describe("readUpload", () => {
  test("a PDF is accepted with its exact sha256, size, pages and a private default", async () => {
    const read = await readUpload(form(SAMPLE, "C:\\docs\\Lab notes.pdf"), onePage);
    expect(read.ok && { ...read.upload, bytes: read.upload.bytes.length }).toEqual({
      fileName: "Lab notes.pdf",
      bytes: SAMPLE.length,
      sha256: SAMPLE_SHA256,
      size: SAMPLE.length,
      pages: 1,
      visibility: "private",
    });
  });

  test("a file that is not a PDF is refused, whatever its name or declared type", async () => {
    expect(await readUpload(form("GIF89a fake", "photo.pdf"), onePage)).toEqual({
      ok: false,
      reason: "not_pdf",
    });
  });

  test("a file over 10 MB is refused before it is parsed", async () => {
    let parsed = 0;
    const big = new Uint8Array(documentLimits.maxBytes + 1);
    big.set(new TextEncoder().encode("%PDF-1.7"));
    const read = await readUpload(form(big), async () => ++parsed);
    expect([read, parsed]).toEqual([{ ok: false, reason: "too_large" }, 0]);
    const declared = new Headers({ "content-length": String(documentLimits.maxBytes + 70_000) });
    expect(uploadTooLarge(declared)).toBe(true);
    expect(uploadTooLarge(new Headers({ "content-length": "5000" }))).toBe(false);
  });

  test("empty, unparsable, or with an unknown visibility, it is refused with the reason", async () => {
    const reasons = [
      await readUpload(new FormData(), onePage),
      await readUpload(form(SAMPLE), () => Promise.reject(new Error("broken xref"))),
      await readUpload(form(SAMPLE, "a.pdf", "friends"), onePage),
    ].map((read) => !read.ok && read.reason);
    expect(reasons).toEqual(["empty", "unreadable", "bad_request"]);
  });

  test("the page count comes from parsing the PDF", async () => {
    expect(await countPdfPages(pdf(3))).toBe(3);
    await expect(countPdfPages(new TextEncoder().encode("%PDF-1.7 not really"))).rejects.toThrow();
  });

  test("a file name keeps no folders or control characters", () => {
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
    expect(cleanFileName("report\u0000\n.pdf")).toBe("report.pdf");
    expect(cleanFileName("  ")).toBe("document.pdf");
    expect(cleanFileName(`${"ä".repeat(300)}.pdf`)).toBe("ä".repeat(255));
  });
});

describe("fileHeaders", () => {
  const doc = (visibility: Visibility): DocumentView => ({
    id: "11111111-1111-4111-8111-111111111111",
    fileName: "Lab's notes (v2).pdf",
    sha256: SAMPLE_SHA256,
    size: 24,
    pages: 1,
    visibility,
    createdAt: NOW.toISOString(),
    owner: { handle: "ada", displayName: "Ada" },
    mine: true,
  });

  test("inline, sandboxed, never sniffed; a private file is never stored by a cache", () => {
    expect(fileHeaders(doc("private"))).toEqual({
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename*=UTF-8''Lab%27s%20notes%20%28v2%29.pdf",
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    });
    expect(fileHeaders(doc("public"))["Cache-Control"]).toBe("public, max-age=300");
  });
});

const testDb = openTestDb();
if (testDb === null) test.skip(SKIPPED, () => {});

describe.skipIf(testDb === null)("documents against a throwaway database", () => {
  const sql = testDb as Sql;
  let dir = "";
  let ada = "";
  let bea = "";

  async function person(handle: string): Promise<string> {
    const [row] = await sql<{ id: string }[]>`insert into app_user (id, handle, display_name)
      values (gen_random_uuid(), ${handle}, ${handle.toUpperCase()}) returning id`;
    return (row as { id: string }).id;
  }

  function upload(visibility: Visibility, bytes = pdf(2)): Upload {
    return {
      fileName: "notes.pdf",
      bytes,
      sha256: sha256Hex(bytes),
      size: bytes.length,
      pages: 2,
      visibility,
    };
  }

  beforeEach(async () => {
    await emptyTables(sql);
    [ada, bea] = [await person("ada"), await person("bea")];
    if (dir !== "") await rm(dir, { recursive: true, force: true });
    dir = await mkdtemp(path.join(tmpdir(), "bernlife-uploads-"));
  });
  afterAll(async () => {
    await emptyTables(sql);
    await sql.end();
    await rm(dir, { recursive: true, force: true });
  });

  test("the stored file is named by its sha256, which matches its bytes", async () => {
    const bytes = pdf(2);
    const added = await addDocument(sql, diskFiles(dir), ada, upload("private", bytes), NOW);
    const onDisk = new Uint8Array(await readFile(path.join(dir, added.sha256)));
    expect([added.sha256, sha256Hex(onDisk), onDisk.length]).toEqual([
      sha256Hex(bytes),
      sha256Hex(bytes),
      bytes.length,
    ]);
    expect(await readdir(dir)).toEqual([added.sha256]);
    expect((await documentsOf(sql, ada)).map((d) => [d.fileName, d.pages, d.mine])).toEqual([
      ["notes.pdf", 2, true],
    ]);
  });

  test("another user cannot read a private file; members and public widen it", async () => {
    const files = diskFiles(dir);
    const add = async (v: Visibility, pages: number) =>
      (await addDocument(sql, files, ada, upload(v, pdf(pages)), NOW)).id;
    const [secret, shared, open] = [
      await add("private", 1),
      await add("members", 2),
      await add("public", 3),
    ];
    const sees = async (viewer: string | null) => {
      const seen = [];
      for (const id of [secret, shared, open])
        seen.push((await visibleDocument(sql, viewer, id)) !== null);
      return seen;
    };
    expect(await sees(ada)).toEqual([true, true, true]);
    expect(await sees(bea)).toEqual([false, true, true]);
    expect(await sees(null)).toEqual([false, false, true]);
    expect(await documentsOf(sql, bea)).toEqual([]);
    expect((await visibleDocument(sql, bea, open))?.mine).toBe(false);
  });

  test("delete removes the file and the row, only for the owner", async () => {
    const files = diskFiles(dir);
    const added = await addDocument(sql, files, ada, upload("public"), NOW);
    expect(await removeDocument(sql, files, bea, added.id)).toBe(false);
    expect(await readdir(dir)).toEqual([added.sha256]);
    expect(await removeDocument(sql, files, ada, added.id)).toBe(true);
    expect([await readdir(dir), await visibleDocument(sql, ada, added.id)]).toEqual([[], null]);
    const [rows] = await sql<{ n: number }[]>`select count(*)::int as n from document`;
    expect(rows?.n).toBe(0);
  });

  test("the same bytes are stored once, and the file stays until the last row goes", async () => {
    const files = diskFiles(dir);
    const bytes = pdf(1);
    const first = await addDocument(sql, files, ada, upload("private", bytes), NOW);
    const second = await addDocument(sql, files, bea, upload("private", bytes), NOW);
    expect(await readdir(dir)).toEqual([first.sha256]);
    await removeDocument(sql, files, ada, first.id);
    expect(await files.read(second.sha256)).toEqual(new Uint8Array(bytes));
    await removeDocument(sql, files, bea, second.id);
    expect(await readdir(dir)).toEqual([]);
  });

  test("the database refuses a document that is not a PDF or over the limit", async () => {
    const insert = (mime: string, size: number) =>
      sql`insert into document (id, owner_id, file_name, sha256, size, pages, mime)
          values (gen_random_uuid(), ${ada}, 'x.pdf', ${SAMPLE_SHA256}, ${size}, 1, ${mime})`.then(
        () => "stored",
        (error: { constraint_name?: string }) => error.constraint_name,
      );
    expect([
      await insert("text/html", 10),
      await insert("application/pdf", documentLimits.maxBytes + 1),
    ]).toEqual(["document_is_pdf", "document_size_limit"]);
  });
});
