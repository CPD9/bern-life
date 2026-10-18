// Turns the five choices into sizes and colours for the figure's primitives. Kept apart from the
// three.js scene so the mapping can be checked exactly without a renderer. The proportions are a
// friendly toy figure: a big head, a small torso, short wide legs, big hands and chunky shoes.

import {
  type AvatarConfig,
  type BodyId,
  type HairId,
  type OutfitId,
  accentOptions,
  skinOptions,
} from "./avatar-config";

type Limb = { readonly radius: number; readonly length: number; readonly colour: string };

export type MeshParameters = {
  readonly torso: Limb;
  readonly legs: Limb & { readonly gap: number };
  readonly arms: Limb;
  readonly hands: { readonly radius: number; readonly colour: string };
  readonly head: { readonly radius: number; readonly colour: string };
  /** Dark on lighter skin, light on the deepest tones, so the closed eyes always show. */
  readonly eyes: string;
  readonly hair: { readonly style: HairId; readonly colour: string };
  readonly shoes: string;
  readonly coat: { readonly length: number; readonly colour: string } | null;
  readonly vest: { readonly colour: string } | null;
  readonly tie: { readonly colour: string } | null;
};

type Build = { torso: number; legs: number; legGap: number; arms: number; hands: number };

const BUILD: Readonly<Record<BodyId, Build>> = {
  slim: { torso: 0.15, legs: 0.085, legGap: 0.05, arms: 0.05, hands: 0.08 },
  medium: { torso: 0.18, legs: 0.1, legGap: 0.06, arms: 0.055, hands: 0.09 },
  broad: { torso: 0.22, legs: 0.12, legGap: 0.07, arms: 0.065, hands: 0.1 },
};

const TORSO_LENGTH = 0.12;
const LEG_LENGTH = 0.1;
const ARM_LENGTH = 0.14;
const HEAD_RADIUS = 0.3;
const HAIR_COLOUR = "#3b2a20";
const DARK_EYES = "#2a2226";
const LIGHT_EYES = "#f4e9df";
/** Skin tones from this index on are deep enough that dark eye lines would disappear. */
const FIRST_DEEP_TONE = 7;

/** The outfit sets the top and trousers; the accent goes where that outfit shows colour. */
function clothes(outfit: OutfitId, accent: string) {
  switch (outfit) {
    case "casual":
      return {
        top: accent,
        trousers: "#3b5b85",
        shoes: "#f2efe9",
        coat: null,
        vest: null,
        tie: null,
      };
    case "office":
      return {
        top: "#3a4656",
        trousers: "#2b2f36",
        shoes: "#4a3426",
        coat: null,
        vest: null,
        tie: accent,
      };
    case "lab-coat":
      return {
        top: accent,
        trousers: "#4a5260",
        shoes: "#5b6b7d",
        coat: { length: 0.42, colour: "#f4f6f8" },
        vest: null,
        tie: null,
      };
    case "field-work":
      return {
        top: "#6b7b4a",
        trousers: "#9c8a6a",
        shoes: "#7a5a3c",
        coat: null,
        vest: { colour: accent },
        tie: null,
      };
  }
}

/** A covering or hood is clothing, so it takes the accent colour instead of hair colour. */
const wornHair: ReadonlySet<HairId> = new Set(["covered", "hood"]);

function skinIndex(id: string): number {
  return skinOptions.findIndex((option) => option.id === id);
}

function colourOf(options: readonly { id: string; colour: string }[], id: string): string {
  const colour = options.find((option) => option.id === id)?.colour;
  if (colour === undefined) throw new Error(`no colour for option "${id}"`);
  return colour;
}

export function meshParameters(config: AvatarConfig): MeshParameters {
  const build = BUILD[config.body];
  const skin = colourOf(skinOptions, config.skin);
  const accent = colourOf(accentOptions, config.accent);
  const outfit = clothes(config.outfit, accent);

  return {
    torso: { radius: build.torso, length: TORSO_LENGTH, colour: outfit.top },
    legs: { radius: build.legs, length: LEG_LENGTH, gap: build.legGap, colour: outfit.trousers },
    arms: { radius: build.arms, length: ARM_LENGTH, colour: outfit.coat?.colour ?? outfit.top },
    hands: { radius: build.hands, colour: skin },
    head: { radius: HEAD_RADIUS, colour: skin },
    eyes: skinIndex(config.skin) >= FIRST_DEEP_TONE ? LIGHT_EYES : DARK_EYES,
    hair: { style: config.hair, colour: wornHair.has(config.hair) ? accent : HAIR_COLOUR },
    shoes: outfit.shoes,
    coat: outfit.coat,
    vest: outfit.vest,
    tie: outfit.tie === null ? null : { colour: outfit.tie },
  };
}
