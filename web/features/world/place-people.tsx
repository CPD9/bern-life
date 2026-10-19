// The left card of a place: the person profiles whose page is on one of the building's hosts,
// read from the loaded snapshot without a search. Every line is a stored claim (name, role, unit)
// and every person links to the page it was read from; a person from a public page is not an
// account, so that page is the only contact. Fixture people point at /fixture/ paths that do not
// exist, so their source is text, not a link.

import { useEffect, useState } from "react";
import { parsePlacePeople } from "@/infrastructure/contract";
import type { PlacePeople, Profile } from "@/infrastructure/contract-types.generated";
import { type Building } from "./buildings";
import { type Place } from "./places";

const LINK = "text-primary font-bold underline underline-offset-2";

export type LoadPlacePeople = (place: Place) => Promise<PlacePeople | null>;

export const fetchPlacePeople: LoadPlacePeople = async (place) => {
  const path = `/api/places/${encodeURIComponent(place.source_id)}/${encodeURIComponent(place.host)}/people`;
  try {
    const response = await fetch(path);
    return response.ok ? parsePlacePeople(await response.json()) : null;
  } catch {
    return null;
  }
};

type Group = { readonly place: Place; readonly people: PlacePeople };
type State =
  | { readonly status: "loading" }
  | { readonly status: "error" }
  | { readonly status: "ready"; readonly groups: readonly Group[] };
/** An answer belongs to the building it was asked for; any other building is still loading. */
type Answer = { readonly key: string; readonly state: State };

/** One place per source and host: units on the same host would list the same people twice. */
function distinctHosts(building: Building): readonly Place[] {
  const seen = new Set<string>();
  return building.places.filter((place) => {
    const key = `${place.source_id}/${place.host}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function Person({ profile, fixture }: { profile: Profile; fixture: boolean }) {
  const role = profile.fields.role[0]?.value;
  const unit = profile.fields.unit[0]?.value;
  return (
    <li className="flex flex-col gap-0.5">
      <p className="text-ink font-extrabold">{profile.name.value}</p>
      {role !== undefined && <p className="text-muted text-sm">{role}</p>}
      {unit !== undefined && <p className="text-sm">{unit}</p>}
      {fixture ? (
        <p className="text-muted text-xs break-all">
          Fixture source, not a real page: {profile.source_url}
        </p>
      ) : (
        <p className="text-sm">
          <a href={profile.source_url} target="_blank" rel="noreferrer" className={LINK}>
            Source page
          </a>
        </p>
      )}
    </li>
  );
}

function countLine(people: PlacePeople): string {
  if (people.total > people.people.length) {
    return `${people.people.length} of ${people.total} listed`;
  }
  return people.total === 1 ? "1 person" : `${people.total} people`;
}

type PeopleCardProps = { building: Building; load?: LoadPlacePeople };

export function PeopleCard({ building, load = fetchPlacePeople }: PeopleCardProps) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const state: State =
    answer !== null && answer.key === building.key ? answer.state : { status: "loading" };

  useEffect(() => {
    let current = true;
    const places = distinctHosts(building);
    void Promise.all(places.map((place) => load(place))).then((answers) => {
      if (!current) return;
      if (answers.some((answer) => answer === null)) {
        setAnswer({ key: building.key, state: { status: "error" } });
        return;
      }
      const groups = places.map((place, index) => ({ place, people: answers[index]! }));
      setAnswer({ key: building.key, state: { status: "ready", groups } });
    });
    return () => {
      current = false;
    };
  }, [building, load]);

  const fixture =
    state.status === "ready" && state.groups.some((group) => group.people.snapshot === "fixture");
  const listed = state.status === "ready" ? state.groups.filter((g) => g.people.total > 0) : [];
  const several = state.status === "ready" && state.groups.length > 1;

  return (
    <section
      data-place-people
      aria-label="People here"
      className="bg-panel shadow-panel border-panel-border rounded-panel flex flex-col gap-4 border p-5 sm:max-h-[calc(100vh-12rem)] sm:w-80 sm:overflow-y-auto"
    >
      <h3 className="text-lg font-extrabold">
        People here
        {fixture && (
          <span className="rounded-pill bg-chip ml-2 px-2 py-0.5 align-middle text-xs">
            FIXTURE
          </span>
        )}
      </h3>
      {state.status === "loading" && <p className="text-muted text-sm">Loading profiles…</p>}
      {state.status === "error" && (
        <p className="text-muted text-sm">The profiles could not be loaded right now.</p>
      )}
      {state.status === "ready" && listed.length === 0 && (
        <p className="text-muted text-sm">No profiles listed for this unit yet</p>
      )}
      {listed.map(({ place, people }) => (
        <div key={place.id} className="flex flex-col gap-3">
          <p className="text-muted text-xs font-bold">
            {several ? `${place.name}: ` : ""}
            {countLine(people)}
          </p>
          <ul className="flex flex-col gap-3">
            {people.people.map((profile) => (
              <Person key={profile.id} profile={profile} fixture={fixture} />
            ))}
          </ul>
        </div>
      ))}
      {listed.length > 0 && (
        <p className="text-muted text-xs">
          From public pages; each person&apos;s contact is their source page.
        </p>
      )}
    </section>
  );
}
