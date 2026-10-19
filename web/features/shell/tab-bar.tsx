import { TabIcon } from "./tab-icon";
import { type ShellTab, shellTabLabels, shellTabs } from "./tabs";

/** Counts shown on a tab, such as unread messages on the Phone; null or 0 shows nothing. */
export type TabBadges = Partial<Record<ShellTab, number | null>>;

type TabBarProps = {
  selected: ShellTab;
  onSelect: (tab: ShellTab) => void;
  badges?: TabBadges;
};

export function TabBar({ selected, onSelect, badges = {} }: TabBarProps) {
  return (
    <nav
      aria-label="Main"
      className="rounded-pill bg-panel shadow-panel border-panel-border flex gap-1 border p-1.5"
    >
      {shellTabs.map((tab) => {
        const isSelected = tab === selected;
        const count = badges[tab] ?? 0;
        return (
          <button
            key={tab}
            type="button"
            aria-current={isSelected ? "true" : undefined}
            aria-label={count > 0 ? `${shellTabLabels[tab]}, ${count} unread` : undefined}
            onClick={() => onSelect(tab)}
            className={`rounded-pill relative flex min-h-14 w-20 flex-col items-center justify-center gap-0.5 text-sm font-semibold transition-colors sm:w-24 ${
              isSelected ? "bg-chip-selected text-chip-selected-ink" : "text-muted hover:bg-chip"
            }`}
          >
            <TabIcon tab={tab} />
            {shellTabLabels[tab]}
            {count > 0 && (
              <span
                aria-hidden="true"
                className="bg-primary text-primary-ink rounded-pill absolute top-1 right-3 min-w-5 px-1.5 text-xs leading-5 font-bold sm:right-5"
              >
                {count > 9 ? "9+" : count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
