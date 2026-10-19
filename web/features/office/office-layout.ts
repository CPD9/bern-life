// Where everything stands in the office, as plain numbers, so the room can be checked without
// three.js: nothing pokes through a wall and nothing stands in anything else. The room is a square
// on the floor (y = 0) centred on the origin. The camera looks from the +x, +z corner, so the back
// (-z) and left (-x) walls stand and the two walls toward the viewer are cut away.

/** Half the room's width and depth, in metres. */
export const ROOM_HALF = 3;
export const WALL_HEIGHT = 2.6;
export const WALL_THICKNESS = 0.12;

/** An axis-aligned rectangle on the floor: centre and full size along x and z. */
export type Footprint = {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
};

export const DESK = { id: "desk", x: 0.6, z: -2.4, width: 1.6, depth: 0.8 } as const;
export const DESK_HEIGHT = 0.75;
export const CHAIR = { id: "chair", x: 0.6, z: -1.55, width: 0.55, depth: 0.55 } as const;
export const BOOKSHELF = { id: "bookshelf", x: -1.9, z: -2.75, width: 1.1, depth: 0.4 } as const;
export const BOOKSHELF_HEIGHT = 1.8;
export const PLANT = { id: "plant", x: 2.45, z: -2.45, width: 0.5, depth: 0.5 } as const;
export const RUG = { x: -0.3, z: 0.4, width: 2.6, depth: 1.8 } as const;
/** Bärnli stands beside the desk, facing the room. */
export const LUMI_SPOT = { id: "lumi", x: 1.85, z: -1.5, width: 0.6, depth: 0.6 } as const;
/** The player stands on the rug in the middle of the room. */
export const PLAYER_SPOT = { id: "player", x: -0.4, z: 0.5, width: 0.6, depth: 0.6 } as const;

/** Openings in a wall, measured along it: the window over the desk, the door on the left wall. */
export const WINDOW = { wall: "back", along: DESK.x, width: 1.4, sill: 1.0, height: 1.0 } as const;
export const DOOR = { wall: "left", along: 1.2, width: 0.9, height: 2.05 } as const;

/** The floor in front of the door stays clear, so the way out is never blocked. */
export const DOOR_CLEARANCE: Footprint = {
  id: "door-clearance",
  x: -ROOM_HALF + 0.45,
  z: DOOR.along,
  width: 0.9,
  depth: DOOR.width,
};

export const FLOOR_ITEMS: readonly Footprint[] = [
  DESK,
  CHAIR,
  BOOKSHELF,
  PLANT,
  LUMI_SPOT,
  PLAYER_SPOT,
  DOOR_CLEARANCE,
];

export function insideRoom(item: Footprint): boolean {
  return (
    item.x - item.width / 2 >= -ROOM_HALF &&
    item.x + item.width / 2 <= ROOM_HALF &&
    item.z - item.depth / 2 >= -ROOM_HALF &&
    item.z + item.depth / 2 <= ROOM_HALF
  );
}

/** Touching edges do not count: a desk may stand flush against a shelf. */
export function overlaps(a: Footprint, b: Footprint): boolean {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2
  );
}

/** Every pair of floor items that overlap, by id, for a test to show what collided. */
export function collisions(items: readonly Footprint[]): readonly [string, string][] {
  return items.flatMap((a, index) =>
    items
      .slice(index + 1)
      .flatMap((b): [string, string][] => (overlaps(a, b) ? [[a.id, b.id]] : [])),
  );
}

/** One solid box of a wall, measured along the wall and up from the floor. */
export type WallPiece = {
  readonly start: number;
  readonly end: number;
  readonly bottom: number;
  readonly top: number;
};

type Opening = {
  readonly along: number;
  readonly width: number;
  readonly bottom: number;
  readonly top: number;
};

/** A wall from `start` to `end` with one opening cut out: the boxes either side, below and above. */
export function wallPieces(start: number, end: number, opening: Opening): readonly WallPiece[] {
  const left = opening.along - opening.width / 2;
  const right = opening.along + opening.width / 2;
  const pieces: WallPiece[] = [
    { start, end: left, bottom: 0, top: WALL_HEIGHT },
    { start: right, end, bottom: 0, top: WALL_HEIGHT },
    { start: left, end: right, bottom: 0, top: opening.bottom },
    { start: left, end: right, bottom: opening.top, top: WALL_HEIGHT },
  ];
  return pieces.filter((piece) => piece.end > piece.start && piece.top > piece.bottom);
}

/** The back wall runs over the left wall's end, so the corner is closed. */
export const BACK_WALL = wallPieces(-ROOM_HALF - WALL_THICKNESS, ROOM_HALF, {
  along: WINDOW.along,
  width: WINDOW.width,
  bottom: WINDOW.sill,
  top: WINDOW.sill + WINDOW.height,
});
export const LEFT_WALL = wallPieces(-ROOM_HALF, ROOM_HALF, {
  along: DOOR.along,
  width: DOOR.width,
  bottom: 0,
  top: DOOR.height,
});

/** The camera looks down from the open corner at about 30 degrees, onto the middle of the room. */
export const CAMERA_POSITION = [12, 10, 12] as const;
export const LOOK_AT = [0, 1.2, 0] as const;

/** From there the room spans about this many metres across and up the screen, with a margin. */
const VIEW_WIDTH = 9.6;
const VIEW_HEIGHT = 7.6;

/** Orthographic zoom (pixels per metre) that fits the whole room in a canvas of this size. */
export function fitZoom(width: number, height: number): number {
  return Math.max(1, Math.min(width / VIEW_WIDTH, height / VIEW_HEIGHT));
}
