// A place's panel: the units in the building with their verbatim addresses, and, after a search,
// the results found there. People from public pages appear only here, as entries with sources:
// the same result card as Ask, so every claim opens its evidence; fixture results get a plain list.
// Walked in through the door, the same panel is the place's lobby, and you leave it by going outside.

import { useEffect, useRef } from "react";
import { type AppEventSink, appEvents } from "@/infrastructure/app-events";
import { ResultCard } from "@/infrastructure/ui/result-card";
import { type Building } from "./buildings";
import { type BuildingLight, type SearchResult } from "./light";
import { KIND_LABELS } from "./markers/place-markers";
import { type Place } from "./places";

const LINK = "text-primary font-bold underline underline-offset-2";

function PlaceEntry({ place }: { place: Place }) {
  return (
    <li className="flex flex-col gap-1">
      <p className="text-ink font-extrabold">{place.name}</p>
      <p className="text-muted text-sm">{KIND_LABELS[place.kind]}</p>
      {place.position_method === "address" ? (
        <p className="text-sm">
          {place.address}{" "}
          <a href={place.address_url} target="_blank" rel="noreferrer" className={LINK}>
            Source page
          </a>
        </p>
      ) : (
        <p className="text-sm">
          No address of its own on its pages; placed in its district.{" "}
          <a href={`https://${place.host}/`} target="_blank" rel="noreferrer" className={LINK}>
            Website
          </a>
        </p>
      )}
    </li>
  );
}

/** Fixture results point at /fixture/ paths that do not exist, so their source is text, not a link. */
function FixtureMatch({ result }: { result: SearchResult }) {
  const role = result.profile.fields.role[0]?.value;
  return (
    <li className="flex flex-col gap-1">
      <p className="text-ink flex items-center gap-2 font-extrabold">
        <span className="rounded-pill bg-primary text-primary-ink min-w-6 px-1.5 text-center text-xs leading-6">
          {result.rank}
        </span>
        {result.profile.name.value}
      </p>
      {role !== undefined && <p className="text-muted text-sm">{role}</p>}
      <p className="text-sm">
        <span className="text-muted">Why it matches: </span>
        {result.reason.text}
      </p>
      <p className="text-muted text-xs break-all">
        Fixture source, not a real page: {result.profile.source_url}
      </p>
    </li>
  );
}

function panelHeading(building: Building, lobby: boolean): string {
  const units = building.places.length > 1 ? `${building.places.length} units here` : null;
  if (lobby) return units === null ? "Lobby" : `Lobby: ${units}`;
  return units ?? "Place";
}

type PanelProps = {
  building: Building;
  light: BuildingLight | undefined;
  fixture: boolean;
  onClose: () => void;
  /** Starts a question about this place in Ask; absent when nothing can take it. */
  onSearchHere: ((building: Building) => void) | undefined;
  /** Walks you to the place's door; present in walk mode, outside the lobby. */
  onWalkHere?: ((building: Building) => void) | undefined;
  /** Opened by walking in through the door. */
  lobby?: boolean;
  events?: AppEventSink;
};

export function PlacePanel({
  building,
  light,
  fixture,
  onClose,
  onSearchHere,
  onWalkHere,
  lobby = false,
  events = appEvents,
}: PanelProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = `place-${building.key.replace(/[^a-z0-9]+/gi, "-")}`;

  useEffect(() => heading.current?.focus(), [building.key]);
  // Opening a place is how the story's "enter the lobby" step is done.
  useEffect(() => {
    events.emit("lobby_entered");
  }, [building.key, events]);

  return (
    <section
      data-place-panel
      aria-labelledby={headingId}
      className="bg-panel shadow-panel border-panel-border rounded-panel absolute inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-20 flex max-h-[45vh] flex-col gap-4 overflow-y-auto border p-5 sm:inset-x-auto sm:top-24 sm:right-4 sm:bottom-auto sm:max-h-[calc(100vh-12rem)] sm:w-96"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={headingId} ref={heading} tabIndex={-1} className="text-lg font-extrabold">
          {panelHeading(building, lobby)}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-pill bg-chip px-3 py-1 text-sm font-bold"
        >
          {lobby ? "Go outside" : "Close"}
        </button>
      </div>
      {(onSearchHere !== undefined || (onWalkHere !== undefined && !lobby)) && (
        <div className="flex flex-wrap gap-2">
          {onSearchHere !== undefined && (
            <button
              type="button"
              onClick={() => onSearchHere(building)}
              className="bg-primary text-primary-ink rounded-pill px-4 py-1.5 text-sm font-bold"
            >
              Search here
            </button>
          )}
          {onWalkHere !== undefined && !lobby && (
            <button
              type="button"
              onClick={() => onWalkHere(building)}
              className="bg-chip rounded-pill px-4 py-1.5 text-sm font-bold"
            >
              Walk here
            </button>
          )}
        </div>
      )}
      {light !== undefined && (
        <div className="flex flex-col gap-3">
          <h3 className="font-extrabold">
            {light.results.length === 1 ? "1 match here" : `${light.results.length} matches here`}
            {fixture && (
              <span className="rounded-pill bg-chip ml-2 px-2 py-0.5 align-middle text-xs">
                FIXTURE
              </span>
            )}
          </h3>
          <ul className="flex flex-col gap-4">
            {light.results.map((result) =>
              fixture ? (
                <FixtureMatch key={result.profile.id} result={result} />
              ) : (
                <li key={result.profile.id}>
                  <ResultCard result={result} />
                </li>
              ),
            )}
          </ul>
        </div>
      )}
      <ul className="flex flex-col gap-4">
        {building.places.map((place) => (
          <PlaceEntry key={place.id} place={place} />
        ))}
      </ul>
      <p className="text-muted text-xs">
        Position placed by hand from the address; approximate (street level).
      </p>
    </section>
  );
}
