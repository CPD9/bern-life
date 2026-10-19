"use client";

// WAI-ARIA tabs with a roving tabindex: Tab reaches the tab list once, the arrow keys (and Home,
// End) move between tabs, and selection follows focus because every panel is cheap to show. The next
// Tab reaches the panel itself. Ids come from useId, so two tab sets on a page never share one.
import { type KeyboardEvent, type ReactNode, useId, useRef } from "react";

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
  const baseId = useId();
  const tabId = (id: Id) => `${baseId}-tab-${id}`;
  const panelId = (id: Id) => `${baseId}-panel-${id}`;
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
              id={tabId(tab.id)}
              aria-selected={isSelected}
              aria-controls={isSelected ? panelId(tab.id) : undefined}
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
          id={panelId(active.id)}
          aria-labelledby={tabId(active.id)}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the WAI-ARIA tabs pattern: Tab from the tab list reaches the panel, even one with no control in it
          tabIndex={0}
          className="flex flex-col gap-3"
        >
          {active.panel}
        </div>
      )}
    </div>
  );
}
