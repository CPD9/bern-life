// The sources in sources/ that are not places on the map, each with its reason. A source leaves
// the map only by an entry here, so a new source without a place fails places.test.ts instead of
// silently missing from the world.

import rawOffMap from "./off-map.json";

/** `outside-bern`: the organisation is elsewhere (SIP in Biel/Bienne). `no-stored-address`: no
 * stored page of its host carries a street address, and an address is never typed from memory. */
export type OffMapReason = "outside-bern" | "no-stored-address";

export type OffMapSource = {
  readonly source_id: string;
  readonly host: string;
  readonly reason: OffMapReason;
};

export class InvalidOffMapError extends Error {
  constructor(
    readonly index: number,
    readonly field: string,
  ) {
    super(`Invalid off-map source at index ${index}: ${field}`);
    this.name = "InvalidOffMapError";
  }
}

const REASONS: readonly string[] = ["outside-bern", "no-stored-address"];

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function parseOffMap(raw: unknown): readonly OffMapSource[] {
  if (!Array.isArray(raw)) throw new InvalidOffMapError(-1, "sources");
  return raw.map((entry: unknown, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new InvalidOffMapError(index, "source");
    }
    const { source_id, host, reason } = entry as Readonly<Record<string, unknown>>;
    if (!nonEmpty(source_id)) throw new InvalidOffMapError(index, "source_id");
    if (!nonEmpty(host)) throw new InvalidOffMapError(index, "host");
    if (typeof reason !== "string" || !REASONS.includes(reason)) {
      throw new InvalidOffMapError(index, "reason");
    }
    return { source_id, host, reason: reason as OffMapReason };
  });
}

export const OFF_MAP: readonly OffMapSource[] = parseOffMap(rawOffMap);
