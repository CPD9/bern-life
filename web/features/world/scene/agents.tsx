// The three agents stand in the square in front of the city hall as a hint of what is coming.
// They are the only characters in the world: people found on public pages are never shown as
// figures, only as entries with their sources in a place's panel.

import { RATHAUSPLATZ } from "../geography";
import { type Anchor, type AnchorElements, registerAnchor } from "../markers/anchors";

export type AgentId = "navigator" | "scout" | "matchmaker";

const AGENTS: readonly { id: AgentId; name: string; colour: string; offset: number }[] = [
  { id: "navigator", name: "Navigator", colour: "#2fb36b", offset: -1.6 },
  { id: "scout", name: "Scout", colour: "#f2a93b", offset: 0 },
  { id: "matchmaker", name: "Matchmaker", colour: "#8f7ae6", offset: 1.6 },
];

const AGENTS_KEY = "agents";

export const AGENTS_ANCHOR: Anchor = {
  key: AGENTS_KEY,
  position: [RATHAUSPLATZ[0], 2.4, RATHAUSPLATZ[1]],
};

export function AgentFigures({ shadows }: { shadows: boolean }) {
  const [x, z] = RATHAUSPLATZ;
  return AGENTS.map((agent) => (
    <group key={agent.id} position={[x + agent.offset, 0, z]}>
      <mesh position-y={0.45} castShadow={shadows}>
        <capsuleGeometry args={[0.28, 0.5, 4, 10]} />
        <meshLambertMaterial color={agent.colour} />
      </mesh>
      <mesh position-y={1.12} castShadow={shadows}>
        <sphereGeometry args={[0.24, 12, 10]} />
        <meshLambertMaterial color="#f6e7d8" />
      </mesh>
    </group>
  ));
}

/** One row of buttons for the three figures, so their labels never overlap at any zoom. */
export function AgentButtons({
  onSelect,
  elementsRef,
}: {
  onSelect: ((id: AgentId) => void) | undefined;
  elementsRef: AnchorElements;
}) {
  return (
    <div
      ref={registerAnchor(elementsRef, AGENTS_KEY)}
      className="invisible absolute top-0 left-0 flex gap-1"
    >
      {AGENTS.map((agent) => (
        <button
          key={agent.id}
          type="button"
          data-agent={agent.id}
          aria-label={onSelect ? agent.name : `${agent.name}, coming soon`}
          title={onSelect ? agent.name : `${agent.name} · coming soon`}
          onClick={() => onSelect?.(agent.id)}
          className="rounded-pill bg-panel text-ink shadow-panel flex items-center gap-1.5 px-2 py-0.5 text-xs font-extrabold whitespace-nowrap"
        >
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ background: agent.colour }}
          />
          {agent.name}
        </button>
      ))}
    </div>
  );
}
