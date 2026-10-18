// Every unit in sources/ is a place on the map. The address fields are copied verbatim from the
// unit's own contact block; x and z are placed by hand from that address and are approximate
// (street level), not survey data. A unit without its own address sits in its district.

import rawPlaces from "./places.json";

export type PlaceKind = "institute" | "platform" | "centre";

type PlaceCommon = {
  readonly id: string;
  readonly name: string;
  readonly source_id: string;
  readonly host: string;
  readonly kind: PlaceKind;
  readonly x: number;
  readonly z: number;
};

export type AddressedPlace = PlaceCommon & {
  readonly position_method: "address";
  readonly address: string;
  readonly address_url: string;
  readonly address_span: string;
  readonly address_fetched_at: string;
  readonly address_page_sha256: string;
};

export type DistrictPlace = PlaceCommon & {
  readonly position_method: "district";
  readonly address: null;
  readonly address_url: null;
  readonly address_span: null;
  readonly address_fetched_at: null;
  readonly address_page_sha256: null;
};

export type Place = AddressedPlace | DistrictPlace;

export class InvalidPlaceError extends Error {
  constructor(
    readonly index: number,
    readonly field: string,
  ) {
    super(`Invalid place at index ${index}: ${field}`);
    this.name = "InvalidPlaceError";
  }
}

const KINDS: readonly string[] = ["institute", "platform", "centre"];
const ADDRESS_FIELDS = [
  "address",
  "address_url",
  "address_span",
  "address_fetched_at",
  "address_page_sha256",
] as const;

type Fields = Readonly<Record<string, unknown>>;

function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function commonFields(fields: Fields, index: number): PlaceCommon {
  const { id, name, source_id, host, kind, x, z } = fields;
  if (typeof id !== "string" || !/^[a-z0-9-]+$/.test(id)) throw new InvalidPlaceError(index, "id");
  if (!nonEmpty(name)) throw new InvalidPlaceError(index, "name");
  if (!nonEmpty(source_id)) throw new InvalidPlaceError(index, "source_id");
  if (!nonEmpty(host)) throw new InvalidPlaceError(index, "host");
  if (typeof kind !== "string" || !KINDS.includes(kind)) throw new InvalidPlaceError(index, "kind");
  if (typeof x !== "number" || !Number.isFinite(x)) throw new InvalidPlaceError(index, "x");
  if (typeof z !== "number" || !Number.isFinite(z)) throw new InvalidPlaceError(index, "z");
  return { id, name, source_id, host, kind: kind as PlaceKind, x, z };
}

function addressedPlace(common: PlaceCommon, fields: Fields, index: number): AddressedPlace {
  const { address, address_url, address_span, address_fetched_at, address_page_sha256 } = fields;
  if (!nonEmpty(address_span)) throw new InvalidPlaceError(index, "address_span");
  if (!nonEmpty(address) || !address_span.includes(address)) {
    throw new InvalidPlaceError(index, "address");
  }
  if (
    typeof address_url !== "string" ||
    !URL.canParse(address_url) ||
    new URL(address_url).protocol !== "https:" ||
    new URL(address_url).hostname !== common.host
  ) {
    throw new InvalidPlaceError(index, "address_url");
  }
  if (typeof address_fetched_at !== "string" || Number.isNaN(Date.parse(address_fetched_at))) {
    throw new InvalidPlaceError(index, "address_fetched_at");
  }
  if (typeof address_page_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(address_page_sha256)) {
    throw new InvalidPlaceError(index, "address_page_sha256");
  }
  return {
    ...common,
    position_method: "address",
    address,
    address_url,
    address_span,
    address_fetched_at,
    address_page_sha256,
  };
}

function districtPlace(common: PlaceCommon, fields: Fields, index: number): DistrictPlace {
  const filled = ADDRESS_FIELDS.find((field) => fields[field] !== null);
  if (filled !== undefined) throw new InvalidPlaceError(index, filled);
  return {
    ...common,
    position_method: "district",
    address: null,
    address_url: null,
    address_span: null,
    address_fetched_at: null,
    address_page_sha256: null,
  };
}

export function parsePlaces(raw: unknown): readonly Place[] {
  if (!Array.isArray(raw)) throw new InvalidPlaceError(-1, "places");
  return raw.map((entry: unknown, index) => {
    if (!isFields(entry)) throw new InvalidPlaceError(index, "place");
    const common = commonFields(entry, index);
    if (entry.position_method === "address") return addressedPlace(common, entry, index);
    if (entry.position_method === "district") return districtPlace(common, entry, index);
    throw new InvalidPlaceError(index, "position_method");
  });
}

export const PLACES: readonly Place[] = parsePlaces(rawPlaces);
