import { expect, test } from "bun:test";
import { BUILDINGS, CITY } from "./city-layout";
import { BAHNHOFPLATZ, BRIDGES, type MapPoint } from "./geography";
import { bridgeFootprint, DECK_HEIGHT } from "./scene/bridge-plan";
import { groundHeight } from "./walk-map";
import { walkWorld } from "./walk-world";

// three.js has to finish loading as a module before the canvas library requires it.
const THREE = await import("three");
const { CameraControlsImpl } = await import("@react-three/drei");
const { onTarget, TARGET_BOUNDS } = await import("./map-camera");

test("the follow camera comes to rest on you on a bridge's deck, as on the ground", () => {
  CameraControlsImpl.install({ THREE });
  const controls = new CameraControlsImpl(new THREE.PerspectiveCamera(35, 1, 1, 1200));
  controls.setBoundary(TARGET_BOUNDS);
  controls.smoothTime = 0;
  const { map } = walkWorld(CITY, BUILDINGS, null);
  const deck = bridgeFootprint(BRIDGES.kirchenfeld);
  const looking = new THREE.Vector3();
  for (const at of [[deck.x, deck.z], BAHNHOFPLATZ] satisfies MapPoint[]) {
    const feet = [at[0], groundHeight(map, at), at[1]] as const;
    void controls.moveTo(...feet, false);
    controls.update(1 / 60);
    expect(onTarget(controls.getTarget(looking), feet)).toBe(true);
  }
  expect(groundHeight(map, [deck.x, deck.z])).toBe(DECK_HEIGHT);
  controls.dispose();
});
