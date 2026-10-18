// A player's avatar is five choices, each an id from a fixed list, so a stored config is plain JSON
// that any later store (the browser now, an account later) can keep and check.

type Option<Id extends string> = { readonly id: Id; readonly label: string };
type Swatch<Id extends string> = Option<Id> & { readonly colour: string };

export const bodyOptions = [
  { id: "slim", label: "Slim" },
  { id: "medium", label: "Medium" },
  { id: "broad", label: "Broad" },
] as const satisfies readonly Option<string>[];

export const skinOptions = [
  { id: "tone-1", label: "Tone 1, lightest", colour: "#f6dcc8" },
  { id: "tone-2", label: "Tone 2", colour: "#eccab0" },
  { id: "tone-3", label: "Tone 3", colour: "#e0b48f" },
  { id: "tone-4", label: "Tone 4", colour: "#d09c74" },
  { id: "tone-5", label: "Tone 5", colour: "#bd8560" },
  { id: "tone-6", label: "Tone 6", colour: "#a56d48" },
  { id: "tone-7", label: "Tone 7", colour: "#8a5536" },
  { id: "tone-8", label: "Tone 8", colour: "#6f4128" },
  { id: "tone-9", label: "Tone 9", colour: "#55301c" },
  { id: "tone-10", label: "Tone 10, deepest", colour: "#3d2214" },
] as const satisfies readonly Swatch<string>[];

export const hairOptions = [
  { id: "short", label: "Short" },
  { id: "long", label: "Long" },
  { id: "curly", label: "Curly" },
  { id: "bun", label: "Bun" },
  { id: "buzz", label: "Buzz" },
  { id: "covered", label: "Covered" },
] as const satisfies readonly Option<string>[];

export const outfitOptions = [
  { id: "casual", label: "Casual" },
  { id: "office", label: "Office" },
  { id: "lab-coat", label: "Lab coat" },
  { id: "field-work", label: "Field work" },
] as const satisfies readonly Option<string>[];

export const accentOptions = [
  { id: "green", label: "Green", colour: "#2f9e5f" },
  { id: "blue", label: "Blue", colour: "#2f74c9" },
  { id: "violet", label: "Violet", colour: "#7a52c7" },
  { id: "coral", label: "Coral", colour: "#e0674f" },
  { id: "amber", label: "Amber", colour: "#e0a030" },
  { id: "teal", label: "Teal", colour: "#1f9a9a" },
  { id: "rose", label: "Rose", colour: "#d4588a" },
  { id: "slate", label: "Slate", colour: "#56677a" },
] as const satisfies readonly Swatch<string>[];

export type BodyId = (typeof bodyOptions)[number]["id"];
export type SkinId = (typeof skinOptions)[number]["id"];
export type HairId = (typeof hairOptions)[number]["id"];
export type OutfitId = (typeof outfitOptions)[number]["id"];
export type AccentId = (typeof accentOptions)[number]["id"];

export type AvatarConfig = {
  readonly body: BodyId;
  readonly skin: SkinId;
  readonly hair: HairId;
  readonly outfit: OutfitId;
  readonly accent: AccentId;
};

export const defaultAvatar: AvatarConfig = {
  body: "medium",
  skin: "tone-4",
  hair: "short",
  outfit: "casual",
  accent: "green",
};

function pick<Id extends string>(options: readonly Option<Id>[], random: () => number): Id {
  const index = Math.min(Math.floor(random() * options.length), options.length - 1);
  const option = options[index];
  if (option === undefined) throw new Error("an option list is empty");
  return option.id;
}

/** Draws in a fixed order (body, skin, hair, outfit, accent), so a seeded source is repeatable. */
export function shuffleAvatar(random: () => number): AvatarConfig {
  return {
    body: pick(bodyOptions, random),
    skin: pick(skinOptions, random),
    hair: pick(hairOptions, random),
    outfit: pick(outfitOptions, random),
    accent: pick(accentOptions, random),
  };
}

function idFrom<Id extends string>(options: readonly Option<Id>[], value: unknown): Id | null {
  return options.find((option) => option.id === value)?.id ?? null;
}

export function parseAvatar(value: unknown): AvatarConfig | null {
  if (typeof value !== "object" || value === null) return null;
  const fields = value as Record<string, unknown>;
  const body = idFrom(bodyOptions, fields.body);
  const skin = idFrom(skinOptions, fields.skin);
  const hair = idFrom(hairOptions, fields.hair);
  const outfit = idFrom(outfitOptions, fields.outfit);
  const accent = idFrom(accentOptions, fields.accent);
  if (body === null || skin === null || hair === null || outfit === null || accent === null) {
    return null;
  }
  return { body, skin, hair, outfit, accent };
}
