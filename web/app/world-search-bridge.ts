// Ask drives the map: a question sent makes the places breathe, an answer lights the places that
// hold its results, a failure puts the city back to rest. The Navigator and the world never import
// each other; this mapping is the only place they meet.

import type { NavigatorState } from "@/features/navigator/use-navigator";
import type { Building } from "@/features/world/buildings";
import type { WorldSearch } from "@/features/world/world-search";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";

export type WorldAction =
  | { readonly kind: "begin" }
  | { readonly kind: "show"; readonly response: SearchResponse }
  | { readonly kind: "clear" };

/** Idle changes nothing, so a map lit at load (the demo fixture) stays lit until the first question. */
export function worldActionFor(state: NavigatorState): WorldAction | null {
  switch (state.status) {
    case "idle":
      return null;
    case "loading":
      return { kind: "begin" };
    case "done":
      return { kind: "show", response: state.response };
    case "failed":
      return { kind: "clear" };
  }
}

export function applyWorldAction(action: WorldAction | null, world: WorldSearch): void {
  if (action === null) return;
  if (action.kind === "begin") world.begin();
  else if (action.kind === "show") world.showResults(action.response);
  else world.clear();
}

/** "Search here" starts Ask with the units in the building; the player adds the topic. */
export function searchHereDraft(building: Building): string {
  return `${building.places.map((place) => place.name).join(" · ")}: `;
}
