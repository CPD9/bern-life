import { describe, expect, test } from "bun:test";
import { defaultAvatar } from "./avatar-config";
import { meshParameters } from "./avatar-mesh";

describe("meshParameters", () => {
  test("the default avatar: medium build, casual top in the accent colour", () => {
    expect(meshParameters(defaultAvatar)).toEqual({
      torso: { radius: 0.18, length: 0.32, colour: "#2f9e5f" },
      legs: { radius: 0.075, length: 0.52, gap: 0.045, colour: "#3b5b85" },
      arms: { radius: 0.055, length: 0.44, colour: "#2f9e5f" },
      head: { radius: 0.17, colour: "#d09c74" },
      hair: { style: "short", colour: "#3b2a20" },
      shoes: "#2b2f36",
      coat: null,
      vest: null,
      tie: null,
    });
  });

  test("a broad build in a lab coat with a covering in the accent colour", () => {
    expect(
      meshParameters({
        body: "broad",
        skin: "tone-9",
        hair: "covered",
        outfit: "lab-coat",
        accent: "violet",
      }),
    ).toEqual({
      torso: { radius: 0.22, length: 0.32, colour: "#7a52c7" },
      legs: { radius: 0.09, length: 0.52, gap: 0.055, colour: "#4a5260" },
      arms: { radius: 0.065, length: 0.44, colour: "#f4f6f8" },
      head: { radius: 0.17, colour: "#55301c" },
      hair: { style: "covered", colour: "#7a52c7" },
      shoes: "#2b2f36",
      coat: { length: 0.62, colour: "#f4f6f8" },
      vest: null,
      tie: null,
    });
  });

  test("office puts the accent on a tie, field work on a vest", () => {
    const office = meshParameters({ ...defaultAvatar, outfit: "office", accent: "coral" });
    expect([office.torso.colour, office.tie, office.vest]).toEqual([
      "#3a4656",
      { colour: "#e0674f" },
      null,
    ]);

    const field = meshParameters({ ...defaultAvatar, outfit: "field-work", accent: "amber" });
    expect([field.torso.colour, field.legs.colour, field.vest, field.tie]).toEqual([
      "#6b7b4a",
      "#9c8a6a",
      { colour: "#e0a030" },
      null,
    ]);
  });
});
