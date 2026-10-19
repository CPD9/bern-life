// Bärli, the player's first agent, walks beside you on the map wearing the bear the player made for
// it. You and your agent are the only figures in the world: people found on public pages are never
// shown as figures, only as entries with their sources in a place's panel. The bear is another
// feature, so app/ passes it in.

import { type ReactNode } from "react";
import { type Anchor, type AnchorElements, registerAnchor } from "../markers/anchors";

export type MapAgent = {
  /** The agent's name, Bärli until the player chooses another. */
  readonly name: string;
  /**
   * The agent's bear, feet on y = 0, facing +z and about 1.4 tall, drawn with lite graphics when
   * asked. It walks only while it follows you: the map renders on demand, so a figure that kept
   * moving at rest would redraw the whole city every frame.
   */
  readonly figure: (lite: boolean, walking: boolean) => ReactNode;
};

export const AGENT_KEY = "agent";
/** Above the bear's ears at the map's figure scale. */
const LABEL_HEIGHT = 2.9;

/**
 * The agent's label follows the agent: `where` gives its feet each frame, and the label's point is
 * one array filled again each time, not a new one per frame.
 */
export function agentAnchor(where: () => readonly [x: number, y: number, z: number]): Anchor {
  const label: [number, number, number] = [0, 0, 0];
  return {
    key: AGENT_KEY,
    get position(): readonly [number, number, number] {
      const feet = where();
      label[0] = feet[0];
      label[1] = feet[1] + LABEL_HEIGHT;
      label[2] = feet[2];
      return label;
    },
  };
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
