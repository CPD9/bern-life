// The walking controls over the map, as real buttons, so the keyboard and screen readers reach all
// the mouse can: keys walk you or pan the map, the camera follows you or not, and at a door you
// can go in. Nothing goes in by itself; a polite live line says which door you stand at.

import { type Door } from "./doors";

type WalkControlsProps = {
  walking: boolean;
  onToggleWalking: () => void;
  following: boolean;
  onToggleFollowing: () => void;
  door: Door | null;
  onEnter: (door: Door) => void;
  /** Walks you to your office door; absent before you have an office. */
  onWalkHome: (() => void) | undefined;
};

const TOGGLE =
  "rounded-pill bg-chip aria-pressed:bg-chip-selected aria-pressed:text-chip-selected-ink px-3 py-1.5 text-sm font-bold";

export function doorAction(door: Door): string {
  return door.kind === "home" ? "Go home" : `Enter ${door.name}`;
}

function doorNotice(door: Door | null): string {
  if (door === null) return "";
  return door.kind === "home" ? "At your office door" : `At the door of ${door.name}`;
}

export function WalkControls({
  walking,
  onToggleWalking,
  following,
  onToggleFollowing,
  door,
  onEnter,
  onWalkHome,
}: WalkControlsProps) {
  return (
    <div
      role="group"
      aria-label="Walking"
      className="bg-panel shadow-panel rounded-panel absolute bottom-[calc(6rem+env(safe-area-inset-bottom))] left-3 z-10 flex max-w-[calc(100%-6.5rem)] flex-wrap items-center gap-2 p-2 sm:left-4 sm:max-w-[calc(100%-2rem)]"
    >
      <button type="button" aria-pressed={walking} onClick={onToggleWalking} className={TOGGLE}>
        Walk
      </button>
      {walking && (
        <button
          type="button"
          aria-pressed={following}
          onClick={onToggleFollowing}
          className={TOGGLE}
        >
          Follow
        </button>
      )}
      {walking && onWalkHome !== undefined && door?.kind !== "home" && (
        <button type="button" onClick={onWalkHome} className="bg-chip rounded-pill px-3 py-1.5 text-sm font-bold">
          Walk home
        </button>
      )}
      {door !== null && (
        <button
          type="button"
          data-door={door.key}
          onClick={() => onEnter(door)}
          className="bg-primary text-primary-ink rounded-pill max-w-64 truncate px-4 py-1.5 text-sm font-extrabold"
        >
          {doorAction(door)}
        </button>
      )}
      <p aria-live="polite" className="sr-only">
        {doorNotice(door)}
      </p>
    </div>
  );
}
