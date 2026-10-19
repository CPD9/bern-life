// Lumi, the player's first agent, stands in the square in front of the city hall wearing the bear
// the player made for it. It is the only figure in the world: people found on public pages are
// never shown as figures, only as entries with their sources in a place's panel. The bear is
// another feature, so app/ passes it in.

import { type ReactNode } from "react";
import { RATHAUSPLATZ } from "../geography";
import { type Anchor, type AnchorElements, registerAnchor } from "../markers/anchors";

export type MapAgent = {
  /** The agent's name, Lumi until the player chooses another. */
  readonly name: string;
  /**
   * The agent's bear, feet on y = 0, facing +z and about 1.4 tall, drawn with lite graphics when
   * asked. It should stand still: the map renders only on demand, so a figure that keeps moving
   * would redraw the whole city every frame, and standing still is what reduced motion asks for.
   */
  readonly figure: (lite: boolean) => ReactNode;
};

/** Large enough to pick out at the default zoom, where one unit is about 20 m. */
const FIGURE_SCALE = 1.6;
/** Turned a little towards the default camera. */
const FIGURE_TURN = 0.5;

const AGENT_KEY = "agent";

export const AGENT_ANCHOR: Anchor = {
  key: AGENT_KEY,
  position: [RATHAUSPLATZ[0], 2.9, RATHAUSPLATZ[1]],
};

export function AgentFigure({ agent, lite }: { agent: MapAgent; lite: boolean }) {
  const [x, z] = RATHAUSPLATZ;
  return (
    <group position={[x, 0, z]} rotation-y={FIGURE_TURN} scale={FIGURE_SCALE}>
      {agent.figure(lite)}
    </group>
  );
}

/** The agent's name above its figure, as a page button so a tap, Enter or Space opens it. */
export function AgentButton({
  name,
  onOpen,
  elementsRef,
}: {
  name: string;
  onOpen: () => void;
  elementsRef: AnchorElements;
}) {
  return (
    <button
      ref={registerAnchor(elementsRef, AGENT_KEY)}
      type="button"
      aria-label={`${name}, your agent`}
      title={`${name}, your agent`}
      onClick={onOpen}
      className="rounded-pill bg-panel text-ink shadow-panel invisible absolute top-0 left-0 flex items-center gap-1.5 px-2.5 py-1 text-xs font-extrabold whitespace-nowrap"
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-[#e0a526]" />
      {name}
    </button>
  );
}
