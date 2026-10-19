"use client";

import { type LibraryEntry, type LibraryItem, sameItem } from "./library-items";
import { type LibraryStore, browserLibrary } from "./library-store";
import { useLibraryItems } from "./use-library";

export type SaveButtonProps = {
  /** From `entryFromResult` or `entryFromEvidence`: what the engine gave, nothing added. */
  entry: LibraryEntry;
  /** Called once, when the item is new to the Library. */
  onSaved?: (item: LibraryItem) => void;
  store?: LibraryStore;
  now?: () => Date;
};

/** Stays focusable once saved, so a keyboard user hears "Saved" where they pressed. */
export function SaveButton({
  entry,
  onSaved,
  store = browserLibrary(),
  now = () => new Date(),
}: SaveButtonProps) {
  const saved = useLibraryItems(store).some((kept) => sameItem(kept, entry));

  function save() {
    if (saved) return;
    const item: LibraryItem = { ...entry, saved_at: now().toISOString() };
    if (store.save(item)) onSaved?.(item);
  }

  return (
    <button
      type="button"
      onClick={save}
      aria-disabled={saved}
      aria-label={`${saved ? "Saved" : "Save to library"}: ${entry.title}`}
      className={`rounded-pill px-4 py-1.5 text-sm font-bold ${
        saved ? "bg-chip text-muted cursor-default" : "bg-chip-selected text-chip-selected-ink"
      }`}
    >
      {saved ? "Saved" : "Save to library"}
    </button>
  );
}
