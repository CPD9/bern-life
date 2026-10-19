import { CorrectionNote } from "@/infrastructure/ui/claim-evidence";
import type { LibraryItem } from "./library-items";

const savedFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Europe/Zurich",
});

function pageLabel(pageUrl: string): string {
  try {
    const url = new URL(pageUrl);
    return `${url.host}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return pageUrl;
  }
}

type SavedItemProps = {
  item: LibraryItem;
  onRemove: () => void;
  removeRef: (button: HTMLButtonElement | null) => void;
};

export function SavedItem({ item, onRemove, removeRef }: SavedItemProps) {
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
      {item.span !== undefined && <CorrectionNote quoted="saved" />}
      {item.page_sha256 !== undefined && (
        <p className="text-muted font-mono text-xs break-all">Page sha256 {item.page_sha256}</p>
      )}
      <button
        ref={removeRef}
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
