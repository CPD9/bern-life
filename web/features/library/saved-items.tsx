import { useId } from "react";
import type { ItemKind, LibraryItem } from "./library-items";

const savedFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Europe/Zurich",
});

export const sectionCopy: Record<ItemKind, { heading: string; empty: string }> = {
  profile: {
    heading: "Profiles",
    empty: "No saved profiles yet. Save one with “Save to library” under a search result.",
  },
  page: {
    heading: "Pages",
    empty: "No saved pages yet. A page you save is listed here with the sentence you kept.",
  },
  opportunity: {
    heading: "Opportunities",
    empty: "No saved opportunities yet. Save one with “Save to library” in Opportunities.",
  },
};

function pageLabel(pageUrl: string): string {
  try {
    const url = new URL(pageUrl);
    return `${url.host}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return pageUrl;
  }
}

function SavedItem({ item, onRemove }: { item: LibraryItem; onRemove: () => void }) {
  return (
    <li className="bg-chip flex flex-col gap-2 rounded-2xl p-4 text-sm">
      <p className="text-base font-extrabold">{item.title}</p>
      {item.span !== undefined && (
        <blockquote className="text-ink">
          <mark className="bg-mark text-ink rounded px-0.5">“{item.span}”</mark>
        </blockquote>
      )}
      <p className="text-muted">
        On{" "}
        <a
          href={item.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink break-all underline"
        >
          {pageLabel(item.source_url)}
        </a>
        , saved {savedFormat.format(new Date(item.saved_at))}.
      </p>
      {item.page_sha256 !== undefined && (
        <p className="text-muted font-mono text-xs break-all">Page sha256 {item.page_sha256}</p>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.title}`}
        className="text-primary self-start font-bold underline"
      >
        Remove
      </button>
    </li>
  );
}

type SavedSectionProps = {
  kind: ItemKind;
  items: readonly LibraryItem[];
  onRemove: (item: LibraryItem) => void;
};

export function SavedSection({ kind, items, onRemove }: SavedSectionProps) {
  const id = useId();
  const { heading, empty } = sectionCopy[kind];
  const kept = items.filter((item) => item.kind === kind);
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="text-lg font-extrabold">
        {heading}
      </h3>
      {kept.length === 0 ? (
        <p className="text-muted">{empty}</p>
      ) : (
        <ul aria-label={`Saved ${heading.toLowerCase()}`} className="flex flex-col gap-3">
          {kept.map((item) => (
            <SavedItem key={item.ref} item={item} onRemove={() => onRemove(item)} />
          ))}
        </ul>
      )}
    </section>
  );
}
