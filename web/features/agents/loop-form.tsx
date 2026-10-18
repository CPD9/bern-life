"use client";

import { type FormEvent, useId, useState } from "react";
import { maxQueryLength } from "@/infrastructure/search-request";
import { type Kind, allKinds, kindLabels } from "./kinds";
import type { SaveOutcome } from "./use-loops";

const outcomeText: Record<SaveOutcome, string> = {
  saved: "Saved. Run it now to set the first results.",
  exists: "This loop is already saved.",
  invalid: "Type a search first.",
};

export function LoopForm({
  onSave,
}: {
  onSave: (query: string, kinds: readonly Kind[]) => SaveOutcome;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [kinds, setKinds] = useState<readonly Kind[]>([]);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const saved = onSave(query, kinds);
    setOutcome(saved);
    if (saved === "saved") {
      setQuery("");
      setKinds([]);
    }
  }

  function toggle(kind: Kind, on: boolean) {
    setKinds((current) => (on ? [...current, kind] : current.filter((k) => k !== kind)));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor={`${id}-query`} className="font-extrabold">
        Search to keep
      </label>
      <div className="flex gap-2">
        <input
          id={`${id}-query`}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={maxQueryLength}
          placeholder="continuous glucose monitoring"
          className="bg-chip rounded-pill placeholder:text-muted min-w-0 flex-1 px-5 py-2.5"
        />
        <button
          type="submit"
          className="bg-primary text-primary-ink rounded-pill px-5 py-2.5 font-bold"
        >
          Save loop
        </button>
      </div>
      <fieldset className="flex flex-wrap items-center gap-1.5">
        <legend className="text-muted mb-1.5 text-sm">Only these kinds (none ticked: all)</legend>
        {allKinds.map((kind) => (
          <label
            key={kind}
            className="rounded-pill bg-chip has-checked:bg-chip-selected has-checked:text-chip-selected-ink has-focus-visible:outline-focus cursor-pointer px-3 py-1 text-sm font-bold has-focus-visible:outline-3"
          >
            <input
              type="checkbox"
              checked={kinds.includes(kind)}
              onChange={(event) => toggle(kind, event.target.checked)}
              className="sr-only"
            />
            {kindLabels[kind]}
          </label>
        ))}
      </fieldset>
      <p role="status" className="text-muted min-h-5 text-sm">
        {outcome === null ? "" : outcomeText[outcome]}
      </p>
    </form>
  );
}
