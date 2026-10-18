// Turns a bear config into the colours of each part. Kept free of three.js so it can be checked
// exactly with Bun. Eye colour is chosen by contrast with what surrounds the eyes (fur, or a
// panda's dark patches), so every face reads, whatever the fur.

import { type BearConfig, type KindId, furOptions } from "./bear-config";

export type BearLook = {
  readonly fur: string;
  readonly muzzle: string;
  readonly belly: string;
  readonly limbs: string;
  readonly ears: string;
  readonly innerEars: string;
  readonly nose: string;
  readonly eyes: string;
  /** A panda's dark eye patches. */
  readonly eyePatches: string | null;
  /** A red panda's white brows and cheeks. */
  readonly faceMarks: string | null;
  readonly horns: string | null;
};

export const DARK_EYES = "#2a2226";
export const LIGHT_EYES = "#f6eee4";
const NOSE = "#3a2a26";

type KindLook = Omit<BearLook, "fur" | "eyes" | "limbs" | "ears"> & {
  readonly limbs: string | null;
  readonly ears: string | null;
};

const KIND_LOOK: Readonly<Record<KindId, (fur: string) => KindLook>> = {
  "brown-bear": () => ({
    muzzle: "#ecd3ad",
    belly: "#ecd3ad",
    limbs: null,
    ears: null,
    innerEars: "#e3b994",
    nose: NOSE,
    eyePatches: null,
    faceMarks: null,
    horns: null,
  }),
  "polar-bear": () => ({
    muzzle: "#fbf8f1",
    belly: "#fbf8f1",
    limbs: null,
    ears: null,
    innerEars: "#e7d3c8",
    nose: "#2f2b2c",
    eyePatches: null,
    faceMarks: null,
    horns: null,
  }),
  panda: (fur) => {
    const dark = fur === "#efe6da" ? "#5b4334" : "#2b2a2e";
    return {
      muzzle: "#fbfaf6",
      belly: fur,
      limbs: dark,
      ears: dark,
      innerEars: dark,
      nose: "#2b2a2e",
      eyePatches: dark,
      faceMarks: null,
      horns: null,
    };
  },
  "red-panda": () => ({
    muzzle: "#f6efe6",
    belly: "#3a2420",
    limbs: "#3a2420",
    ears: null,
    innerEars: "#f6efe6",
    nose: "#2b2224",
    eyePatches: null,
    faceMarks: "#f6efe6",
    horns: null,
  }),
  marmot: () => ({
    muzzle: "#e8d6bd",
    belly: "#e8d6bd",
    limbs: "#6b5444",
    ears: null,
    innerEars: "#6b5444",
    nose: NOSE,
    eyePatches: null,
    faceMarks: null,
    horns: null,
  }),
  ibex: () => ({
    muzzle: "#e9dcc6",
    belly: "#e9dcc6",
    limbs: "#6f604f",
    ears: null,
    innerEars: "#e3c9b2",
    nose: NOSE,
    eyePatches: null,
    faceMarks: null,
    horns: "#e3d9c8",
  }),
};

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => channel(parseInt(hex.slice(start, start + 2), 16)));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** The eye colour that stands out more against the given background. */
export function eyesOn(background: string): string {
  return contrast(DARK_EYES, background) >= contrast(LIGHT_EYES, background)
    ? DARK_EYES
    : LIGHT_EYES;
}

export function bearLook(config: BearConfig): BearLook {
  const fur = furOptions(config.kind).find((option) => option.id === config.fur)?.colour;
  if (fur === undefined) throw new Error(`no fur "${config.fur}" for ${config.kind}`);
  const kind = KIND_LOOK[config.kind](fur);
  return {
    ...kind,
    fur,
    limbs: kind.limbs ?? fur,
    ears: kind.ears ?? fur,
    eyes: eyesOn(kind.eyePatches ?? fur),
  };
}
