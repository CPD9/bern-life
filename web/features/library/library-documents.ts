// The player's uploaded documents, read from `GET /api/documents`. The shape is narrowed here
// rather than imported, because one feature does not reach into another; a document that does not
// parse is left out rather than shown half.
export type LibraryDocument = {
  id: string;
  fileName: string;
  sha256: string;
  size: number;
  pages: number;
  visibility: "private" | "members" | "public";
  createdAt: string;
  owner: { handle: string; displayName: string };
};

export type DocumentsOutcome =
  | { status: "ok"; documents: LibraryDocument[] }
  | { status: "signed-out" | "not-connected" | "failed" };

export type LibraryDocumentsApi = { list(): Promise<DocumentsOutcome> };

const visibilities = ["private", "members", "public"] as const;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseDocument(value: unknown): LibraryDocument | null {
  const fields = record(value);
  const owner = record(fields?.owner);
  if (fields === null || owner === null) return null;
  const { id, fileName, sha256, size, pages, visibility, createdAt } = fields;
  const { handle, displayName } = owner;
  const known = visibilities.find((v) => v === visibility);
  if (typeof id !== "string" || typeof fileName !== "string" || typeof sha256 !== "string") {
    return null;
  }
  if (!count(size) || !count(pages) || known === undefined) return null;
  if (typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt))) return null;
  if (typeof handle !== "string" || typeof displayName !== "string") return null;
  return {
    id,
    fileName,
    sha256,
    size,
    pages,
    visibility: known,
    createdAt,
    owner: { handle, displayName },
  };
}

export function parseDocuments(body: unknown): LibraryDocument[] | null {
  const list = record(body)?.documents;
  if (!Array.isArray(list)) return null;
  return list.map(parseDocument).filter((document) => document !== null);
}

export type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export function httpLibraryDocuments(fetcher: Fetcher): LibraryDocumentsApi {
  return {
    list: async () => {
      let response: Response;
      try {
        response = await fetcher("/api/documents", { headers: { accept: "application/json" } });
      } catch {
        return { status: "failed" };
      }
      if (response.status === 401) return { status: "signed-out" };
      if (response.status === 404) return { status: "not-connected" };
      const documents = response.ok
        ? parseDocuments(await response.json().catch(() => null))
        : null;
      return documents === null ? { status: "failed" } : { status: "ok", documents };
    },
  };
}
