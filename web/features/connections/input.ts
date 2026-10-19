// Request bodies for /api/connections, parsed into exact shapes or refused. A note is optional, at
// most 280 characters as written (the database checks the same), with line breaks allowed and no
// other control characters.
export const NOTE_MAX = 280;
const HANDLE = /^[a-z0-9_]{3,20}$/;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CONTROL_BUT_NEWLINE = /[^\P{Cc}\n]/u;

export type Ask = { handle: string; note: string | null };
export type Answer = "accept" | "decline" | "withdraw";

const ANSWERS: readonly Answer[] = ["accept", "decline", "withdraw"];

function fields(body: unknown): Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

function note(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/\r\n?/g, "\n").trim();
  if (trimmed.length > NOTE_MAX || CONTROL_BUT_NEWLINE.test(trimmed)) return undefined;
  return trimmed === "" ? null : trimmed;
}

export function parseAsk(body: unknown): Ask | null {
  const { handle, note: raw } = fields(body);
  const lowered = typeof handle === "string" ? handle.trim().toLowerCase() : "";
  const parsed = note(raw);
  if (!HANDLE.test(lowered) || parsed === undefined) return null;
  return { handle: lowered, note: parsed };
}

export function parseAnswer(body: unknown): Answer | null {
  const { answer } = fields(body);
  return ANSWERS.find((known) => known === answer) ?? null;
}

export function isRequestId(value: string): boolean {
  return ID.test(value);
}
