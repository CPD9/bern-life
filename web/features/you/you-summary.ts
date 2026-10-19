// What the You sheet says, worked out from stored answers only. Every line is either something the
// player chose or a count from the story engine; when a value is missing the sheet says where it
// comes from instead of filling the gap.

import {
  type BearConfig,
  accessoryOptions,
  faceOptions,
  furOptions,
  kindOptions,
  outfitOptions,
} from "@/features/avatar/bear-config";
import {
  type Profile,
  goalOptions,
  roleOptions,
  visibilityOptions,
} from "@/features/onboarding/profile";
import type { StoryProgress } from "@/features/story/engine";

/** The onboarding profile, plus the expertise an account may already hold. */
export type YouProfile = Profile & { readonly expertise?: readonly string[] };

/**
 * The player's look as a person. The fields follow the person config (body, skin, hair, outfit,
 * accent), kept as plain ids here so the sheet reads any stored look without depending on its
 * editor.
 */
export type PersonLook = {
  readonly body: string;
  readonly skin: string;
  readonly hair: string;
  readonly outfit: string;
  readonly accent: string;
};

export type Agent = { readonly name: string; readonly bear: BearConfig };

export type Fact = { readonly label: string; readonly value: string };

function labelOf<Id extends string>(
  options: readonly { id: Id; label: string }[],
  id: Id | null,
): string | null {
  return options.find((option) => option.id === id)?.label ?? null;
}

/** "lab-coat" reads "Lab coat", "tone-4" reads "Tone 4". */
export function readableId(id: string): string {
  const words = id.replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function goalOf(profile: YouProfile): string | null {
  return labelOf(goalOptions, profile.goal);
}

export function profileFacts(profile: YouProfile): Fact[] {
  return [
    { label: "Role", value: labelOf(roleOptions, profile.role) ?? "Not chosen yet" },
    { label: "Goal", value: goalOf(profile) ?? "Not chosen yet" },
    {
      label: "Who sees your profile",
      value: labelOf(visibilityOptions, profile.visibility) ?? "Only me",
    },
  ];
}

export function personFacts(person: PersonLook): Fact[] {
  return [
    { label: "Build", value: readableId(person.body) },
    { label: "Skin", value: readableId(person.skin) },
    { label: "Hair", value: readableId(person.hair) },
    { label: "Outfit", value: readableId(person.outfit) },
    { label: "Accent", value: readableId(person.accent) },
  ];
}

export function bearFacts(bear: BearConfig): Fact[] {
  return [
    { label: "Kind", value: labelOf(kindOptions, bear.kind) ?? readableId(bear.kind) },
    { label: "Fur", value: labelOf(furOptions(bear.kind), bear.fur) ?? readableId(bear.fur) },
    { label: "Face", value: labelOf(faceOptions, bear.face) ?? readableId(bear.face) },
    { label: "Outfit", value: labelOf(outfitOptions, bear.outfit) ?? readableId(bear.outfit) },
    {
      label: "Accessory",
      value: labelOf(accessoryOptions, bear.accessory) ?? readableId(bear.accessory),
    },
  ];
}

export function furColour(bear: BearConfig): string | null {
  return furOptions(bear.kind).find((option) => option.id === bear.fur)?.colour ?? null;
}

/** Optional quests never count against the player, so only required ones are tallied. */
export function storyTally(story: StoryProgress): { done: number; required: number } {
  const required = story.quests.filter(({ quest }) => !quest.optional);
  return {
    done: required.filter(({ status }) => status === "done").length,
    required: required.length,
  };
}

/** Trimmed, without blanks or repeats, in the order the player gave them. */
export function expertiseOf(profile: YouProfile): string[] {
  const seen = new Set<string>();
  for (const item of profile.expertise ?? []) {
    const trimmed = item.trim();
    if (trimmed !== "") seen.add(trimmed);
  }
  return [...seen];
}
