import type { Claim, Profile, SearchResponse } from "./contract-types.generated";

export type SearchResult = SearchResponse["results"][number];

export type Via = NonNullable<SearchResult["via"]>;

export type ProfileField = keyof Profile["fields"];

export type ClaimRef = { readonly pointer: string; readonly claim: Claim };

export const fieldOrder: readonly ProfileField[] = [
  "role",
  "unit",
  "expertise",
  "projects",
  "infrastructure",
  "services",
  "funder",
  "deadline",
  "amount",
  "eligibility",
  "location",
  "size",
];

export const fieldLabels: Record<ProfileField, string> = {
  role: "Role",
  unit: "Unit",
  expertise: "Expertise",
  projects: "Projects",
  infrastructure: "Infrastructure",
  services: "Services",
  funder: "Funder",
  deadline: "Deadline",
  amount: "Amount",
  eligibility: "Eligibility",
  location: "Location",
  size: "Size",
};

function isField(name: string): name is ProfileField {
  return fieldOrder.some((field) => field === name);
}

/** Resolves a citation pointer such as `/name` or `/fields/expertise/0`. */
export function claimAt(profile: Profile, pointer: string): Claim | null {
  if (pointer === "/name") return profile.name;
  const [, root, field, index] = pointer.split("/");
  if (root !== "fields" || field === undefined || !isField(field)) return null;
  return profile.fields[field]?.[Number(index)] ?? null;
}

const viaPointer = /^\/via\/related_claims\/(\d+)$/;

/** A cited claim: the profile's own, or one of the project the result is shown through. */
function citedClaim(result: SearchResult, pointer: string): Claim | null {
  const related = viaPointer.exec(pointer);
  if (related) return result.via?.related_claims[Number(related[1])] ?? null;
  return claimAt(result.profile, pointer);
}

export function citedClaims(result: SearchResult): ClaimRef[] {
  return result.reason.cites.flatMap((pointer) => {
    const claim = citedClaim(result, pointer);
    return claim ? [{ pointer, claim }] : [];
  });
}

/**
 * A reason that cites no claim of the profile's own: only its name, which says nothing about the
 * question, or only the claims of the project it is shown through, which the card shows under
 * "Through". Either way the card leaves it out when a relation or a passage explains the result.
 */
export function citesNoOwnClaim(result: SearchResult): boolean {
  return result.reason.cites.every((pointer) => pointer === "/name" || viaPointer.test(pointer));
}

const relatedKinds = ["person", "unit", "project", "infrastructure"] as const;

/** The related profile's kind, read from its id prefix (the contract's id pattern fixes it). */
export function relatedKind(via: Via): (typeof relatedKinds)[number] {
  const prefix = via.related_profile_id.split("-")[0];
  return relatedKinds.find((kind) => kind === prefix) ?? "project";
}

/** The related profile's matching claims, keyed by their place in `via`. */
export function viaClaims(via: Via): ClaimRef[] {
  return via.related_claims.map((claim, index) => ({
    pointer: `/via/related_claims/${index}`,
    claim,
  }));
}

export function presentFields(profile: Profile): { field: ProfileField; claims: ClaimRef[] }[] {
  return fieldOrder
    .map((field) => ({
      field,
      claims: (profile.fields[field] ?? []).map((claim, index) => ({
        pointer: `/fields/${field}/${index}`,
        claim,
      })),
    }))
    .filter(({ claims }) => claims.length > 0);
}
