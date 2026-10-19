"use client";

// Bärnli floating beside the player once they are in Bern: the floatie with the agent's name under
// it, and a tap, Enter or Space opens Bärnli. In onboarding the same floatie moves its greeting on
// instead, so opening is this component's one job and app/ decides what it opens.

import { type ReactNode } from "react";
import { Floatie } from "./floatie";
import { type FloatieState } from "./floatie-motion";

type LumiFloatieProps = {
  /** The agent's name, which a player may change from Bärnli. */
  name: string;
  /** The agent's bear, as for `Floatie`. */
  figure: (reducedMotion: boolean) => ReactNode;
  onOpen: () => void;
  /** "listening" while Bärnli is open or working, so it reads as attending. */
  state?: FloatieState;
  lite?: boolean;
};

export function LumiFloatie({
  name,
  figure,
  onOpen,
  state = "idle",
  lite = false,
}: LumiFloatieProps) {
  return (
    <div className="flex w-28 flex-col items-center">
      <Floatie name={name} figure={figure} onSelect={onOpen} state={state} lite={lite} />
      {/* The name overlaps the bottom of the button, so taps go through it to the button. */}
      <span
        aria-hidden="true"
        className="rounded-pill bg-panel text-ink shadow-panel pointer-events-none -mt-3 max-w-full truncate px-2.5 py-0.5 text-xs font-extrabold"
      >
        {name}
      </span>
    </div>
  );
}
