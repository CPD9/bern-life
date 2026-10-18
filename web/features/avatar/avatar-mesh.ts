// Turns the five choices into sizes and colours for the figure's primitives. Kept apart from the
// three.js scene so the mapping can be checked exactly without a renderer. Units are metres.

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
  readonly head: { readonly radius: number; readonly colour: string };
  readonly hair: { readonly style: HairId; readonly colour: string };
  readonly shoes: string;
  readonly coat: { readonly length: number; readonly colour: string } | null;
  readonly vest: { readonly colour: string } | null;
  readonly tie: { readonly colour: string } | null;
};

type Build = { torso: number; legs: number; legGap: number; arms: number };

const BUILD: Readonly<Record<BodyId, Build>> = {
  slim: { torso: 0.15, legs: 0.065, legGap: 0.04, arms: 0.05 },
  medium: { torso: 0.18, legs: 0.075, legGap: 0.045, arms: 0.055 },
  broad: { torso: 0.22, legs: 0.09, legGap: 0.055, arms: 0.065 },
};

const TORSO_LENGTH = 0.32;
const LEG_LENGTH = 0.52;
const ARM_LENGTH = 0.44;
const HEAD_RADIUS = 0.17;
const HAIR_COLOUR = "#3b2a20";
const SHOES = "#2b2f36";

/** The outfit sets the top and trousers; the accent goes where that outfit shows colour. */
function clothes(outfit: OutfitId, accent: string) {
  switch (outfit) {
    case "casual":
      return { top: accent, trousers: "#3b5b85", coat: null, vest: null, tie: null };
    case "office":
      return { top: "#3a4656", trousers: "#2b2f36", coat: null, vest: null, tie: accent };
    case "lab-coat":
      return {
        top: accent,
        trousers: "#4a5260",
        coat: { length: 0.62, colour: "#f4f6f8" },
        vest: null,
        tie: null,
      };
    case "field-work":
      return {
        top: "#6b7b4a",
        trousers: "#9c8a6a",
        coat: null,
        vest: { colour: accent },
        tie: null,
      };
  }
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
    head: { radius: HEAD_RADIUS, colour: skin },
    hair: { style: config.hair, colour: config.hair === "covered" ? accent : HAIR_COLOUR },
    shoes: SHOES,
    coat: outfit.coat,
    vest: outfit.vest,
    tie: outfit.tie === null ? null : { colour: outfit.tie },
  };
}
