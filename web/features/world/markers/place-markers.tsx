// Every building gets the same marker, whatever the size of the units inside: fair discoverability
// by construction. Markers are real buttons in the page, so they take focus, work with the keyboard
// and carry an accessible name.

import { type Building } from "../buildings";
import { type PlaceKind } from "../places";
import { type Anchor, type AnchorElements, registerAnchor } from "./anchors";
import { Pictogram } from "./pictogram";

const MARKER_HEIGHT = 4.6;

export const KIND_LABELS: Readonly<Record<PlaceKind, string>> = {
  institute: "Institute",
  platform: "Platform",
  centre: "Centre",
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

type MarkersProps = {
  buildings: readonly Building[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  elementsRef: AnchorElements;
};

export function PlaceMarkers({ buildings, selectedKey, onSelect, elementsRef }: MarkersProps) {
  return buildings.map((building) => {
    const count = building.places.length;
    const selected = building.key === selectedKey;
    return (
      <div
        key={building.key}
        ref={registerAnchor(elementsRef, building.key)}
        className="invisible absolute top-0 left-0"
      >
        <button
          type="button"
          data-building={building.key}
          aria-label={`${buildingLabel(building)} (${KIND_LABELS[building.kind]})`}
          aria-pressed={selected}
          onClick={() => onSelect(building.key)}
          className={`group bg-panel text-ink shadow-panel relative grid size-11 place-items-center rounded-full border-2 transition-transform hover:scale-110 ${
            selected ? "border-primary scale-110" : "border-white"
          }`}
        >
          <Pictogram kind={building.kind} />
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
