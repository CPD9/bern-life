// What the Library keeps: only what the engine gave (a name, its page, the verbatim sentence), with
// the moment it was saved. Nothing here is written by the app.
import type { AppEventName } from "@/infrastructure/app-events";
import type { SearchResult } from "@/infrastructure/claims";
import type { Evidence } from "@/infrastructure/contract-types.generated";

export const itemKinds = ["profile", "page", "opportunity"] as const;

export type ItemKind = (typeof itemKinds)[number];

export type LibraryItem = {
  readonly kind: ItemKind;
  /** The profile id, or the page URL for a page. */
  readonly ref: string;
  readonly title: string;
  readonly source_url: string;
  readonly page_sha256?: string;
  /** Verbatim from the engine, never shortened or rewritten. */
  readonly span?: string;
  /** ISO 8601. */
  readonly saved_at: string;
};

const opportunityKinds = new Set(["call", "service", "space"]);

/** An item before it is saved; the save stamps the time. */
export type LibraryEntry = Omit<LibraryItem, "saved_at">;

/** A result as a profile or an opportunity, traced by its name and the sentence that names it. */
export function entryFromResult(result: SearchResult): LibraryEntry {
  const { profile } = result;
  return {
    kind: opportunityKinds.has(profile.kind) ? "opportunity" : "profile",
    ref: profile.id,
    title: profile.name.value,
    source_url: profile.source_url,
    page_sha256: profile.name.evidence.page_sha256,
    span: profile.name.evidence.span,
  };
}

/** A page, kept by the sentence it was opened at. Its title is the address, not a guess. */
export function entryFromEvidence(evidence: Evidence): LibraryEntry {
  const url = new URL(evidence.page_url);
  return {
    kind: "page",
    ref: evidence.page_url,
    title: `${url.host}${url.pathname === "/" ? "" : url.pathname}`,
    source_url: evidence.page_url,
    page_sha256: evidence.page_sha256,
    span: evidence.span,
  };
}

export function sameItem(a: LibraryEntry, b: LibraryEntry): boolean {
  return a.kind === b.kind && a.ref === b.ref;
}

/** Newest first; items saved in the same instant keep a stable order by ref. */
export function sortItems(items: readonly LibraryItem[]): LibraryItem[] {
  return [...items].sort((a, b) =>
    a.saved_at === b.saved_at
      ? a.ref.localeCompare(b.ref)
      : Date.parse(b.saved_at) - Date.parse(a.saved_at),
  );
}

/** Saving something already kept changes nothing: the first save and its time stay. */
export function addItem(items: readonly LibraryItem[], item: LibraryItem): LibraryItem[] {
  return items.some((kept) => sameItem(kept, item)) ? [...items] : sortItems([...items, item]);
}

export function removeItem(items: readonly LibraryItem[], item: LibraryItem): LibraryItem[] {
  return items.filter((kept) => !sameItem(kept, item));
}

/** The story events a save completes, for the host to emit. */
export function savedEventNames(item: LibraryItem): AppEventName[] {
  return item.kind === "opportunity"
    ? ["library_item_saved", "opportunity_saved"]
    : ["library_item_saved"];
}

function text(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

function isKind(value: unknown): value is ItemKind {
  return itemKinds.some((kind) => kind === value);
}

function parseItem(value: unknown): LibraryItem | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { kind, ref, title, source_url, page_sha256, span, saved_at } = value as Record<
    string,
    unknown
  >;
  if (!isKind(kind) || !text(ref) || !text(title) || !text(source_url)) return null;
  if (!text(saved_at) || Number.isNaN(Date.parse(saved_at))) return null;
  if (page_sha256 !== undefined && !text(page_sha256)) return null;
  if (span !== undefined && !text(span)) return null;
  return {
    kind,
    ref,
    title,
    source_url,
    ...(page_sha256 === undefined ? {} : { page_sha256 }),
    ...(span === undefined ? {} : { span }),
    saved_at,
  };
}

/** Items that no longer parse are dropped, not repaired; duplicates keep their first copy. */
export function parseItems(value: unknown): LibraryItem[] {
  if (!Array.isArray(value)) return [];
  const parsed = value.map(parseItem).filter((item) => item !== null);
  return sortItems(parsed.reduce<LibraryItem[]>(addItem, []));
}
