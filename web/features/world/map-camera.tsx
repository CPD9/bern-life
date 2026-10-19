// A map camera that never free-falls: the tilt stays between a steep and a shallow bird's-eye view,
// zoom has a floor and a ceiling, and the target cannot leave the map. Mouse and touch drag the map
// like paper; the keyboard moves it in steps through the handle the world view holds. While you
// walk it can follow you instead: the target stays on you, and a drag turns the view round you.

import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { type ComponentRef, type RefObject, useEffect, useRef } from "react";
import { Box3, Vector3 } from "three";
import {
  type CameraCommand,
  FOLLOW_VIEW,
  focusTarget,
  followPosition,
  frameBox,
  MAX_DISTANCE,
  panOffset,
  ROTATE_STEP,
  START_VIEW,
  startPosition,
  ZOOM_STEP,
} from "./camera-moves";
import { MAP_BOUNDS, type MapPoint } from "./geography";

export type CameraHandle = {
  run: (command: CameraCommand) => void;
  focus: (x: number, z: number) => void;
};

type Controls = ComponentRef<typeof CameraControls>;

/** Where the walker's feet are; the follow camera looks at this point. */
export type FollowTarget = () => readonly [number, number, number];

const target = new Vector3();
const FRAME_MARGIN = 12;
const FRAME_MIN_SPAN = 60;
const MIN_DISTANCE = 35;
/** Closer than this the camera is already on you. */
const ON_TARGET = 1e-3;

/** The map drags like paper; following, a drag or one finger turns the view round you instead. */
function setGestures(controls: Controls, following: boolean) {
  const { ACTION } = CameraControlsImpl;
  controls.minDistance = following ? FOLLOW_VIEW.minDistance : MIN_DISTANCE;
  controls.maxDistance = following ? FOLLOW_VIEW.maxDistance : MAX_DISTANCE;
  controls.dollyToCursor = !following;
  controls.mouseButtons.left = following ? ACTION.ROTATE : ACTION.TRUCK;
  controls.touches.one = following ? ACTION.TOUCH_ROTATE : ACTION.TOUCH_TRUCK;
}

function configure(controls: Controls) {
  const { ACTION } = CameraControlsImpl;
  controls.minPolarAngle = 0.45;
  controls.maxPolarAngle = 1.05;
  setGestures(controls, false);
  controls.mouseButtons.right = ACTION.ROTATE;
  controls.mouseButtons.wheel = ACTION.DOLLY;
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

/**
 * `framePoints` is a prop, not a handle call: the canvas mounts its scene after the page's own
 * effects run, so a search shown at load would otherwise reach a camera that does not exist yet.
 */
export function MapCamera({
  handleRef,
  reducedMotion,
  framePoints,
  follow,
}: {
  handleRef: RefObject<CameraHandle | null>;
  reducedMotion: boolean;
  framePoints: readonly MapPoint[];
  /** Present while the camera follows the walker. */
  follow: FollowTarget | null;
}) {
  const controls = useRef<Controls>(null);
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);
  const following = follow !== null;

  useEffect(() => {
    const current = controls.current;
    if (current === null) return;
    configure(current);
    invalidate();
  }, [invalidate]);

  // Starting to follow swings in behind you; stopping leaves the view where it is.
  useEffect(() => {
    const current = controls.current;
    if (current === null) return;
    setGestures(current, follow !== null);
    if (follow !== null) {
      const at = follow();
      void current.setLookAt(...followPosition(at, current.azimuthAngle), ...at, !reducedMotion);
    }
    invalidate();
  }, [follow, invalidate, reducedMotion]);

  // Runs only on frames something else asked for: while you walk, and while the camera settles.
  useFrame(() => {
    const current = controls.current;
    if (current === null || follow === null) return;
    const [x, y, z] = follow();
    current.getTarget(target);
    if (Math.hypot(target.x - x, target.y - y, target.z - z) <= ON_TARGET) return;
    void current.moveTo(x, y, z, !reducedMotion);
    invalidate();
  });

  useEffect(() => {
    const current = controls.current;
    if (current === null || framePoints.length === 0) return;
    const box = frameBox(framePoints, FRAME_MARGIN, FRAME_MIN_SPAN);
    void current.fitToBox(
      new Box3(new Vector3(box.minX, 0, box.minZ), new Vector3(box.maxX, 4, box.maxZ)),
      !reducedMotion,
    );
    invalidate();
  }, [framePoints, invalidate, reducedMotion]);

  useEffect(() => {
    handleRef.current = {
      run: (command) => {
        if (controls.current === null) return;
        run(controls.current, command, !reducedMotion);
        invalidate();
      },
      focus: (x, z) => {
        const current = controls.current;
        if (current === null || following) return;
        const portrait = size.height > size.width;
        const [tx, tz] = focusTarget(x, z, current.azimuthAngle, portrait);
        void current.moveTo(tx, 0, tz, !reducedMotion);
        invalidate();
      },
    };
    return () => {
      handleRef.current = null;
    };
  }, [following, handleRef, invalidate, reducedMotion, size]);

  return <CameraControls ref={controls} makeDefault smoothTime={reducedMotion ? 0 : 0.25} />;
}
