// Soft, low-contrast colours so the place markers and their glow carry the eye.

import { type PlaceKind } from "./places";

export type WorldPalette = {
  readonly ground: string;
  readonly districtPlate: string;
  readonly oldTownPlate: string;
  readonly water: string;
  readonly road: string;
  readonly bridge: string;
  readonly blockTones: readonly string[];
  readonly trunk: string;
  readonly crown: string;
  readonly placeBuilding: Readonly<Record<PlaceKind, string>>;
  readonly campus: string;
};

const DAY: WorldPalette = {
  ground: "#b9d39a",
  districtPlate: "#dfe3d6",
  oldTownPlate: "#e8dcc6",
  water: "#7fb8e6",
  road: "#f4f1ea",
  bridge: "#d9cfbf",
  blockTones: ["#f2ede4", "#e9dfd0", "#dfe6ec", "#efe4d8"],
  trunk: "#8a6a4f",
  crown: "#6fae5d",
  placeBuilding: { institute: "#f7f3ff", platform: "#eef7ff", centre: "#fff6ea" },
  campus: "#cfe0bd",
};

const NIGHT: WorldPalette = {
  ground: "#3d5546",
  districtPlate: "#4a5361",
  oldTownPlate: "#585148",
  water: "#3d6d9e",
  road: "#6a7383",
  bridge: "#7a746c",
  blockTones: ["#6b7384", "#76706a", "#66737f", "#7a746c"],
  trunk: "#5a4a3a",
  crown: "#3f7350",
  placeBuilding: { institute: "#a6a2c4", platform: "#93a9bf", centre: "#c2aa8e" },
  campus: "#4a6a50",
};

export function paletteFor(night: boolean): WorldPalette {
  return night ? NIGHT : DAY;
}
