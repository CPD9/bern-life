// Request bodies and query parameters for /api/messages/*, parsed into exact shapes or refused.
import type { Notice } from "./types";

export const BODY_MAX = 4000;
export const PAGE_MAX = 50;
const TITLE_MAX = 80;
const GROUP_HANDLES_MAX = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HANDLE = /^[a-z0-9_]{3,20}$/;

export type Start =
  { kind: "direct"; handle: string } | { kind: "group"; title: string; handles: string[] };
export type Cursor = { at: Date; id: string };

export function isId(value: string): boolean {
  return UUID.test(value);
}

function handle(value: unknown): string | null {
  const lowered = typeof value === "string" ? value.trim().toLowerCase() : "";
  return HANDLE.test(lowered) ? lowered : null;
}

export function parseStart(body: unknown): Start | null {
  const fields = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (fields.kind === "direct") {
    const other = handle(fields.handle);
    return other === null ? null : { kind: "direct", handle: other };
  }
  if (fields.kind !== "group" || typeof fields.title !== "string" || !Array.isArray(fields.handles))
    return null;
  const title = fields.title.trim();
  const handles = [...new Set(fields.handles.map(handle))];
  const valid = handles.every((h): h is string => h !== null);
  if (
    !title ||
    title.length > TITLE_MAX ||
    !valid ||
    handles.length < 1 ||
    handles.length > GROUP_HANDLES_MAX
  ) {
    return null;
  }
  return { kind: "group", title, handles };
}

/** The text exactly as written, ends trimmed; refused when empty or over 4,000 characters. */
export function parseBody(body: unknown): string | null {
  const text = (body as { body?: unknown } | null)?.body;
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  return trimmed.length >= 1 && trimmed.length <= BODY_MAX ? trimmed : null;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.at.toISOString()}|${cursor.id}`).toString("base64url");
}

export function decodeCursor(value: string | null): Cursor | null | "invalid" {
  if (value === null || value === "") return null;
  const [at, id] = Buffer.from(value, "base64url").toString().split("|");
  if (at === undefined || id === undefined || !isId(id) || Number.isNaN(Date.parse(at)))
    return "invalid";
  return { at: new Date(at), id };
}

export function parseLimit(value: string | null): number | null {
  if (value === null || value === "") return PAGE_MAX;
  const limit = Number(value);
  return Number.isInteger(limit) && limit >= 1 && limit <= PAGE_MAX ? limit : null;
}

export function parseNotice(payload: string): Notice | null {
  try {
    const notice = JSON.parse(payload) as Partial<Notice>;
    const kindOk = notice.kind === "posted" || notice.kind === "deleted";
    if (kindOk && isId(notice.conversationId ?? "") && isId(notice.messageId ?? ""))
      return notice as Notice;
  } catch {
    // A payload we did not write is ignored.
  }
  return null;
}
