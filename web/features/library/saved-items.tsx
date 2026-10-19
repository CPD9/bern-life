"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ItemKind, LibraryItem } from "./library-items";
import { SavedItem } from "./saved-item";

export const sectionCopy: Record<ItemKind, { heading: string; empty: string }> = {
  profile: { heading: "Profiles", empty: "No saved profiles yet." },
  page: { heading: "Pages", empty: "No saved pages yet." },
  opportunity: {
    heading: "Opportunities",
    empty: "No saved opportunities yet. Save one with “Save to library” in Opportunities.",
  },
};

type SavedSectionProps = {
  kind: ItemKind;
  items: readonly LibraryItem[];
  onRemove: (item: LibraryItem) => void;
};

/** Where focus goes once an item is gone: the next Remove, else the previous, else the heading. */
type FocusTarget = { ref: string } | "heading";

export function SavedSection({ kind, items, onRemove }: SavedSectionProps) {
  const id = useId();
  const { heading, empty } = sectionCopy[kind];
  const kept = items.filter((item) => item.kind === kind);
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusTarget = useRef<FocusTarget | null>(null);
  const [removed, setRemoved] = useState("");

  // Runs after the render that dropped the item, when the neighbour's button is in place.
  useEffect(() => {
    const wanted = focusTarget.current;
    if (wanted === null) return;
    focusTarget.current = null;
    const button = wanted === "heading" ? undefined : removeButtons.current.get(wanted.ref);
    (button ?? headingRef.current)?.focus();
  });

  function remove(index: number) {
    const item = kept[index];
    if (item === undefined) return;
    const neighbour = kept[index + 1] ?? kept[index - 1];
    focusTarget.current = neighbour === undefined ? "heading" : { ref: neighbour.ref };
    onRemove(item);
    setRemoved(`Removed ${item.title}`);
  }

  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} ref={headingRef} tabIndex={-1} className="text-lg font-extrabold">
        {heading}
      </h3>
      <p role="status" className="sr-only">
        {removed}
      </p>
      {kept.length === 0 ? (
        <p className="text-muted">{empty}</p>
      ) : (
        <ul aria-label={`Saved ${heading.toLowerCase()}`} className="flex flex-col gap-3">
          {kept.map((item, index) => (
            <SavedItem
              key={item.ref}
              item={item}
              onRemove={() => remove(index)}
              removeRef={(button) => {
                if (button === null) removeButtons.current.delete(item.ref);
                else removeButtons.current.set(item.ref, button);
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
