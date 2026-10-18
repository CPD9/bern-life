// A player's avatar is a little Bern bear, or a friend from the same family: five choices, each an
// id from a fixed list, so a stored config is plain JSON. Fur shades belong to their kind, so a
// polar bear can never be stored in panda colours.

type Option<Id extends string> = { readonly id: Id; readonly label: string };
type Swatch<Id extends string> = Option<Id> & { readonly colour: string };

const furShades = {
  "brown-bear": [
    { id: "honey", label: "Honey", colour: "#b97a45" },
    { id: "chestnut", label: "Chestnut", colour: "#8a5532" },
    { id: "cocoa", label: "Cocoa", colour: "#5e3b26" },
    { id: "golden", label: "Golden", colour: "#d4a05a" },
  ],
  "polar-bear": [
    { id: "snow", label: "Snow", colour: "#f3f1ea" },
    { id: "cream", label: "Cream", colour: "#ece2c8" },
    { id: "silver", label: "Silver", colour: "#d6dbe1" },
  ],
  panda: [
    { id: "classic", label: "Classic", colour: "#f5f3ee" },
    { id: "qinling", label: "Qinling", colour: "#efe6da" },
  ],
  "red-panda": [
    { id: "rust", label: "Rust", colour: "#c4552b" },
    { id: "auburn", label: "Auburn", colour: "#a8432a" },
    { id: "ginger", label: "Ginger", colour: "#d77a3c" },
  ],
  marmot: [
    { id: "hazel", label: "Hazel", colour: "#a9825a" },
    { id: "sand", label: "Sand", colour: "#c7a57a" },
    { id: "smoky", label: "Smoky", colour: "#7d6a58" },
  ],
  ibex: [
    { id: "fawn", label: "Fawn", colour: "#b49a78" },
    { id: "stone", label: "Stone", colour: "#8d7b66" },
  ],
} as const satisfies Record<string, readonly Swatch<string>[]>;

export const kindOptions = [
  { id: "brown-bear", label: "Bern bear" },
  { id: "polar-bear", label: "Polar bear" },
  { id: "panda", label: "Panda" },
  { id: "red-panda", label: "Red panda" },
  { id: "marmot", label: "Marmot" },
  { id: "ibex", label: "Ibex" },
] as const satisfies readonly Option<string>[];

export const faceOptions = [
  { id: "happy", label: "Happy" },
  { id: "bright", label: "Bright" },
  { id: "sleepy", label: "Sleepy" },
  { id: "wink", label: "Wink" },
] as const satisfies readonly Option<string>[];

export const outfitOptions = [
  { id: "casual", label: "Casual" },
  { id: "office", label: "Office" },
  { id: "lab-coat", label: "Lab coat" },
  { id: "field-work", label: "Field work" },
] as const satisfies readonly Option<string>[];

export const accessoryOptions = [
  { id: "none", label: "None" },
  { id: "scarf", label: "Scarf" },
  { id: "glasses", label: "Glasses" },
  { id: "hard-hat", label: "Hard hat" },
  { id: "backpack", label: "Backpack" },
] as const satisfies readonly Option<string>[];

export type KindId = (typeof kindOptions)[number]["id"];
export type FurId = (typeof furShades)[KindId][number]["id"];
export type FaceId = (typeof faceOptions)[number]["id"];
export type OutfitId = (typeof outfitOptions)[number]["id"];
export type AccessoryId = (typeof accessoryOptions)[number]["id"];

export type BearConfig = {
  readonly kind: KindId;
  readonly fur: FurId;
  readonly face: FaceId;
  readonly outfit: OutfitId;
  readonly accessory: AccessoryId;
};

export const defaultBear: BearConfig = {
  kind: "brown-bear",
  fur: "honey",
  face: "happy",
  outfit: "casual",
  accessory: "scarf",
};

export function furOptions(kind: KindId): readonly Swatch<FurId>[] {
  return furShades[kind];
}

/** Changing kind keeps every other choice and moves the fur to that kind's first shade. */
export function withKind(config: BearConfig, kind: KindId): BearConfig {
  const fur = furOptions(kind)[0]?.id ?? config.fur;
  return { ...config, kind, fur };
}

function pick<Id extends string>(options: readonly Option<Id>[], random: () => number): Id {
  const index = Math.min(Math.floor(random() * options.length), options.length - 1);
  const option = options[index];
  if (option === undefined) throw new Error("an option list is empty");
  return option.id;
}

/** Draws in a fixed order (kind, fur, face, outfit, accessory), so a seeded source is repeatable. */
export function shuffleBear(random: () => number): BearConfig {
  const kind = pick(kindOptions, random);
  return {
    kind,
    fur: pick(furOptions(kind), random),
    face: pick(faceOptions, random),
    outfit: pick(outfitOptions, random),
    accessory: pick(accessoryOptions, random),
  };
}

function idFrom<Id extends string>(options: readonly Option<Id>[], value: unknown): Id | null {
  return options.find((option) => option.id === value)?.id ?? null;
}

export function parseBear(value: unknown): BearConfig | null {
  if (typeof value !== "object" || value === null) return null;
  const fields = value as Record<string, unknown>;
  const kind = idFrom(kindOptions, fields.kind);
  if (kind === null) return null;
  const fur = idFrom(furOptions(kind), fields.fur);
  const face = idFrom(faceOptions, fields.face);
  const outfit = idFrom(outfitOptions, fields.outfit);
  const accessory = idFrom(accessoryOptions, fields.accessory);
  if (fur === null || face === null || outfit === null || accessory === null) return null;
  return { kind, fur, face, outfit, accessory };
}
