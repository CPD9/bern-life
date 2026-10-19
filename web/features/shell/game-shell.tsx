"use client";

import { type ReactNode, useLayoutEffect, useRef } from "react";
import { TabBar, type TabBadges } from "./tab-bar";
import type { ShellTab } from "./tabs";
import { type WatchHud, watchHud as watchHudSize } from "./watch-hud";

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
  /**
   * Hides the floatie while something on the world needs its corner, such as a place's panel.
   * Focus on the floatie then moves to the tab of the view on screen.
   */
  floatieHidden?: boolean;
  overlay: ReactNode;
  watchHud?: WatchHud;
};

// The world fills the whole screen; HUD and tab bar float above it. Their wrappers ignore the
// pointer so drags on the empty sky beside a panel still reach the canvas. On a phone the map's
// search summary and the side cards stack under the HUD's measured bottom, `--hud-bottom`.
export function GameShell({
  view,
  phoneOpen,
  onSelectTab,
  tabBadges = {},
  hud,
  side,
  canvas,
  floatie,
  floatieHidden = false,
  overlay,
  watchHud = watchHudSize,
}: GameShellProps) {
  const root = useRef<HTMLDivElement>(null);
  const hudSlot = useRef<HTMLDivElement>(null);
  const floatieSlot = useRef<HTMLDivElement>(null);
  const tabBar = useRef<HTMLDivElement>(null);

  // A hidden floatie cannot hold focus, so focus moves to the tab of the view on screen instead of
  // falling to the page. A layout effect, because a browser drops focus from a hidden element at
  // its next style update, after which there is no telling it was there.
  useLayoutEffect(() => {
    if (!floatieHidden || !floatieSlot.current?.contains(document.activeElement)) return;
    tabBar.current?.querySelector<HTMLElement>('[aria-current="true"]')?.focus();
  }, [floatieHidden]);

  // Written straight to the style, so a resize does not re-render the world.
  useLayoutEffect(() => {
    const hudElement = hudSlot.current;
    if (hudElement === null) return;
    return watchHud(hudElement, (bottom) =>
      root.current?.style.setProperty("--hud-bottom", `${bottom}px`),
    );
  }, [watchHud]);

  return (
    <div
      ref={root}
      data-view={view}
      className="from-sky-top to-sky-bottom fixed inset-0 overflow-hidden bg-linear-to-b"
    >
      <main aria-label="World" className="absolute inset-0">
        {canvas}
      </main>
      <header className="pointer-events-none absolute inset-x-0 top-0 flex justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div ref={hudSlot} className="pointer-events-auto">
          {hud}
        </div>
      </header>
      <div className="pointer-events-none absolute top-[calc(var(--hud-bottom,5.5rem)+5rem)] left-4 sm:top-[calc(env(safe-area-inset-top)+5.5rem)] flex flex-col items-start gap-3">
        <div className="pointer-events-auto flex flex-col items-start gap-3">{side}</div>
      </div>
      {floatie && (
        // Above the office's own buttons on a phone, beside them on a wider screen.
        <div
          ref={floatieSlot}
          hidden={floatieHidden}
          className="absolute right-3 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+9.5rem)] sm:bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4.5rem)]"
        >
          {floatie}
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div ref={tabBar} className="pointer-events-auto">
          <TabBar selected={phoneOpen ? "phone" : view} onSelect={onSelectTab} badges={tabBadges} />
        </div>
      </div>
      {overlay}
    </div>
  );
}
