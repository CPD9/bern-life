"use client";

import { Canvas } from "@react-three/fiber";
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type SearchResponse } from "@/infrastructure/contract-types.generated";
import { ContextLossWatch, SceneGuard } from "@/infrastructure/ui/scene-guard";
import { type Building, groupPlacesByBuilding } from "./buildings";
import { type CameraCommand } from "./camera-moves";
import { liteTrees, planCity } from "./city-plan";
import { useWorldDisplay } from "./display";
import { AARE_PATH, DISTRICTS, MAP_BOUNDS, type MapPoint, RATHAUSPLATZ, ROADS } from "./geography";
import { lightUp } from "./light";
import { type CameraHandle, MapCamera } from "./map-camera";
import { AnchorProjector } from "./markers/anchor-projector";
import { markerAnchors, PlaceMarkers } from "./markers/place-markers";
import { NoMapCard } from "./no-map-card";
import { paletteFor } from "./palette";
import { PlacePanel } from "./place-panel";
import { PLACES } from "./places";
import { AGENT_ANCHOR, AgentButton, AgentFigure, type MapAgent } from "./scene/agents";
import { City } from "./scene/city";
import { Ground } from "./scene/ground";
import { Lights } from "./scene/lights";
import { PlaceBuildings } from "./scene/place-buildings";
import { SearchSummary } from "./search-summary";
import { useMapKeys } from "./use-map-keys";
import { useWorldSearch, worldSearch } from "./world-search";

const BUILDINGS = groupPlacesByBuilding(PLACES);
/** The square in front of the city hall stays open for the agent. */
const CITY = planCity({
  districts: DISTRICTS,
  river: AARE_PATH,
  roads: ROADS,
  sites: [...BUILDINGS.map((building): [number, number] => [building.x, building.z]), RATHAUSPLATZ],
  bounds: MAP_BOUNDS,
  seed: 1291,
});
const ANCHORS = [...markerAnchors(BUILDINGS), AGENT_ANCHOR];

export type WorldCanvasProps = {
  /** The player's first agent, standing in front of the city hall. */
  agent: MapAgent;
  /** A tap, Enter or Space on the agent. */
  onAgentOpen: () => void;
  onSearchHere?: (building: Building) => void;
  /** Told whether a place's panel is open, so what floats over the map can keep clear of it. */
  onPlacePanel?: (open: boolean) => void;
  /** Shown lit at load: the world fixture, passed only when the app runs with DEMO_FIXTURES=1. */
  demoSearch?: SearchResponse | undefined;
  /** The ways in that need no 3D, offered when the browser cannot draw the map. */
  onOpenAsk: () => void;
  onOpenDesk: () => void;
  /** True while the office covers the map, so the map's card leaves focus alone. */
  covered?: boolean;
};

// Without WebGL, or when the scene throws or loses its context for good, a card stands where the
// map was and the rest of the app carries on. The map's region takes focus back after a retry.
export function WorldCanvas({ onOpenAsk, onOpenDesk, covered, ...map }: WorldCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <SceneGuard
      focusAfterRetry={containerRef}
      fallback={(retry) => (
        <NoMapCard
          onOpenAsk={onOpenAsk}
          onOpenDesk={onOpenDesk}
          onRetry={retry}
          covered={covered === true}
        />
      )}
    >
      <WorldMap {...map} containerRef={containerRef} />
    </SceneGuard>
  );
}

type WorldMapProps = Omit<WorldCanvasProps, "onOpenAsk" | "onOpenDesk" | "covered"> & {
  containerRef: RefObject<HTMLDivElement | null>;
};

// Transparent so the shell's sky shows through; "demand" renders only when something changes.
function WorldMap({
  agent,
  onAgentOpen,
  onSearchHere,
  onPlacePanel,
  demoSearch,
  containerRef,
}: WorldMapProps) {
  const display = useWorldDisplay();
  const palette = paletteFor(display.night);
  const shadows = !display.lite;
  const cameraRef = useRef<CameraHandle | null>(null);
  const anchorsRef = useRef(new Map<string, HTMLElement>());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = BUILDINGS.find((building) => building.key === selectedKey) ?? null;
  const search = useWorldSearch();
  const response = search.status === "results" ? search.response : null;
  const lighting = useMemo(
    () => (response === null ? null : lightUp(response, BUILDINGS)),
    [response],
  );
  const fixture = response?.versions.snapshot === "fixture";
  const panelOpen = selected !== null;

  useEffect(() => {
    if (demoSearch !== undefined) worldSearch.showResults(demoSearch);
  }, [demoSearch]);

  useEffect(() => onPlacePanel?.(panelOpen), [panelOpen, onPlacePanel]);
  // A map that gives way to its card takes an open panel with it.
  useEffect(() => () => onPlacePanel?.(false), [onPlacePanel]);

  const framePoints = useMemo(
    () =>
      lighting === null
        ? []
        : BUILDINGS.filter((building) => lighting.byBuilding.has(building.key)).map(
            (building): MapPoint => [building.x, building.z],
          ),
    [lighting],
  );

  const closePanel = useCallback(() => {
    setSelectedKey(null);
    if (selectedKey === null) return;
    containerRef.current
      ?.querySelector<HTMLButtonElement>(`[data-building="${CSS.escape(selectedKey)}"]`)
      ?.focus();
  }, [containerRef, selectedKey]);
  const runCamera = useCallback((command: CameraCommand) => cameraRef.current?.run(command), []);
  const selectBuilding = useCallback((key: string) => {
    setSelectedKey(key);
    const building = BUILDINGS.find((candidate) => candidate.key === key);
    if (building !== undefined) cameraRef.current?.focus(building.x, building.z);
  }, []);
  useMapKeys({ containerRef, onCommand: runCamera, onEscape: closePanel });

  return (
    <div
      ref={containerRef}
      role="region"
      tabIndex={-1}
      aria-label="Map of Bern"
      aria-describedby="map-keys"
      className="relative isolate size-full"
    >
      <p id="map-keys" className="sr-only">
        Arrow keys or W A S D pan, Q and E turn, plus and minus zoom. Tab reaches each place.
      </p>
      {/* Shadows and pixel ratio are fixed when the renderer is created, so lite mode remounts it. */}
      <Canvas
        key={display.lite ? "lite" : "full"}
        frameloop="demand"
        shadows={shadows ? "percentage" : false}
        dpr={display.lite ? 1 : [1, 2]}
        gl={{ alpha: true }}
        camera={{ fov: 35, near: 1, far: 1200 }}
      >
        <ContextLossWatch />
        <Lights night={display.night} shadows={shadows} />
        <Ground palette={palette} shadows={shadows} />
        <City
          blocks={CITY.blocks}
          trees={display.lite ? liteTrees(CITY.trees) : CITY.trees}
          palette={palette}
          shadows={shadows}
        />
        <PlaceBuildings
          buildings={BUILDINGS}
          palette={palette}
          shadows={shadows}
          lighting={lighting}
        />
        <AgentFigure agent={agent} lite={display.lite} />
        <AnchorProjector anchors={ANCHORS} elementsRef={anchorsRef} />
        <MapCamera
          handleRef={cameraRef}
          reducedMotion={display.reducedMotion}
          framePoints={framePoints}
        />
      </Canvas>
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
      {selected !== null && (
        <PlacePanel
          building={selected}
          light={lighting?.byBuilding.get(selected.key)}
          fixture={fixture}
          onClose={closePanel}
          onSearchHere={onSearchHere}
        />
      )}
    </div>
  );
}
