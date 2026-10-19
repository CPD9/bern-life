"use client";

// Walking on the map: the mode switch (keys pan the map, or walk you), the follow camera, the door
// you stand at, and click-to-walk. Where you are lives in a ref the frame loop writes, so walking
// never re-renders React; only a new door, a new path or a mode change does.

import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Door, doorNear } from "./doors";
import { type MapPoint } from "./geography";
import { type FollowTarget } from "./map-camera";
import { WALKER_RADIUS } from "./walk";
import { buildGrid, type WalkGrid } from "./walk-grid";
import { type HeldKeys } from "./walk-keys";
import { blocked, groundHeight, type WalkMap } from "./walk-map";
import { findPath } from "./walk-path";
import { arrive, type WalkSession, withPath } from "./walk-session";

/** Fine enough for the Old Town's lanes; the grid is built on the first click-to-walk. */
const GRID_CELL = 0.5;

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
  const session = useRef<WalkSession>(arrive(map, start));
  const held = useRef(new Set<string>());
  const wake = useRef<() => void>(() => undefined);
  const grid = useRef<{ map: WalkMap; grid: WalkGrid } | null>(null);
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

  // Arriving drops any path; the frame loop then sees it gone and clears the preview.
  useEffect(() => {
    if (inside) return;
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

  const follow = useMemo<FollowTarget | null>(
    () =>
      walking && following
        ? () => {
            const at = session.current.walker.at;
            return [at[0], groundHeight(map, at), at[1]];
          }
        : null,
    [walking, following, map],
  );

  const stop = useCallback(() => {
    session.current = withPath(session.current, []);
    setPreview(null);
  }, []);

  const goTo = useCallback(
    (point: MapPoint) => {
      if (grid.current?.map !== map) {
        const open = (at: MapPoint) => !blocked(map, at, WALKER_RADIUS);
        grid.current = { map, grid: buildGrid(open, map.bounds, GRID_CELL) };
      }
      const from = session.current.walker.at;
      const path = findPath(grid.current.grid, from, point);
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
    toggleWalking: () => {
      if (walking) {
        stop();
        held.current.clear();
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
