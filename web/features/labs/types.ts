export type LabRole = "lead" | "member";

export type Person = { handle: string; displayName: string };

export type LabSummary = {
  id: string;
  name: string;
  unit: string | null;
  description: string | null;
  role: LabRole;
};

/** A public profile from the engine shown as a card: never an account, never an avatar.
 *  `name` and `sourceUrl` are null when a later bundle no longer has the profile. */
export type Listing = {
  profileId: string;
  name: string | null;
  kind: string | null;
  sourceUrl: string | null;
  addedBy: Person;
};

export type LabDetail = Omit<LabSummary, "role"> & {
  members: (Person & { role: LabRole; acceptedAt: string })[];
  listings: Listing[];
};

export type LabInput = { name: string; unit: string | null; description: string | null };
