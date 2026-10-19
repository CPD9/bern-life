// How far each place is from a plot. There is no geodata service: distances are straight lines on
// the map frame, where 1 unit ≈ 20 m, rounded to 50 m and always shown as approximate. Only places
// with an address from their own page are listed, because a place without one sits at its
// district's centre and a distance to it would be a guess.

export const METRES_PER_UNIT = 20;
const ROUND_TO_METRES = 50;
export const NEARBY_COUNT = 5;

type Point = { readonly x: number; readonly z: number };

/** A place as the world's places.json stores it; the address fields are null without an address. */
export type MapPlace = Point & {
  readonly id: string;
  readonly name: string;
  readonly address_span: string | null;
  readonly address_url: string | null;
  readonly address_fetched_at: string | null;
};

export type SourcedAddress = {
  readonly span: string;
  readonly url: string;
  readonly fetchedAt: string | null;
};

export type NearbyPlace = {
  readonly id: string;
  readonly name: string;
  readonly address: SourcedAddress;
  readonly metres: number;
};

export function approximateMetres(from: Point, to: Point): number {
  const metres = Math.hypot(to.x - from.x, to.z - from.z) * METRES_PER_UNIT;
  return Math.round(metres / ROUND_TO_METRES) * ROUND_TO_METRES;
}

export function distanceLabel(metres: number): string {
  if (metres < ROUND_TO_METRES) return `under ${ROUND_TO_METRES} m`;
  return `about ${metres.toLocaleString("en-GB")} m`;
}

function sourcedAddress(place: MapPlace): SourcedAddress | null {
  if (place.address_span === null || place.address_url === null) return null;
  return { span: place.address_span, url: place.address_url, fetchedAt: place.address_fetched_at };
}

/** The nearest places with a sourced address, by rounded distance and then by id. */
export function nearbyPlaces(
  plot: Point,
  places: readonly MapPlace[],
  count = NEARBY_COUNT,
): readonly NearbyPlace[] {
  const sourced = places.flatMap((place) => {
    const address = sourcedAddress(place);
    if (address === null) return [];
    const metres = approximateMetres(plot, place);
    return [{ id: place.id, name: place.name, address, metres }];
  });
  sourced.sort((a, b) => a.metres - b.metres || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return sourced.slice(0, count);
}

const BERN_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Zurich",
});

/** The day a page was fetched, in Bern. */
export function fetchedOn(iso: string): string {
  return BERN_DATE.format(new Date(iso));
}
