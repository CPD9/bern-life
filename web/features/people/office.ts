// Your office: where it stands (W5's plot), how it is furnished (W6a's layout), and who may visit.
// The shapes belong to the world lanes; this only checks they are JSON objects of a sane size.
import { VISIBILITIES, type Visibility } from "@/features/accounts/input";

export type Json = Record<string, unknown> | unknown[];

export type OfficeInput = {
  plot: Record<string, unknown> | null;
  layout: Json | null;
  visitVisibility: Visibility;
};

// The database refuses larger values too (user_profile_office_size).
export const OFFICE_BYTES_MAX = { plot: 2048, layout: 16384 } as const;

function fits(value: unknown, max: number): boolean {
  return new TextEncoder().encode(JSON.stringify(value)).length <= max;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseOffice(body: unknown): OfficeInput | null {
  if (!isObject(body)) return null;
  const plot = body.plot ?? null;
  const layout = body.layout ?? null;
  const visitVisibility = VISIBILITIES.find((v) => v === (body.visitVisibility ?? "private"));
  if (visitVisibility === undefined) return null;
  if (plot !== null && !(isObject(plot) && fits(plot, OFFICE_BYTES_MAX.plot))) return null;
  const layoutOk = isObject(layout) || Array.isArray(layout);
  if (layout !== null && !(layoutOk && fits(layout, OFFICE_BYTES_MAX.layout))) return null;
  return { plot, layout: layout as Json | null, visitVisibility };
}
