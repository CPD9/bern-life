// What a player tells us about themselves. The fields follow S1's UserProfile (role, goal,
// visibility; expertise comes with its own step), so a signed-in player's answers can later move
// to their account as is.

export const roleOptions = [
  { id: "researcher", label: "Researcher", hint: "You work at a university, institute or lab." },
  {
    id: "practitioner",
    label: "Practitioner",
    hint: "You apply research in a clinic, firm or field.",
  },
  { id: "company", label: "Company or start-up", hint: "You build a product or run a business." },
  { id: "public-body", label: "Canton or public body", hint: "You work for the public sector." },
  { id: "student", label: "Student", hint: "You study and look for a project or a first job." },
] as const;

export const goalOptions = [
  { id: "collaborator", label: "Find a collaborator", hud: "Find a collaborator" },
  { id: "funding", label: "Find funding or a call", hud: "Find funding" },
  { id: "test-site", label: "Find a test site or data", hud: "Find a test site" },
  { id: "hiring", label: "Hire or be hired", hud: "Hire or be hired" },
  { id: "share", label: "Share an idea or a datasheet", hud: "Share an idea" },
] as const;

export const visibilityOptions = [
  { id: "private", label: "Only me", hint: "Your profile is kept to you. This is the default." },
  {
    id: "members",
    label: "People who join Bern Life",
    hint: "Once you have an account, members can see your profile. Never the public.",
  },
] as const;

export type Role = (typeof roleOptions)[number]["id"];
export type Goal = (typeof goalOptions)[number]["id"];
export type Visibility = (typeof visibilityOptions)[number]["id"];

export type Profile = {
  readonly role: Role | null;
  readonly goal: Goal | null;
  readonly visibility: Visibility;
};

export const emptyProfile: Profile = {
  role: null,
  goal: null,
  visibility: "private",
};

export function goalLabel(goal: Goal | null): string | null {
  return goalOptions.find((option) => option.id === goal)?.hud ?? null;
}

function idFrom<Id extends string>(options: readonly { id: Id }[], value: unknown): Id | null {
  return options.find((option) => option.id === value)?.id ?? null;
}

/** Unknown or damaged fields fall back to the empty answer; visibility can only stay private. */
export function parseProfile(value: unknown): Profile {
  const fields = (typeof value === "object" && value !== null ? value : {}) as Record<
    string,
    unknown
  >;
  return {
    role: idFrom(roleOptions, fields.role),
    goal: idFrom(goalOptions, fields.goal),
    visibility: idFrom(visibilityOptions, fields.visibility) ?? "private",
  };
}
