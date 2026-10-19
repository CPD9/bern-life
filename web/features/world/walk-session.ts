// One walk: you, and your agent a little behind you. The frame loop advances it with plain
// functions, so a whole walk can be replayed in a test without three.js.

import { type MapPoint } from "./geography";
import { besideSpot, extendTrail, FOLLOW_GAP, pointBehind, startTrail, type Trail } from "./trail";
import { headingToward, keyDirection, type Walker, WALKER_RADIUS, walkTick } from "./walk";
import { heldSteer } from "./walk-keys";
import { type WalkMap } from "./walk-map";

export type Agent = { readonly at: MapPoint; readonly heading: number };

export type WalkSession = {
  readonly walker: Walker;
  readonly trail: Trail;
  readonly agent: Agent;
};

/** Facing south, toward the default camera, as you step out of a door. */
const ARRIVAL_HEADING = 0;

/** You standing at `at` with nowhere to go, your agent beside you. */
export function arrive(map: WalkMap, at: MapPoint): WalkSession {
  const beside = besideSpot(map, at, ARRIVAL_HEADING, WALKER_RADIUS);
  return {
    walker: { at, heading: ARRIVAL_HEADING, path: [] },
    trail: startTrail(at, beside),
    agent: { at: beside, heading: ARRIVAL_HEADING },
  };
}

export function withPath(session: WalkSession, path: readonly MapPoint[]): WalkSession {
  return { ...session, walker: { ...session.walker, path } };
}

export type FrameInput = {
  readonly held: ReadonlySet<string>;
  /** The camera's azimuth, so the keys walk relative to the view. */
  readonly azimuth: number;
  readonly seconds: number;
  readonly snapTurn: boolean;
};

export type Step = {
  readonly session: WalkSession;
  readonly walked: boolean;
  readonly agentWalked: boolean;
};

export function advance(map: WalkMap, session: WalkSession, input: FrameInput): Step {
  const { right, forward } = heldSteer(input.held);
  const direction = keyDirection(input.azimuth, right, forward);
  const walker = walkTick(map, session.walker, { direction, ...input });
  const walked = walker.at[0] !== session.walker.at[0] || walker.at[1] !== session.walker.at[1];
  const trail = walked ? extendTrail(session.trail, walker.at) : session.trail;
  const at = pointBehind(trail, FOLLOW_GAP) ?? walker.at;
  const dx = at[0] - session.agent.at[0];
  const dz = at[1] - session.agent.at[1];
  const agentWalked = dx !== 0 || dz !== 0;
  const agent = agentWalked ? { at, heading: headingToward(dx, dz) } : session.agent;
  return { session: { walker, trail, agent }, walked, agentWalked };
}
