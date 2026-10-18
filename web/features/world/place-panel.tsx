import { useEffect, useRef } from "react";
import { type Building } from "./buildings";
import { KIND_LABELS } from "./markers/place-markers";
import { type Place } from "./places";

function PlaceEntry({ place }: { place: Place }) {
  return (
    <li className="flex flex-col gap-1">
      <p className="text-ink font-extrabold">{place.name}</p>
      <p className="text-muted text-sm">{KIND_LABELS[place.kind]}</p>
      {place.position_method === "address" ? (
        <p className="text-sm">
          {place.address}{" "}
          <a
            href={place.address_url}
            target="_blank"
            rel="noreferrer"
            className="text-primary font-bold underline underline-offset-2"
          >
            Source page
          </a>
        </p>
      ) : (
        <p className="text-sm">
          No address of its own on its pages; placed in its district.{" "}
          <a
            href={`https://${place.host}/`}
            target="_blank"
            rel="noreferrer"
            className="text-primary font-bold underline underline-offset-2"
          >
            Website
          </a>
        </p>
      )}
    </li>
  );
}

export function PlacePanel({ building, onClose }: { building: Building; onClose: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = `place-${building.key.replace(/[^a-z0-9]+/gi, "-")}`;

  useEffect(() => heading.current?.focus(), [building.key]);

  return (
    <section
      data-place-panel
      aria-labelledby={headingId}
      className="bg-panel shadow-panel border-panel-border rounded-panel absolute inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-20 flex max-h-[45vh] flex-col gap-4 overflow-y-auto border p-5 sm:inset-x-auto sm:top-24 sm:bottom-auto sm:left-4 sm:max-h-[calc(100vh-12rem)] sm:w-96"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={headingId} ref={heading} tabIndex={-1} className="text-lg font-extrabold">
          {building.places.length > 1 ? `${building.places.length} units here` : "Place"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-pill bg-chip px-3 py-1 text-sm font-bold"
        >
          Close
        </button>
      </div>
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
