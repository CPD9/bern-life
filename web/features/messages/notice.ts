// Ids and live notices, parsed the same on the server and in the browser (no Node APIs here).
import type { Notice } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isId(value: string): boolean {
  return UUID.test(value);
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
