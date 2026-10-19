import type { ReactNode } from "react";
import { TabBar, type TabBadges } from "./tab-bar";
import type { ShellTab } from "./tabs";

export type WorldView = Exclude<ShellTab, "phone">;

type GameShellProps = {
  view: WorldView;
  phoneOpen: boolean;
  onSelectTab: (tab: ShellTab) => void;
  /** Counts on the tabs, such as unread messages on the Phone. */
  tabBadges?: TabBadges;
  hud: ReactNode;
  /** Cards that float at the side of the world, such as the story quest. */
  side: ReactNode;
  canvas: ReactNode;
  /** The player's agent floating at the side of the world, above the tab bar. */
  floatie?: ReactNode;
  overlay: ReactNode;
};

// The world fills the whole screen; HUD and tab bar float above it. Their wrappers ignore the
// pointer so drags on the empty sky beside a panel still reach the canvas.
export function GameShell({
  view,
  phoneOpen,
  onSelectTab,
  tabBadges = {},
  hud,
  side,
  canvas,
  floatie,
  overlay,
}: GameShellProps) {
  return (
    <div
      data-view={view}
      className="from-sky-top to-sky-bottom fixed inset-0 overflow-hidden bg-linear-to-b"
    >
      <main aria-label="World" className="absolute inset-0">
        {canvas}
      </main>
      <header className="pointer-events-none absolute inset-x-0 top-0 flex justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto">{hud}</div>
      </header>
      <div className="pointer-events-none absolute top-[calc(env(safe-area-inset-top)+10.5rem)] left-4 sm:top-[calc(env(safe-area-inset-top)+5.5rem)] flex flex-col items-start gap-3">
        <div className="pointer-events-auto flex flex-col items-start gap-3">{side}</div>
      </div>
      {floatie && (
        // Above the office's own buttons on a phone, beside them on a wider screen. On a phone's
        // map it would sit over the place panel, and the bear on the map opens the same chat.
        <div
          data-floatie
          className={`absolute right-3 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+9.5rem)] sm:bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4.5rem)] ${view === "map" ? "hidden sm:block" : ""}`}
        >
          {floatie}
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto">
          <TabBar selected={phoneOpen ? "phone" : view} onSelect={onSelectTab} badges={tabBadges} />
        </div>
      </div>
      {overlay}
    </div>
  );
}
