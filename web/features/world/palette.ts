// Soft, low-contrast colours so the place markers and their glow carry the eye. The Old Town keeps
// Bern's own two: grey-green sandstone walls under terracotta roofs.

import { type PlaceKind } from "./places";

/** Materials of the landmarks, so each one reads as stone, roof, copper or glass. */
export type LandmarkTone = "stone" | "roof" | "slate" | "copper" | "glass" | "clock";

export type WorldPalette = {
  readonly ground: string;
  readonly districtPlate: string;
  readonly oldTownPlate: string;
  readonly water: string;
  readonly bank: string;
  readonly road: string;
  readonly bridge: string;
  readonly pier: string;
  readonly blockTones: readonly string[];
  readonly houseWalls: readonly string[];
  readonly roofs: readonly string[];
  readonly landmark: Readonly<Record<LandmarkTone, string>>;
  readonly trunk: string;
  readonly crown: string;
  readonly placeBuilding: Readonly<Record<PlaceKind, string>>;
  readonly campus: string;
};

const DAY: WorldPalette = {
  ground: "#b9d39a",
  districtPlate: "#dfe3d6",
  oldTownPlate: "#e8dcc6",
  water: "#72bcd4",
  bank: "#8daa76",
  road: "#f4f1ea",
  bridge: "#d9cfbf",
  pier: "#b7ab97",
  blockTones: ["#f2ede4", "#e9dfd0", "#dfe6ec", "#efe4d8"],
  houseWalls: ["#e9e2cc", "#ded8bf", "#efe6d2"],
  roofs: ["#d9774c", "#cc6a45", "#e08a5c"],
  landmark: {
    stone: "#ddd6bf",
    roof: "#cc6a45",
    slate: "#6f7a86",
    copper: "#7fb9a2",
    glass: "#cfe4ef",
    clock: "#2f4b7c",
  },
  trunk: "#8a6a4f",
  crown: "#6fae5d",
  placeBuilding: {
    institute: "#f7f3ff",
    platform: "#eef7ff",
    centre: "#fff6ea",
    agency: "#eef7ee",
    space: "#fff0f3",
  },
  campus: "#cfe0bd",
};

const NIGHT: WorldPalette = {
  ground: "#3d5546",
  districtPlate: "#4a5361",
  oldTownPlate: "#585148",
  water: "#336a8c",
  bank: "#2f4538",
  road: "#6a7383",
  bridge: "#7a746c",
  pier: "#5c5750",
  blockTones: ["#6b7384", "#76706a", "#66737f", "#7a746c"],
  houseWalls: ["#7a7568", "#716c61", "#817b6e"],
  roofs: ["#7c4a3a", "#6f4335", "#87553f"],
  landmark: {
    stone: "#7f796c",
    roof: "#6f4335",
    slate: "#4a525d",
    copper: "#4c7a69",
    glass: "#6a8597",
    clock: "#26395e",
  },
  trunk: "#5a4a3a",
  crown: "#3f7350",
  placeBuilding: {
    institute: "#a6a2c4",
    platform: "#93a9bf",
    centre: "#c2aa8e",
    agency: "#93b39b",
    space: "#bf9aa8",
  },
  campus: "#4a6a50",
};

export function paletteFor(night: boolean): WorldPalette {
  return night ? NIGHT : DAY;
}
