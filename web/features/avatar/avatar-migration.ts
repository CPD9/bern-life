// Players who chose the earlier human figure keep a matching bear instead of losing their choice:
// a Bern bear whose fur follows their skin tone from light to deep, in the same outfit. Hair and
// accent colour have no bear counterpart, so they are not carried over.

import { type BearConfig, type FurId, outfitOptions } from "./bear-config";

const FUR_BY_TONE: readonly FurId[] = [
  "golden",
  "golden",
  "golden",
  "honey",
  "honey",
  "honey",
  "chestnut",
  "chestnut",
  "cocoa",
  "cocoa",
];

const HUMAN_FIELDS = ["body", "skin", "hair", "outfit", "accent"] as const;

export function migrateHumanAvatar(value: unknown): BearConfig | null {
  if (typeof value !== "object" || value === null) return null;
  const fields = value as Record<string, unknown>;
  if (!HUMAN_FIELDS.every((field) => typeof fields[field] === "string")) return null;
  const tone = /^tone-(\d+)$/.exec(fields.skin as string);
  const fur = tone ? FUR_BY_TONE[Number(tone[1]) - 1] : undefined;
  const outfit = outfitOptions.find((option) => option.id === fields.outfit)?.id;
  if (fur === undefined || outfit === undefined) return null;
  return { kind: "brown-bear", fur, face: "happy", outfit, accessory: "none" };
}
