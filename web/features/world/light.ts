// A search lights the buildings that hold its results: brightest for the best rank, a little less
// for each rank after, never below a floor so a tenth result is still visible. A result whose page
// is on no mapped host is kept in an "elsewhere" list, never dropped.

import { type SearchResponse } from "@/infrastructure/contract-types.generated";
import { type Building } from "./buildings";

export type SearchResult = SearchResponse["results"][number];

const GLOW_BY_RANK = [1, 0.85, 0.7, 0.55, 0.4] as const;
const GLOW_FLOOR = 0.3;

/** How much a building with no result keeps of its marker while results are shown. */
export const UNLIT_OPACITY = 0.6;

export function rankToGlow(rank: number): number {
  return GLOW_BY_RANK[rank - 1] ?? GLOW_FLOOR;
}

export type BuildingLight = {
  readonly bestRank: number;
  readonly glow: number;
  readonly results: readonly SearchResult[];
};

export type Lighting = {
  readonly byBuilding: ReadonlyMap<string, BuildingLight>;
  readonly elsewhere: readonly SearchResult[];
};

function hostOf(url: string): string | null {
  return URL.canParse(url) ? new URL(url).hostname : null;
}

export function lightUp(response: SearchResponse, buildings: readonly Building[]): Lighting {
  const buildingByHost = new Map(
    buildings.flatMap((building) =>
      building.places.map((place) => [place.host, building] as const),
    ),
  );
  const grouped = new Map<string, SearchResult[]>();
  const elsewhere: SearchResult[] = [];
  for (const result of [...response.results].sort((a, b) => a.rank - b.rank)) {
    const host = hostOf(result.profile.source_url);
    const building = host === null ? undefined : buildingByHost.get(host);
    if (building === undefined) {
      elsewhere.push(result);
    } else {
      grouped.set(building.key, [...(grouped.get(building.key) ?? []), result]);
    }
  }
  const byBuilding = new Map<string, BuildingLight>();
  for (const [key, results] of grouped) {
    const bestRank = results[0]?.rank ?? Number.POSITIVE_INFINITY;
    byBuilding.set(key, { bestRank, glow: rankToGlow(bestRank), results });
  }
  return { byBuilding, elsewhere };
}
