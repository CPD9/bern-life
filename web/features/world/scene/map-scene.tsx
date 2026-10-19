// Everything inside the map's canvas: the ground, the city, the places' buildings, your office,
// you and your agent, the path you are walking, the labels' projector and the camera. The canvas
// draws on demand; shadows and pixel ratio are fixed when its renderer is created, so lite
// graphics remounts it.

import { Canvas } from "@react-three/fiber";
import { type ReactNode, type RefObject } from "react";
import { CITY, BUILDINGS } from "../city-layout";
import { liteTrees } from "../city-plan";
import { type WorldDisplay } from "../display";
import { type MapPoint } from "../geography";
import { type Lighting } from "../light";
import { type CameraHandle, MapCamera } from "../map-camera";
import { AnchorProjector } from "../markers/anchor-projector";
import { type Anchor, type AnchorElements } from "../markers/anchors";
import { paletteFor } from "../palette";
import { type Walk } from "../use-walk";
import { type WalkWorld } from "../walk-world";
import { City } from "./city";
import { Ground } from "./ground";
import { HomeLot } from "./home-lot";
import { Lights } from "./lights";
import { PathPreview } from "./path-preview";
import { PlaceBuildings } from "./place-buildings";
import { Walkers } from "./walkers";

type MapSceneProps = {
  display: WorldDisplay;
  world: WalkWorld;
  home: MapPoint | null;
  walk: Walk;
  lighting: Lighting | null;
  framePoints: readonly MapPoint[];
  anchors: readonly Anchor[];
  anchorsRef: AnchorElements;
  cameraRef: RefObject<CameraHandle | null>;
  person: (lite: boolean, walking: boolean) => ReactNode;
  agent: (lite: boolean, walking: boolean) => ReactNode;
};

export function MapScene({ display, world, home, walk, ...props }: MapSceneProps) {
  const palette = paletteFor(display.night);
  const shadows = !display.lite;
  return (
    <Canvas
      key={display.lite ? "lite" : "full"}
      frameloop="demand"
      shadows={shadows ? "percentage" : false}
      dpr={display.lite ? 1 : [1, 2]}
      gl={{ alpha: true }}
      camera={{ fov: 35, near: 1, far: 1200 }}
    >
      <Lights night={display.night} shadows={shadows} />
      <Ground palette={palette} shadows={shadows} onPick={walk.walking ? walk.goTo : undefined} />
      <City
        drawn={world.drawn}
        trees={display.lite ? liteTrees(CITY.trees) : CITY.trees}
        palette={palette}
        shadows={shadows}
      />
      <PlaceBuildings
        buildings={BUILDINGS}
        palette={palette}
        shadows={shadows}
        lighting={props.lighting}
      />
      {home !== null && <HomeLot home={home} palette={palette} shadows={shadows} />}
      <Walkers
        map={world.map}
        sessionRef={walk.session}
        heldRef={walk.held}
        wakeRef={walk.wake}
        doors={world.doors}
        snapTurn={display.reducedMotion}
        person={(walking) => props.person(display.lite, walking)}
        agent={(walking) => props.agent(display.lite, walking)}
        onDoor={walk.setDoor}
        onPathEnd={walk.clearPreview}
      />
      {walk.preview !== null && <PathPreview points={walk.preview} map={world.map} />}
      <AnchorProjector anchors={props.anchors} elementsRef={props.anchorsRef} />
      <MapCamera
        handleRef={props.cameraRef}
        reducedMotion={display.reducedMotion}
        framePoints={props.framePoints}
        follow={walk.follow}
      />
    </Canvas>
  );
}
