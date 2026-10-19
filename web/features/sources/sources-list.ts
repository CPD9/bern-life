// The shape of GET /api/sources, typed here until the generated `SourcesList` type lands with the
// contract. Hosts become links, so each must look like a host name (the pattern of
// contracts/source.schema.json); a body with anything else is no answer.

export type SourceSummary = {
  readonly id: string;
  readonly name: string;
  readonly hosts: readonly string[];
  readonly kinds: readonly string[];
  readonly pages: number;
  readonly profiles: number;
  /** null when no page of this source is in the snapshot. */
  readonly newest_fetched_at: string | null;
};

export type SourcesList = { readonly snapshot: string; readonly sources: readonly SourceSummary[] };

type Fields = Record<string, unknown>;

const HOST = /^[a-z0-9.-]+$/;

function fields(value: unknown): Fields | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Fields)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function texts(value: unknown, pattern?: RegExp): string[] | null {
  if (!Array.isArray(value)) return null;
  const all = value.map(text);
  return all.every((entry): entry is string => entry !== null && (!pattern || pattern.test(entry)))
    ? all
    : null;
}

function fetchedAt(value: unknown): string | null | undefined {
  if (value === null) return null;
  const date = text(value);
  return date !== null && !Number.isNaN(Date.parse(date)) ? date : undefined;
}

function source(value: unknown): SourceSummary | null {
  const body = fields(value);
  if (!body) return null;
  const [id, name] = [text(body.id), text(body.name)];
  const [hosts, kinds] = [texts(body.hosts, HOST), texts(body.kinds)];
  const [pages, profiles] = [count(body.pages), count(body.profiles)];
  const newest = fetchedAt(body.newest_fetched_at);
  if (id === null || name === null || hosts === null || kinds === null) return null;
  if (pages === null || profiles === null || newest === undefined) return null;
  return { id, name, hosts, kinds, pages, profiles, newest_fetched_at: newest };
}

export function parseSourcesList(body: unknown): SourcesList | null {
  const top = fields(body);
  const snapshot = text(top?.snapshot);
  if (!top || snapshot === null || !Array.isArray(top.sources)) return null;
  const sources = top.sources.map(source);
  return sources.every((entry): entry is SourceSummary => entry !== null)
    ? { snapshot, sources }
    : null;
}

/** The public site root of a host; the only link a source row offers. */
export function siteRoot(host: string): string {
  return `https://${host}/`;
}

const fetchedFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Zurich",
});

export function formatFetchedDate(iso: string): string {
  return fetchedFormat.format(new Date(iso));
}
