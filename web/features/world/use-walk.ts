"use client";

// Walking on the map: the mode switch (keys pan the map, or walk you), the follow camera, the door
// you stand at, and click-to-walk. Where you are lives in a ref the frame loop writes, so walking
// never re-renders React; only a new door, a new path or a mode change does.

import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Door, doorNear } from "./doors";
import { type MapPoint } from "./geography";
import { type FollowTarget } from "./map-camera";
import { type HeldKeys } from "./walk-keys";
import { groundHeight, type WalkMap } from "./walk-map";
import { findPath, type Planner, walkPlanner } from "./walk-path";
import { arrive, type WalkSession, withPath } from "./walk-session";

export type Walk = {
  session: RefObject<WalkSession>;
  held: RefObject<Set<string>>;
  /** The frame loop puts its invalidate here, so a key or a click can wake a resting canvas. */
  wake: RefObject<() => void>;
  walking: boolean;
  toggleWalking: () => void;
  following: boolean;
  toggleFollowing: () => void;
  /** Present while walking: where the movement keys go. */
  keys: HeldKeys | null;
  /** Present while the follow camera is on. */
  follow: FollowTarget | null;
  door: Door | null;
  setDoor: (door: Door | null) => void;
  /** The path being walked, from where it started; null when standing. */
  preview: readonly MapPoint[] | null;
  clearPreview: () => void;
  goTo: (point: MapPoint) => void;
  stop: () => void;
};

type WalkOptions = {
  map: WalkMap;
  /** Your office door, or the station before you have one. */
  start: MapPoint;
  /** In the office. Coming out, and moving house, put you at `start`. */
  inside: boolean;
  doors: readonly Door[];
  /** Places a search lit; showing them takes the camera there, so the follow camera lets go. */
  framePoints: readonly MapPoint[];
};

export function useWalk({ map, start, inside, doors, framePoints }: WalkOptions): Walk {
  // Worked out once: an argument to useRef would be built again on every render and thrown away.
  const [arrival] = useState(() => arrive(map, start));
  const session = useRef<WalkSession>(arrival);
  const held = useRef(new Set<string>());
  const wake = useRef<() => void>(() => undefined);
  // Built on the first click-to-walk, and again only for a new map.
  const planner = useRef<{ map: WalkMap; planner: Planner } | null>(null);
  const [walking, setWalking] = useState(false);
  const [following, setFollowing] = useState(true);
  // Known before the first frame, so your own door's "Go home" is there as the map appears.
  const [door, setDoor] = useState(() => doorNear(doors, start));
  const [preview, setPreview] = useState<readonly MapPoint[] | null>(null);
  const [framed, setFramed] = useState(framePoints);
  if (framePoints !== framed) {
    setFramed(framePoints);
    if (framePoints.length > 0) setFollowing(false);
  }
  const [wasInside, setWasInside] = useState(inside);
  if (inside !== wasInside) {
    setWasInside(inside);
    // Coming out, the door you stand at is offered at once, so focus can go straight to it.
    if (inside) setPreview(null);
    else setDoor(doorNear(doors, start));
  }

  // Going in ends the walk, and no key held as the door closed is still walking you when you come
  // out. Arriving drops any path; the frame loop then sees it gone.
  useEffect(() => {
    if (inside) {
      session.current = withPath(session.current, []);
      held.current.clear();
      return;
    }
    session.current = arrive(map, start);
    wake.current();
  }, [inside, map, start]);

  const keys = useMemo<HeldKeys>(
    () => ({
      press: (key) => {
        held.current.add(key);
        wake.current();
      },
      release: (key) => void held.current.delete(key),
      clear: () => held.current.clear(),
    }),
    [],
  );

  // Asked every frame while you walk, so it fills one array instead of making a new one.
  const follow = useMemo<FollowTarget | null>(() => {
    if (!walking || !following) return null;
    const feet: [number, number, number] = [0, 0, 0];
    return () => {
      const at = session.current.walker.at;
      feet[0] = at[0];
      feet[1] = groundHeight(map, at);
      feet[2] = at[1];
      return feet;
    };
  }, [walking, following, map]);

  const stop = useCallback(() => {
    session.current = withPath(session.current, []);
    setPreview(null);
  }, []);

  const goTo = useCallback(
    (point: MapPoint) => {
      if (planner.current?.map !== map) planner.current = { map, planner: walkPlanner(map) };
      const from = session.current.walker.at;
      const path = findPath(planner.current.planner, from, point);
      if (path === null || path.length === 0) return;
      session.current = withPath(session.current, path);
      setPreview([from, ...path]);
      wake.current();
    },
    [map],
  );

  const clearPreview = useCallback(() => setPreview(null), []);

  return {
    session,
    held,
    wake,
    walking,
    // Starting to walk always brings the follow camera, whatever an earlier search did to it.
    toggleWalking: () => {
      if (walking) {
        stop();
        held.current.clear();
      } else {
        setFollowing(true);
      }
      setWalking(!walking);
    },
    following,
    toggleFollowing: () => setFollowing(!following),
    keys: walking ? keys : null,
    follow,
    door,
    setDoor,
    preview,
    clearPreview,
    goTo,
    stop,
  };
}
