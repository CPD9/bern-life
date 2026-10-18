// The documents routes' shared edges: error markers with their status codes, and how a file is
// served. A PDF is shown inline but sandboxed, so it cannot run script against the app, and it is
// never sniffed as another type; a private file is never cached.
import type { DocumentView, Visibility } from "./types";
import type { UploadRejection } from "./upload";

type Marker = UploadRejection | "unauthenticated" | "not_found";

const STATUS: Record<Marker, number> = {
  bad_request: 400,
  empty: 400,
  unauthenticated: 401,
  not_found: 404,
  too_large: 413,
  not_pdf: 415,
  unreadable: 422,
};

export function failure(marker: Marker): Response {
  return Response.json({ error: marker }, { status: STATUS[marker] });
}

export function done(): Response {
  return new Response(null, { status: 204 });
}

const CACHE: Record<Visibility, string> = {
  private: "no-store",
  members: "private, no-cache",
  public: "public, max-age=300",
};

// RFC 5987: the name travels percent-encoded, including the characters encodeURIComponent keeps.
function encodedName(name: string): string {
  return encodeURIComponent(name).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function fileHeaders(document: DocumentView): Record<string, string> {
  return {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename*=UTF-8''${encodedName(document.fileName)}`,
    "Content-Security-Policy": "sandbox",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": CACHE[document.visibility],
  };
}
