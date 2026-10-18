// Units that share a building become one marker with a count. Pages write the same building in
// different ways ("Murtenstrasse 50, 3008 Bern" and "Murtenstrasse 50", or with a hospital wing in
// front), so the key is the street and house number found inside the address.

import { type Place } from "./places";

export type Building = {
  readonly key: string;
  readonly x: number;
  readonly z: number;
  readonly places: readonly Place[];
};

const STREET_AND_NUMBER = /([\p{L}][\p{L}.-]*(?:strasse|gasse|weg|platz|rain))\s+(\d+[a-z]?)\b/iu;

export function buildingKey(address: string | null): string | null {
  if (address === null) return null;
  const match = STREET_AND_NUMBER.exec(address.normalize("NFC"));
  if (match === null) return null;
  return `${match[1]} ${match[2]}`.toLowerCase();
}

function compareCodeUnits(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** A building stands where its first unit (by id) was placed; units in one building share x, z. */
export function groupPlacesByBuilding(places: readonly Place[]): readonly Building[] {
  const byKey = new Map<string, Building>();
  for (const place of [...places].sort((a, b) => compareCodeUnits(a.id, b.id))) {
    const key = buildingKey(place.address) ?? `place:${place.id}`;
    const existing = byKey.get(key);
    byKey.set(
      key,
      existing === undefined
        ? { key, x: place.x, z: place.z, places: [place] }
        : { ...existing, places: [...existing.places, place] },
    );
  }
  return [...byKey.values()].sort((a, b) => compareCodeUnits(a.key, b.key));
}
