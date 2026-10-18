import { TabIcon } from "./tab-icon";
import { type ShellTab, shellTabLabels, shellTabs } from "./tabs";

type TabBarProps = {
  selected: ShellTab;
  onSelect: (tab: ShellTab) => void;
};

export function TabBar({ selected, onSelect }: TabBarProps) {
  return (
    <nav
      aria-label="Main"
      className="rounded-pill bg-panel shadow-panel border-panel-border flex gap-1 border p-1.5"
    >
      {shellTabs.map((tab) => {
        const isSelected = tab === selected;
        return (
          <button
            key={tab}
            type="button"
            aria-current={isSelected ? "true" : undefined}
            onClick={() => onSelect(tab)}
            className={`rounded-pill flex min-h-14 w-20 flex-col items-center justify-center gap-0.5 text-sm font-semibold transition-colors sm:w-24 ${
              isSelected ? "bg-chip-selected text-chip-selected-ink" : "text-muted hover:bg-chip"
            }`}
          >
            <TabIcon tab={tab} />
            {shellTabLabels[tab]}
          </button>
        );
      })}
    </nav>
  );
}
