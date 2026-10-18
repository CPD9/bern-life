"use client";

import { useId, useState } from "react";
import { criterionRows } from "./criteria";
import type { StoryController } from "./use-story";

// On a phone the checklist would cover the map, so below `sm` it is a short count that opens the
// list; from `sm` up the list always shows and the toggle is hidden.
export function CriteriaChecklist({ controller }: { controller: StoryController }) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const rows = criterionRows(controller.progress);
  const count = `${rows.filter((row) => row.met).length} of ${rows.length} met`;
  return (
    <section
      aria-label="Case criteria"
      className="bg-panel shadow-panel border-panel-border flex w-fit max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-3xl border px-4 py-2 sm:w-[min(17rem,calc(100vw-2rem))] sm:p-4"
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => setExpanded(!expanded)}
        className="text-sm font-extrabold sm:hidden"
      >
        Case: {count}
      </button>
      <h2 className="hidden text-sm font-extrabold sm:block">
        The case, met in the game <span className="text-muted font-bold">· {count}</span>
      </h2>
      <ul
        id={listId}
        className={`${expanded ? "flex" : "hidden"} flex-col gap-1.5 text-sm sm:flex`}
      >
        {rows.map(({ criterion, label, met, note }) => (
          <li key={criterion} className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${
                met ? "bg-primary text-primary-ink" : "border-panel-border border-2"
              }`}
            >
              {met ? "✓" : ""}
            </span>
            <span className={met ? "font-bold" : "text-muted"}>
              {label}
              <span className="sr-only">{met ? ": met" : ": not yet"}</span>
              {note && <span className="text-muted block text-xs font-normal">{note}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
