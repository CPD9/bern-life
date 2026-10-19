import { describe, expect, test } from "bun:test";
import { type LibraryDocument, httpLibraryDocuments, parseDocuments } from "./library-documents";

const document: LibraryDocument = {
  id: "doc-1",
  fileName: "demo-brief.pdf",
  sha256: "9f2c",
  size: 10,
  pages: 1,
  visibility: "private",
  createdAt: "2026-10-18T09:15:00.000Z",
  owner: { handle: "demo-mara", displayName: "Mara Demo" },
};
const good = { ...document, mine: true };

describe("httpLibraryDocuments", () => {
  test("reads the list and maps 401 to signed out and 404 to not connected", async () => {
    const answer = (response: Response) => httpLibraryDocuments(async () => response).list();
    expect(await answer(Response.json({ documents: [good] }))).toEqual({
      status: "ok",
      documents: [document],
    });
    expect(await answer(Response.json({ error: "unauthenticated" }, { status: 401 }))).toEqual({
      status: "signed-out",
    });
    expect(await answer(new Response("Not Found", { status: 404 }))).toEqual({
      status: "not-connected",
    });
    expect(await answer(new Response("oops", { status: 500 }))).toEqual({ status: "failed" });
  });

  test("asks for the list as JSON, and an unreachable server is a failure", async () => {
    const sent: [string, RequestInit][] = [];
    const api = httpLibraryDocuments(async (url, init) => {
      sent.push([url, init]);
      return Response.json({ documents: [] });
    });
    expect(await api.list()).toEqual({ status: "ok", documents: [] });
    expect(sent).toEqual([["/api/documents", { headers: { accept: "application/json" } }]]);
    const offline = httpLibraryDocuments(async () => {
      throw new TypeError("offline");
    });
    expect(await offline.list()).toEqual({ status: "failed" });
  });

  test("a document that does not parse is left out", () => {
    expect(
      parseDocuments({ documents: [{ ...good, size: -1 }, { ...good, visibility: "all" }, 3] }),
    ).toEqual([]);
    expect(parseDocuments({})).toBeNull();
  });
});
