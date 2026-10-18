// A map camera that never free-falls: the tilt stays between a steep and a shallow bird's-eye view,
// zoom has a floor and a ceiling, and the target cannot leave the map. Mouse and touch drag the map
// like paper; the keyboard moves it in steps through the handle the world view holds.

import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { type ComponentRef, type RefObject, useEffect, useRef } from "react";
import { Box3, Vector3 } from "three";
import {
  type CameraCommand,
  MAX_DISTANCE,
  panOffset,
  ROTATE_STEP,
  START_VIEW,
  startPosition,
  ZOOM_STEP,
} from "./camera-moves";
import { MAP_BOUNDS } from "./geography";

export type CameraHandle = { run: (command: CameraCommand) => void };

type Controls = ComponentRef<typeof CameraControls>;

const target = new Vector3();

function configure(controls: Controls) {
  const { ACTION } = CameraControlsImpl;
  controls.minPolarAngle = 0.45;
  controls.maxPolarAngle = 1.05;
  controls.minDistance = 35;
  controls.maxDistance = MAX_DISTANCE;
  controls.dollyToCursor = true;
  controls.mouseButtons.left = ACTION.TRUCK;
  controls.mouseButtons.right = ACTION.ROTATE;
  controls.mouseButtons.wheel = ACTION.DOLLY;
  controls.touches.one = ACTION.TOUCH_TRUCK;
  controls.touches.two = ACTION.TOUCH_DOLLY_ROTATE;
  controls.setBoundary(
    new Box3(
      new Vector3(MAP_BOUNDS.minX, 0, MAP_BOUNDS.minZ),
      new Vector3(MAP_BOUNDS.maxX, 0, MAP_BOUNDS.maxZ),
    ),
  );
  const aspect = "aspect" in controls.camera ? controls.camera.aspect : 1;
  const [x, y, z] = startPosition(aspect);
  const [tx, ty, tz] = START_VIEW.target;
  void controls.setLookAt(x, y, z, tx, ty, tz, false);
  // Applied now, not on the next update, so the first frame a demand loop draws is already framed.
  controls.update(0);
}

function run(controls: Controls, command: CameraCommand, animate: boolean) {
  if (command.kind === "pan") {
    const [dx, dz] = panOffset(controls.azimuthAngle, command.right, command.forward);
    controls.getTarget(target);
    void controls.moveTo(target.x + dx, target.y, target.z + dz, animate);
  } else if (command.kind === "rotate") {
    void controls.rotate(command.steps * ROTATE_STEP, 0, animate);
  } else {
    void controls.dolly(command.steps * ZOOM_STEP, animate);
  }
}

export function MapCamera({
  handleRef,
  reducedMotion,
}: {
  handleRef: RefObject<CameraHandle | null>;
  reducedMotion: boolean;
}) {
  const controls = useRef<Controls>(null);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const current = controls.current;
    if (current === null) return;
    configure(current);
    invalidate();
  }, [invalidate]);

  useEffect(() => {
    handleRef.current = {
      run: (command) => {
        if (controls.current === null) return;
        run(controls.current, command, !reducedMotion);
        invalidate();
      },
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef, invalidate, reducedMotion]);

  return <CameraControls ref={controls} makeDefault smoothTime={reducedMotion ? 0 : 0.25} />;
}
