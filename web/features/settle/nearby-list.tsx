// The nearest places to a plot, each with its address exactly as its own page gives it, the link
// to that page and the day it was fetched, so every fact here is one click from its source.

import { useId } from "react";
import { CorrectionNote } from "@/infrastructure/ui/claim-evidence";
import { distanceLabel, fetchedOn, type NearbyPlace } from "./nearby";

const LINK = "text-primary font-bold underline underline-offset-2";

export function NearbyList({
  places,
  district,
}: {
  places: readonly NearbyPlace[];
  district: string;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="font-extrabold">
        Nearest places to {district}
      </h3>
      <p className="text-muted text-sm">
        Only places with an address on their own page are listed. Distances are approximate:
        straight lines on the map, rounded to 50 m.
      </p>
      <ol className="flex flex-col gap-2">
        {places.map((place) => (
          <li key={place.id} className="bg-chip flex flex-col gap-1 rounded-2xl px-4 py-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-extrabold">{place.name}</span>
              <span className="text-muted font-bold whitespace-nowrap">
                {distanceLabel(place.metres)}
              </span>
            </div>
            <q cite={place.address.url} className="break-words">
              {place.address.span}
            </q>
            <p className="text-muted">
              <a
                href={place.address.url}
                target="_blank"
                rel="noopener noreferrer"
                className={LINK}
              >
                Source page
              </a>
              {place.address.fetchedAt !== null && (
                <>
                  {", fetched "}
                  <time dateTime={place.address.fetchedAt}>
                    {fetchedOn(place.address.fetchedAt)}
                  </time>
                </>
              )}
            </p>
            <CorrectionNote fetchedAt={place.address.fetchedAt} quoted="address" />
          </li>
        ))}
      </ol>
    </section>
  );
}
