// The furniture, each piece standing on its footprint from the layout. The desk and computer are
// one hotspot: sitting down there opens the desktop. Books and leaves are fixed lists, so the room
// looks the same on every visit.

import { type HotspotHandlers } from "./hotspot";
import {
  BOOKSHELF,
  BOOKSHELF_HEIGHT,
  CHAIR,
  DESK,
  DESK_HEIGHT,
  PLANT,
  ROOM_HALF,
} from "./office-layout";
import { Ball, Block, Column } from "./office-parts";

const WOOD = "#b07a4f";
const WOOD_LIGHT = "#c99467";
const SCREEN = "#86b9d4";
const DARK = "#4b4f55";
const BOOK_COLOURS = ["#c46a4a", "#e0b45a", "#6f8f7a", "#4f6d8f", "#b98aa8", "#d9d2c4"] as const;
const LEAF_COLOURS = ["#6f9e5f", "#5d8b52", "#7fae6a"] as const;

/** Leaf positions over the pot, relative to its centre: [x, y, z, size]. */
const LEAVES: readonly (readonly [number, number, number, number])[] = [
  [0, 0.62, 0, 0.16],
  [-0.1, 0.52, 0.06, 0.12],
  [0.11, 0.5, -0.04, 0.12],
  [0.04, 0.74, 0.07, 0.1],
  [-0.06, 0.7, -0.08, 0.1],
];

/** The desk with the computer on it: the top, legs, a drawer unit, the screen and the keyboard. */
export function Desk({ glow, handlers }: { glow: boolean; handlers: HotspotHandlers }) {
  const { x, z, width, depth } = DESK;
  const top = DESK_HEIGHT;
  const legX = width / 2 - 0.06;
  const legZ = depth / 2 - 0.06;
  return (
    <group {...handlers}>
      <Block
        size={[width, 0.05, depth]}
        position={[x, top - 0.025, z]}
        colour={WOOD_LIGHT}
        glow={glow}
      />
      {[
        [-legX, -legZ],
        [legX, -legZ],
        [legX, legZ],
      ].map(([dx = 0, dz = 0]) => (
        <Block
          key={`${dx}-${dz}`}
          size={[0.06, top - 0.05, 0.06]}
          position={[x + dx, (top - 0.05) / 2, z + dz]}
          colour={WOOD}
        />
      ))}
      <Block
        size={[0.42, top - 0.05, depth - 0.06]}
        position={[x - width / 2 + 0.23, (top - 0.05) / 2, z]}
        colour={WOOD}
      />
      <Block
        size={[0.14, 0.025, 0.02]}
        position={[x - width / 2 + 0.23, top - 0.17, z + depth / 2 - 0.02]}
        colour={DARK}
      />
      <Block size={[0.24, 0.015, 0.16]} position={[x, top + 0.008, z - 0.2]} colour={DARK} />
      <Column radius={0.025} height={0.14} position={[x, top, z - 0.22]} colour={DARK} />
      <Block size={[0.74, 0.44, 0.04]} position={[x, top + 0.34, z - 0.2]} colour={DARK} />
      <Block
        size={[0.68, 0.38, 0.01]}
        position={[x, top + 0.34, z - 0.175]}
        colour={SCREEN}
        glow={glow}
      />
      <Block size={[0.46, 0.02, 0.15]} position={[x, top + 0.01, z + 0.12]} colour="#ece6dc" />
      <Column radius={0.04} height={0.1} position={[x + 0.6, top, z + 0.05]} colour="#e07a5f" />
    </group>
  );
}

/** A desk chair facing the desk, its back toward the room. */
export function Chair() {
  const { x, z, width } = CHAIR;
  return (
    <group>
      <Column radius={0.24} height={0.03} position={[x, 0, z]} colour={DARK} />
      <Column radius={0.03} height={0.42} position={[x, 0.03, z]} colour={DARK} />
      <Block size={[width - 0.05, 0.08, width - 0.05]} position={[x, 0.47, z]} colour="#5f7f8f" />
      <Block
        size={[width - 0.05, 0.5, 0.07]}
        position={[x, 0.78, z + width / 2 - 0.06]}
        colour="#5f7f8f"
      />
    </group>
  );
}

const SHELF_LEVELS = [0.02, 0.46, 0.9, 1.34, BOOKSHELF_HEIGHT - 0.02] as const;
const BOOKS_PER_SHELF = 8;

function Books({ shelf, base }: { shelf: number; base: number }) {
  const { x, z, width } = BOOKSHELF;
  return Array.from({ length: BOOKS_PER_SHELF }, (_, index) => {
    const height = 0.26 + ((index * 7 + shelf * 3) % 5) * 0.025;
    return (
      <Block
        key={index}
        size={[0.09, height, 0.26]}
        position={[x - width / 2 + 0.1 + index * 0.1, base + height / 2, z + 0.02]}
        colour={BOOK_COLOURS[(index + shelf * 2) % BOOK_COLOURS.length] ?? WOOD}
      />
    );
  });
}

export function Bookshelf() {
  const { x, z, width, depth } = BOOKSHELF;
  const height = BOOKSHELF_HEIGHT;
  return (
    <group>
      <Block
        size={[width, height, 0.02]}
        position={[x, height / 2, z - depth / 2 + 0.01]}
        colour={WOOD}
      />
      <Block
        size={[0.04, height, depth]}
        position={[x - width / 2 + 0.02, height / 2, z]}
        colour={WOOD}
      />
      <Block
        size={[0.04, height, depth]}
        position={[x + width / 2 - 0.02, height / 2, z]}
        colour={WOOD}
      />
      {SHELF_LEVELS.map((level) => (
        <Block
          key={level}
          size={[width, 0.04, depth]}
          position={[x, level, z]}
          colour={WOOD_LIGHT}
        />
      ))}
      {SHELF_LEVELS.slice(0, 3).map((level, shelf) => (
        <Books key={level} shelf={shelf} base={level + 0.02} />
      ))}
    </group>
  );
}

export function Plant() {
  const { x, z } = PLANT;
  return (
    <group>
      <Column radius={0.16} top={0.2} height={0.36} position={[x, 0, z]} colour="#c8734f" />
      {LEAVES.map(([dx, y, dz, size], index) => (
        <Ball
          key={index}
          radius={size}
          scale={[1, 1.5, 1]}
          position={[x + dx, y, z + dz]}
          colour={LEAF_COLOURS[index % LEAF_COLOURS.length] ?? "#6f9e5f"}
        />
      ))}
    </group>
  );
}

/** A small landscape on the left wall: sky, a far ridge and a green hill, no text. */
export function Picture() {
  const wall = -ROOM_HALF + 0.02;
  return (
    <group>
      <Block size={[0.03, 0.62, 0.86]} position={[wall, 1.55, -1.3]} colour="#fbf6ee" />
      <Block size={[0.04, 0.52, 0.76]} position={[wall, 1.55, -1.3]} colour="#cfe3ee" />
      <Block size={[0.045, 0.16, 0.76]} position={[wall, 1.42, -1.3]} colour="#a9b8c8" />
      <Block size={[0.05, 0.12, 0.76]} position={[wall, 1.35, -1.3]} colour="#86a86c" />
    </group>
  );
}
