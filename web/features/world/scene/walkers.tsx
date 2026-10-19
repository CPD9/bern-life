// You and your agent on the map. Each frame advances the walk (walk-session.ts), places both
// figures, notices a door within reach and asks for another frame only while someone moves, so a
// map at rest goes back to drawing on demand. The figures are other features, so app/ passes them.

import { useFrame, useThree } from "@react-three/fiber";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { type Camera, type Group, Vector3 } from "three";
import { type Door, doorNear } from "../doors";
import { type MapPoint } from "../geography";
import { groundHeight, type WalkMap } from "../walk-map";
import { advance, type WalkSession } from "../walk-session";

/** Large enough to pick out at the default zoom, where one unit is about 20 m. */
export const FIGURE_SCALE = 1.6;
/** The first frame after a rest, or a slow one, counts as this long at most, so nobody jumps. */
const LONGEST_FRAME = 0.05;

const looking = new Vector3();

/** The camera's azimuth from the way it looks, as camera-controls counts it (camera-moves.ts). */
export function viewAzimuth(camera: Camera): number {
  camera.getWorldDirection(looking);
  return Math.atan2(-looking.x, -looking.z);
}

function place(group: Group | null, map: WalkMap, at: MapPoint, heading: number) {
  if (group === null) return;
  group.position.set(at[0], groundHeight(map, at), at[1]);
  group.rotation.y = heading;
}

type WalkersProps = {
  map: WalkMap;
  sessionRef: RefObject<WalkSession>;
  heldRef: RefObject<Set<string>>;
  wakeRef: RefObject<() => void>;
  doors: readonly Door[];
  /** Reduced motion: turn at once. */
  snapTurn: boolean;
  /** Feet on y = 0, facing +z; walking or standing still as asked. */
  person: (walking: boolean) => ReactNode;
  agent: (walking: boolean) => ReactNode;
  onDoor: (door: Door | null) => void;
  /** The path ran out: arrived, blocked or replaced by an arrival. */
  onPathEnd: () => void;
};

export function Walkers({
  map,
  sessionRef,
  heldRef,
  wakeRef,
  doors,
  snapTurn,
  ...props
}: WalkersProps) {
  const person = useRef<Group>(null);
  const agent = useRef<Group>(null);
  const doorKey = useRef<string | null>(null);
  const hadPath = useRef(false);
  const [walking, setWalking] = useState(false);
  const [agentWalking, setAgentWalking] = useState(false);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    wakeRef.current = () => invalidate();
    invalidate();
    return () => {
      wakeRef.current = () => undefined;
    };
  }, [invalidate, wakeRef]);

  useFrame((state, delta) => {
    const step = advance(map, sessionRef.current, {
      held: heldRef.current,
      azimuth: viewAzimuth(state.camera),
      seconds: Math.min(delta, LONGEST_FRAME),
      snapTurn,
    });
    sessionRef.current = step.session;
    const { walker } = step.session;
    place(person.current, map, walker.at, walker.heading);
    place(agent.current, map, step.session.agent.at, step.session.agent.heading);
    const near = doorNear(doors, walker.at);
    if ((near?.key ?? null) !== doorKey.current) {
      doorKey.current = near?.key ?? null;
      props.onDoor(near);
    }
    const hasPath = walker.path.length > 0;
    if (hadPath.current && !hasPath) props.onPathEnd();
    hadPath.current = hasPath;
    if (step.walked !== walking) setWalking(step.walked);
    if (step.agentWalked !== agentWalking) setAgentWalking(step.agentWalked);
    if (step.walked || step.agentWalked || hasPath || heldRef.current.size > 0) state.invalidate();
  });

  return (
    <group>
      <group ref={person} scale={FIGURE_SCALE}>
        {props.person(walking)}
      </group>
      <group ref={agent} scale={FIGURE_SCALE}>
        {props.agent(agentWalking)}
      </group>
    </group>
  );
}
