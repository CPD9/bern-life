import { describe, expect, test } from "bun:test";
import { defaultAvatar } from "./avatar-config";
import { meshParameters } from "./avatar-mesh";

describe("meshParameters", () => {
  test("the default avatar: big head, small torso, short wide legs, big hands in skin tone", () => {
    expect(meshParameters(defaultAvatar)).toEqual({
      torso: { radius: 0.18, length: 0.12, colour: "#2f9e5f" },
      legs: { radius: 0.1, length: 0.1, gap: 0.06, colour: "#3b5b85" },
      arms: { radius: 0.055, length: 0.14, colour: "#2f9e5f" },
      hands: { radius: 0.09, colour: "#d09c74" },
      head: { radius: 0.3, colour: "#d09c74" },
      eyes: "#2a2226",
      hair: { style: "short", colour: "#3b2a20" },
      shoes: "#f2efe9",
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
      torso: { radius: 0.22, length: 0.12, colour: "#7a52c7" },
      legs: { radius: 0.12, length: 0.1, gap: 0.07, colour: "#4a5260" },
      arms: { radius: 0.065, length: 0.14, colour: "#f4f6f8" },
      hands: { radius: 0.1, colour: "#5a3018" },
      head: { radius: 0.3, colour: "#5a3018" },
      eyes: "#f4e9df",
      hair: { style: "covered", colour: "#7a52c7" },
      shoes: "#5b6b7d",
      coat: { length: 0.42, colour: "#f4f6f8" },
      vest: null,
      tie: null,
    });
  });

  test("eye lines turn light from tone 8 on, and a hood takes the accent colour", () => {
    const eyesFor = (skin: "tone-7" | "tone-8") => meshParameters({ ...defaultAvatar, skin }).eyes;
    expect([eyesFor("tone-7"), eyesFor("tone-8")]).toEqual(["#2a2226", "#f4e9df"]);
    expect(meshParameters({ ...defaultAvatar, hair: "hood", accent: "teal" }).hair).toEqual({
      style: "hood",
      colour: "#1f9a9a",
    });
  });

  test("office puts the accent on a tie, field work on a vest", () => {
    const office = meshParameters({ ...defaultAvatar, outfit: "office", accent: "coral" });
    expect([office.torso.colour, office.shoes, office.tie, office.vest]).toEqual([
      "#3a4656",
      "#4a3426",
      { colour: "#e0674f" },
      null,
    ]);

    const field = meshParameters({ ...defaultAvatar, outfit: "field-work", accent: "amber" });
    expect([field.torso.colour, field.legs.colour, field.shoes, field.vest, field.tie]).toEqual([
      "#6b7b4a",
      "#9c8a6a",
      "#7a5a3c",
      { colour: "#e0a030" },
      null,
    ]);
  });
});
