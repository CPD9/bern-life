// Every building gets the same marker, whatever the size of the units inside: fair discoverability
// by construction. Markers are real buttons in the page, so they take focus, work with the keyboard
// and carry an accessible name. A search makes every marker breathe while it runs; then markers
// with results glow by their best rank and carry it as a badge, and the others step back.

import { type Building } from "../buildings";
import { type BuildingLight, type Lighting, UNLIT_OPACITY } from "../light";
import { type PlaceKind } from "../places";
import { type Anchor, type AnchorElements, registerAnchor } from "./anchors";
import { Pictogram } from "./pictogram";

const MARKER_HEIGHT = 4.6;

export const KIND_LABELS: Readonly<Record<PlaceKind, string>> = {
  institute: "Institute",
  platform: "Platform",
  centre: "Centre",
  agency: "Agency",
  space: "Space",
};

export function buildingLabel(building: Building): string {
  return building.places.map((place) => place.name).join(" · ");
}

export function markerAnchors(buildings: readonly Building[]): readonly Anchor[] {
  return buildings.map((building) => ({
    key: building.key,
    position: [building.x, MARKER_HEIGHT, building.z],
  }));
}

function markerName(building: Building, light: BuildingLight | undefined): string {
  const name = `${buildingLabel(building)} (${KIND_LABELS[building.kind]})`;
  if (light === undefined) return name;
  const matches = light.results.length === 1 ? "1 match" : `${light.results.length} matches`;
  return `${name}, ${matches}, best rank ${light.bestRank}`;
}

function glowShadow(glow: number): string {
  return `0 0 0 ${3 + 7 * glow}px rgb(47 179 107 / ${(0.25 + 0.45 * glow).toFixed(2)})`;
}

type MarkersProps = {
  buildings: readonly Building[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  elementsRef: AnchorElements;
  searching: boolean;
  lighting: Lighting | null;
};

export function PlaceMarkers({
  buildings,
  selectedKey,
  onSelect,
  elementsRef,
  searching,
  lighting,
}: MarkersProps) {
  return buildings.map((building) => {
    const count = building.places.length;
    const selected = building.key === selectedKey;
    const light = lighting?.byBuilding.get(building.key);
    const unlit = lighting !== null && light === undefined;
    return (
      <div
        key={building.key}
        ref={registerAnchor(elementsRef, building.key)}
        className="invisible absolute top-0 left-0"
      >
        <button
          type="button"
          data-building={building.key}
          aria-label={markerName(building, light)}
          aria-pressed={selected}
          onClick={() => onSelect(building.key)}
          style={{
            boxShadow: light === undefined ? undefined : glowShadow(light.glow),
            opacity: unlit ? UNLIT_OPACITY : undefined,
          }}
          className={`group bg-panel text-ink shadow-panel relative grid size-11 place-items-center rounded-full border-2 transition-transform hover:scale-110 ${
            selected || light !== undefined ? "border-primary" : "border-white"
          } ${selected ? "scale-110" : ""} ${searching ? "motion-safe:animate-pulse" : ""}`}
        >
          <Pictogram kind={building.kind} />
          {light !== undefined && (
            <span className="rounded-pill bg-primary text-primary-ink absolute -top-1.5 -left-1.5 min-w-5 px-1 text-xs leading-5 font-extrabold">
              {light.bestRank}
            </span>
          )}
          {count > 1 && (
            <span className="rounded-pill bg-chip-selected text-chip-selected-ink absolute -top-1.5 -right-1.5 min-w-5 px-1 text-xs leading-5 font-extrabold">
              {count}
            </span>
          )}
          <span className="rounded-pill bg-panel shadow-panel pointer-events-none absolute top-full left-1/2 mt-2 max-w-60 -translate-x-1/2 truncate px-3 py-1 text-sm font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
            {buildingLabel(building)}
          </span>
        </button>
      </div>
    );
  });
}
