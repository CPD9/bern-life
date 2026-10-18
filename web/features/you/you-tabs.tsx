"use client";

// WAI-ARIA tabs with a roving tabindex: Tab reaches the tab list once, the arrow keys (and Home,
// End) move between tabs, and selection follows focus because every panel is cheap to show.
import { type KeyboardEvent, type ReactNode, useRef } from "react";

export type YouTab<Id extends string> = {
  readonly id: Id;
  readonly label: string;
  readonly panel: ReactNode;
};

type YouTabsProps<Id extends string> = {
  tabs: readonly YouTab<Id>[];
  selected: Id;
  onSelect: (id: Id) => void;
  label: string;
};

const keyMoves: Readonly<Record<string, (index: number, count: number) => number>> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_, count) => count - 1,
};

export function YouTabs<Id extends string>({ tabs, selected, onSelect, label }: YouTabsProps<Id>) {
  const buttons = useRef(new Map<Id, HTMLButtonElement>());
  const active = tabs.find((tab) => tab.id === selected) ?? tabs[0];

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const move = keyMoves[event.key];
    if (!move || !active) return;
    event.preventDefault();
    const next = tabs[move(tabs.indexOf(active), tabs.length)];
    if (!next) return;
    onSelect(next.id);
    buttons.current.get(next.id)?.focus();
  }

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div
        role="tablist"
        aria-label={label}
        className="bg-chip rounded-pill grid grid-cols-5 gap-1 p-1"
      >
        {tabs.map((tab) => {
          const isSelected = tab.id === active?.id;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                if (element) buttons.current.set(tab.id, element);
                else buttons.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={`you-tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={isSelected ? `you-panel-${tab.id}` : undefined}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onSelect(tab.id)}
              onKeyDown={handleKeyDown}
              className={`rounded-pill px-1 py-1.5 text-xs font-bold sm:text-sm ${
                isSelected ? "bg-chip-selected text-chip-selected-ink" : "text-ink"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {active && (
        <div
          role="tabpanel"
          id={`you-panel-${active.id}`}
          aria-labelledby={`you-tab-${active.id}`}
          className="flex flex-col gap-3"
        >
          {active.panel}
        </div>
      )}
    </div>
  );
}
