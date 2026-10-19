"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type SearchResponse } from "@/infrastructure/contract-types.generated";
import { type Building } from "./buildings";
import { type CameraCommand } from "./camera-moves";
import { BUILDINGS, CITY } from "./city-layout";
import { useWorldDisplay } from "./display";
import { type Door, HOME_DOOR_KEY } from "./doors";
import { type MapPoint } from "./geography";
import { lightUp } from "./light";
import { type CameraHandle } from "./map-camera";
import { markerAnchors, PlaceMarkers } from "./markers/place-markers";
import { PlacePanel } from "./place-panel";
import { agentAnchor, AgentButton, type MapAgent } from "./scene/agents";
import { MapScene } from "./scene/map-scene";
import { SearchSummary } from "./search-summary";
import { useMapKeys } from "./use-map-keys";
import { useWalk } from "./use-walk";
import { WalkControls } from "./walk-controls";
import { feetOn } from "./walk-map";
import { walkWorld } from "./walk-world";
import { useWorldSearch, worldSearch } from "./world-search";

const MARKER_ANCHORS = markerAnchors(BUILDINGS);

export type MapPlayer = {
  /** Your figure, feet on y = 0 and facing +z, walking or standing still as asked. */
  readonly figure: (lite: boolean, walking: boolean) => ReactNode;
  /** Your office plot; before you settle there is none and you arrive at the station. */
  readonly home: MapPoint | null;
  /** In your office: coming out puts you at your door. */
  readonly inside: boolean;
};

export type WorldCanvasProps = {
  /** The player's first agent, walking beside them. */
  agent: MapAgent;
  player: MapPlayer;
  /** A tap, Enter or Space on the agent. */
  onAgentOpen: () => void;
  onSearchHere?: (building: Building) => void;
  /** Told whether a place's panel is open, so what floats over the map can keep clear of it. */
  onPlacePanel?: (open: boolean) => void;
  /** Going in through your own office door. */
  onGoHome?: () => void;
  /** Shown lit at load: the world fixture, passed only when the app runs with DEMO_FIXTURES=1. */
  demoSearch?: SearchResponse | undefined;
};

const KEYS = {
  map: "Arrow keys or W A S D pan, Q and E turn, plus and minus zoom. Tab reaches each place.",
  walk: "Arrow keys or W A S D walk, Q and E turn, plus and minus zoom; a click on the ground walks there and Escape stops. Tab reaches each place.",
} as const;

// The map: its canvas (scene/map-scene.tsx), transparent so the shell's sky shows through, and over
// it the place markers, your agent's label, the walking controls and a place's panel.
export function WorldCanvas({
  agent,
  player,
  onAgentOpen,
  onPlacePanel,
  ...props
}: WorldCanvasProps) {
  const display = useWorldDisplay();
  const cameraRef = useRef<CameraHandle | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorsRef = useRef(new Map<string, HTMLElement>());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [lobby, setLobby] = useState(false);
  const selected = BUILDINGS.find((building) => building.key === selectedKey) ?? null;
  const search = useWorldSearch();
  const response = search.status === "results" ? search.response : null;
  const lighting = useMemo(
    () => (response === null ? null : lightUp(response, BUILDINGS)),
    [response],
  );
  const fixture = response?.versions.snapshot === "fixture";
  const panelOpen = selected !== null;
  const world = useMemo(() => walkWorld(CITY, BUILDINGS, player.home), [player.home]);

  useEffect(() => {
    if (props.demoSearch !== undefined) worldSearch.showResults(props.demoSearch);
  }, [props.demoSearch]);

  useEffect(() => onPlacePanel?.(panelOpen), [panelOpen, onPlacePanel]);

  const framePoints = useMemo(
    () =>
      lighting === null
        ? []
        : BUILDINGS.filter((building) => lighting.byBuilding.has(building.key)).map(
            (building): MapPoint => [building.x, building.z],
          ),
    [lighting],
  );
  const walk = useWalk({
    map: world.map,
    start: world.start,
    inside: player.inside,
    doors: world.doors,
    framePoints,
  });
  const { session, stop, goTo } = walk;
  const agentAt = useMemo(
    () => feetOn(world.map, () => session.current.agent.at),
    [session, world.map],
  );
  const anchors = useMemo(() => [...MARKER_ANCHORS, agentAnchor(agentAt)], [agentAt]);

  // Leaving a place gives focus back to its door while you stand there, else to its marker.
  const closePanel = useCallback(() => {
    setSelectedKey(null);
    setLobby(false);
    if (selectedKey === null) return;
    const key = CSS.escape(selectedKey);
    const container = containerRef.current;
    const opener =
      container?.querySelector<HTMLButtonElement>(`[data-door="${key}"]`) ??
      container?.querySelector<HTMLButtonElement>(`[data-building="${key}"]`);
    opener?.focus();
  }, [selectedKey]);
  const onEscape = useCallback(() => {
    closePanel();
    stop();
  }, [closePanel, stop]);
  const runCamera = useCallback((command: CameraCommand) => cameraRef.current?.run(command), []);
  const selectBuilding = useCallback((key: string) => {
    setSelectedKey(key);
    setLobby(false);
    const building = BUILDINGS.find((candidate) => candidate.key === key);
    if (building !== undefined) cameraRef.current?.focus(building.x, building.z);
  }, []);
  useMapKeys({ containerRef, onCommand: runCamera, onEscape, walk: walk.keys });

  function enter(door: Door) {
    if (door.kind === "home") {
      props.onGoHome?.();
      return;
    }
    // Going in ends a walk that was passing the door.
    stop();
    setSelectedKey(door.key);
    setLobby(true);
  }

  function walkToDoor(key: string) {
    const door = world.doors.find((candidate) => candidate.key === key);
    if (door !== undefined) goTo(door.at);
  }

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Map of Bern"
      aria-describedby="map-keys"
      // Your office covers the map; nothing under it is reached by Tab or the keys meanwhile.
      inert={player.inside}
      className="relative isolate size-full"
    >
      <p id="map-keys" className="sr-only">
        {walk.walking ? KEYS.walk : KEYS.map}
      </p>
      <MapScene
        display={display}
        world={world}
        home={player.home}
        walk={walk}
        lighting={lighting}
        framePoints={framePoints}
        anchors={anchors}
        anchorsRef={anchorsRef}
        cameraRef={cameraRef}
        person={player.figure}
        agent={agent.figure}
      />
      {/* Its own stacking layer, so marker depth order never lifts a marker over the panel. */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden *:pointer-events-auto">
        <PlaceMarkers
          buildings={BUILDINGS}
          selectedKey={selectedKey}
          onSelect={selectBuilding}
          elementsRef={anchorsRef}
          searching={search.status === "searching"}
          lighting={lighting}
        />
        <AgentButton name={agent.name} onOpen={onAgentOpen} elementsRef={anchorsRef} />
      </div>
      <SearchSummary state={search} lighting={lighting} onClear={worldSearch.clear} />
      <WalkControls
        walking={walk.walking}
        onToggleWalking={walk.toggleWalking}
        following={walk.following}
        onToggleFollowing={walk.toggleFollowing}
        door={walk.door}
        onEnter={enter}
        onWalkHome={player.home === null ? undefined : () => walkToDoor(HOME_DOOR_KEY)}
      />
      {selected !== null && (
        <PlacePanel
          building={selected}
          light={lighting?.byBuilding.get(selected.key)}
          fixture={fixture}
          lobby={lobby}
          onClose={closePanel}
          onSearchHere={props.onSearchHere}
          onWalkHere={
            walk.walking
              ? (building) => {
                  closePanel();
                  walkToDoor(building.key);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
