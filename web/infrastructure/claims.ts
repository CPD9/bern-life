import type { Claim, Profile, SearchResponse } from "./contract-types.generated";

export type SearchResult = SearchResponse["results"][number];

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

export function citedClaims(result: SearchResult): ClaimRef[] {
  return result.reason.cites.flatMap((pointer) => {
    const claim = claimAt(result.profile, pointer);
    return claim ? [{ pointer, claim }] : [];
  });
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
