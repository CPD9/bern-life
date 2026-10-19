// The profile kinds a loop can be narrowed to, in the contract's order, with the words the screen
// and the notifications use for them.
import type { Profile } from "@/infrastructure/contract-types.generated";

export type Kind = Profile["kind"];

export const allKinds: readonly Kind[] = [
  "person",
  "unit",
  "project",
  "infrastructure",
  "call",
  "service",
  "space",
];

export const kindNames: Record<Kind, string> = {
  person: "person",
  unit: "unit",
  project: "project",
  infrastructure: "infrastructure",
  call: "funding call",
  service: "service",
  space: "space",
};

export const kindLabels: Record<Kind, string> = {
  person: "People",
  unit: "Units",
  project: "Projects",
  infrastructure: "Infrastructure",
  call: "Funding calls",
  service: "Services",
  space: "Spaces",
};

export function isKind(value: unknown): value is Kind {
  return allKinds.some((kind) => kind === value);
}

export function kindsText(kinds: readonly Kind[]): string {
  return kinds.length === 0 ? "All kinds" : kinds.map((kind) => kindLabels[kind]).join(", ");
}
