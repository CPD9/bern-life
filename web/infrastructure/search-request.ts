import type { ProfileKind, SearchLang, SearchRequest } from "./engine-types";

export const maxQueryLength = 500;

const langs: readonly SearchLang[] = ["de", "en", "fr"];

const kinds: readonly ProfileKind[] = [
  "person",
  "unit",
  "project",
  "infrastructure",
  "call",
  "service",
  "space",
];

function isLang(value: unknown): value is SearchLang {
  return langs.some((lang) => lang === value);
}

function isKind(value: unknown): value is ProfileKind {
  return kinds.some((kind) => kind === value);
}

function parseKinds(value: unknown): readonly ProfileKind[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return value.every(isKind) ? value : null;
}

/** An absent field stays absent (undefined); a present one that does not parse is null. */
function optional<T>(value: unknown, parse: (value: unknown) => T | null): T | null | undefined {
  return value === undefined ? undefined : parse(value);
}

export function parseSearchRequest(body: unknown): SearchRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const fields = body as Record<string, unknown>;
  if (typeof fields.query !== "string") return null;
  const query = fields.query.trim();
  if (query === "" || query.length > maxQueryLength) return null;
  const lang = optional(fields.lang, (value) => (isLang(value) ? value : null));
  const searchKinds = optional(fields.kinds, parseKinds);
  if (lang === null || searchKinds === null) return null;
  return {
    query,
    ...(lang === undefined ? {} : { lang }),
    ...(searchKinds === undefined ? {} : { kinds: searchKinds }),
  };
}
