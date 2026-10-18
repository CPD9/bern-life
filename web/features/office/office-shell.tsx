// The room itself: a plank floor with a rug, the back wall with the window over the desk and the
// left wall with the door. The two walls toward the viewer are left out, like a doll's house, so
// the whole room is always in view.

import { type HotspotHandlers } from "./hotspot";
import {
  BACK_WALL,
  DOOR,
  LEFT_WALL,
  ROOM_HALF,
  RUG,
  WALL_THICKNESS,
  type WallPiece,
  WINDOW,
} from "./office-layout";
import { Ball, Block } from "./office-parts";

const PLANKS = 8;
const PLANK_COLOURS = ["#c99f72", "#c19468"] as const;
const WALL = "#eee1cc";
const TRIM = "#fbf6ee";
const GLASS = "#bfdcec";
const DOOR_WOOD = "#9a6a45";
const BRASS = "#d9b25c";

const SIZE = ROOM_HALF * 2;
/** Centre line of each wall, just outside the floor. */
const WALL_LINE = -ROOM_HALF - WALL_THICKNESS / 2;

function Floor() {
  const plank = SIZE / PLANKS;
  return (
    <group>
      {Array.from({ length: PLANKS }, (_, index) => (
        <Block
          key={index}
          size={[SIZE, 0.08, plank]}
          position={[0, -0.04, -ROOM_HALF + plank * (index + 0.5)]}
          colour={PLANK_COLOURS[index % 2] ?? WALL}
        />
      ))}
      <Block
        size={[RUG.width, 0.012, RUG.depth]}
        position={[RUG.x, 0.006, RUG.z]}
        colour="#d98f6f"
      />
      <Block
        size={[RUG.width - 0.4, 0.014, RUG.depth - 0.4]}
        position={[RUG.x, 0.008, RUG.z]}
        colour="#ebbb93"
      />
    </group>
  );
}

function BackWall() {
  return BACK_WALL.map((piece: WallPiece) => (
    <Block
      key={`${piece.start}-${piece.bottom}`}
      size={[piece.end - piece.start, piece.top - piece.bottom, WALL_THICKNESS]}
      position={[(piece.start + piece.end) / 2, (piece.bottom + piece.top) / 2, WALL_LINE]}
      colour={WALL}
    />
  ));
}

function LeftWall() {
  return LEFT_WALL.map((piece: WallPiece) => (
    <Block
      key={`${piece.start}-${piece.bottom}`}
      size={[WALL_THICKNESS, piece.top - piece.bottom, piece.end - piece.start]}
      position={[WALL_LINE, (piece.bottom + piece.top) / 2, (piece.start + piece.end) / 2]}
      colour={WALL}
    />
  ));
}

function Window() {
  const { along: x, width, sill, height } = WINDOW;
  const middle = sill + height / 2;
  const depth = WALL_THICKNESS + 0.04;
  return (
    <group>
      <Block size={[width, height, 0.02]} position={[x, middle, WALL_LINE]} colour={GLASS} />
      <Block size={[width, 0.06, depth]} position={[x, sill + height, WALL_LINE]} colour={TRIM} />
      <Block
        size={[0.06, height, depth]}
        position={[x - width / 2, middle, WALL_LINE]}
        colour={TRIM}
      />
      <Block
        size={[0.06, height, depth]}
        position={[x + width / 2, middle, WALL_LINE]}
        colour={TRIM}
      />
      <Block size={[0.04, height, depth]} position={[x, middle, WALL_LINE]} colour={TRIM} />
      <Block size={[width, 0.04, depth]} position={[x, middle, WALL_LINE]} colour={TRIM} />
      <Block
        size={[width + 0.2, 0.05, 0.24]}
        position={[x, sill, -ROOM_HALF + 0.06]}
        colour={TRIM}
      />
    </group>
  );
}

/** The way out: the door, its frame and a mat in front, all one hotspot. */
function Door({ glow, handlers }: { glow: boolean; handlers: HotspotHandlers }) {
  const { along: z, width, height } = DOOR;
  const depth = WALL_THICKNESS + 0.04;
  return (
    <group {...handlers}>
      <Block
        size={[0.06, height, width]}
        position={[WALL_LINE, height / 2, z]}
        colour={DOOR_WOOD}
        glow={glow}
      />
      <Block size={[depth, 0.07, width + 0.14]} position={[WALL_LINE, height, z]} colour={TRIM} />
      <Block
        size={[depth, height, 0.07]}
        position={[WALL_LINE, height / 2, z - width / 2]}
        colour={TRIM}
      />
      <Block
        size={[depth, height, 0.07]}
        position={[WALL_LINE, height / 2, z + width / 2]}
        colour={TRIM}
      />
      <Ball
        radius={0.045}
        position={[-ROOM_HALF + 0.03, 1.0, z + width / 2 - 0.14]}
        colour={BRASS}
      />
      <Block
        size={[0.55, 0.012, width - 0.1]}
        position={[-ROOM_HALF + 0.35, 0.006, z]}
        colour="#8f9d6e"
      />
    </group>
  );
}

export function OfficeShell({ doorGlow, door }: { doorGlow: boolean; door: HotspotHandlers }) {
  return (
    <group>
      <Floor />
      <BackWall />
      <LeftWall />
      <Window />
      <Door glow={doorGlow} handlers={door} />
    </group>
  );
}
