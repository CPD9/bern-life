// One line over the map that says what the light means: a search is running, or how many results
// are lit at how many places, how many have no place on the map, and a way back to the quiet city.
// On a phone it sits under the HUD's measured bottom, which the shell writes as `--hud-bottom`.

import { type Lighting } from "./light";
import { type WorldSearchState } from "./world-search";

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function summaryText(state: WorldSearchState, lighting: Lighting | null): string | null {
  if (state.status === "idle") return null;
  if (state.status === "searching") return "Searching…";
  if (state.response.abstained) return "No verifiable source for this search";
  const lit = lighting?.byBuilding.size ?? 0;
  const placed = [...(lighting?.byBuilding.values() ?? [])].reduce(
    (sum, light) => sum + light.results.length,
    0,
  );
  const elsewhere = lighting?.elsewhere.length ?? 0;
  const base = `${plural(placed, "match", "matches")} at ${plural(lit, "place", "places")}`;
  return elsewhere > 0 ? `${base} · ${elsewhere} not on the map` : base;
}

export function SearchSummary({
  state,
  lighting,
  onClear,
}: {
  state: WorldSearchState;
  lighting: Lighting | null;
  onClear: () => void;
}) {
  const text = summaryText(state, lighting);
  const fixture = state.status === "results" && state.response.versions.snapshot === "fixture";
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-[calc(var(--hud-bottom,5.5rem)+0.5rem)] z-20 sm:top-20 flex justify-center px-4"
    >
      {text !== null && (
        <p className="rounded-pill bg-panel shadow-panel pointer-events-auto flex items-center gap-3 py-1.5 pr-1.5 pl-4 text-sm font-bold">
          {text}
          {fixture && <span className="rounded-pill bg-chip px-2 py-0.5 text-xs">Sample data</span>}
          {state.status === "results" && (
            <button type="button" onClick={onClear} className="rounded-pill bg-chip px-3 py-1">
              Clear
            </button>
          )}
        </p>
      )}
    </div>
  );
}
