"use client";

import { type ReactNode, useState } from "react";
import { Hud } from "./hud";
import { TabBar } from "./tab-bar";
import { type ShellTab } from "./tabs";

type GameShellProps = {
  canvas: ReactNode;
};

// The world fills the whole screen; HUD and tab bar float above it. Their wrappers ignore the
// pointer so drags on the empty sky beside a panel still reach the canvas.
export function GameShell({ canvas }: GameShellProps) {
  const [tab, setTab] = useState<ShellTab>("home");

  return (
    <div
      data-view={tab}
      className="from-sky-top to-sky-bottom fixed inset-0 overflow-hidden bg-linear-to-b"
    >
      <main aria-label="World" className="absolute inset-0">
        {canvas}
      </main>
      <header className="pointer-events-none absolute inset-x-0 top-0 flex justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto">
          <Hud />
        </div>
      </header>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto">
          <TabBar selected={tab} onSelect={setTab} />
        </div>
      </div>
    </div>
  );
}
