"use client";

import { Canvas } from "@react-three/fiber";
import { useCallback, useRef } from "react";
import { groupPlacesByBuilding } from "./buildings";
import { type CameraCommand } from "./camera-moves";
import { liteTrees, planCity } from "./city-plan";
import { useWorldDisplay } from "./display";
import { AARE_PATH, DISTRICTS, MAP_BOUNDS, RATHAUSPLATZ, ROADS } from "./geography";
import { type CameraHandle, MapCamera } from "./map-camera";
import { paletteFor } from "./palette";
import { PLACES } from "./places";
import { City } from "./scene/city";
import { Ground } from "./scene/ground";
import { Lights } from "./scene/lights";
import { PlaceBuildings } from "./scene/place-buildings";
import { useMapKeys } from "./use-map-keys";

const BUILDINGS = groupPlacesByBuilding(PLACES);
/** The square in front of the city hall stays open for the agents. */
const CITY = planCity({
  districts: DISTRICTS,
  river: AARE_PATH,
  roads: ROADS,
  sites: [...BUILDINGS.map((building): [number, number] => [building.x, building.z]), RATHAUSPLATZ],
  bounds: MAP_BOUNDS,
  seed: 1291,
});

// Transparent so the shell's sky shows through; "demand" renders only when something changes.
export function WorldCanvas() {
  const display = useWorldDisplay();
  const palette = paletteFor(display.night);
  const shadows = !display.lite;
  const cameraRef = useRef<CameraHandle | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const runCamera = useCallback((command: CameraCommand) => cameraRef.current?.run(command), []);
  useMapKeys({ containerRef, onCommand: runCamera });

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Map of Bern"
      aria-describedby="map-keys"
      className="relative isolate size-full"
    >
      <p id="map-keys" className="sr-only">
        Arrow keys or W A S D pan, Q and E turn, plus and minus zoom.
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
        <Lights night={display.night} shadows={shadows} />
        <Ground palette={palette} shadows={shadows} />
        <City
          blocks={CITY.blocks}
          trees={display.lite ? liteTrees(CITY.trees) : CITY.trees}
          palette={palette}
          shadows={shadows}
        />
        <PlaceBuildings buildings={BUILDINGS} palette={palette} shadows={shadows} />
        <MapCamera handleRef={cameraRef} reducedMotion={display.reducedMotion} />
      </Canvas>
    </div>
  );
}
