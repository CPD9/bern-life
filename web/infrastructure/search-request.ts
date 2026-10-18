import type { SearchLang, SearchRequest } from "./engine-types";

export const maxQueryLength = 500;

const langs: readonly SearchLang[] = ["de", "en", "fr"];

function isLang(value: unknown): value is SearchLang {
  return langs.some((lang) => lang === value);
}

export function parseSearchRequest(body: unknown): SearchRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { query, lang } = body as Record<string, unknown>;
  if (typeof query !== "string") return null;
  const trimmed = query.trim();
  if (trimmed === "" || trimmed.length > maxQueryLength) return null;
  if (lang === undefined) return { query: trimmed };
  return isLang(lang) ? { query: trimmed, lang } : null;
}
