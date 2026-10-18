import { describe, expect, test } from "bun:test";
import { defaultBear } from "./bear-config";
import { DARK_EYES, LIGHT_EYES, bearLook, eyesOn, luminance } from "./bear-look";

describe("luminance", () => {
  test("white is 1 and black is 0", () => {
    expect(luminance("#ffffff")).toBe(1);
    expect(luminance("#000000")).toBe(0);
  });
});

describe("eyesOn", () => {
  test("dark eyes on light fur, light eyes on dark fur", () => {
    expect(eyesOn("#f3f1ea")).toBe(DARK_EYES);
    expect(eyesOn("#b97a45")).toBe(DARK_EYES);
    expect(eyesOn("#5e3b26")).toBe(LIGHT_EYES);
    expect(eyesOn("#2b2a2e")).toBe(LIGHT_EYES);
  });
});

describe("bearLook", () => {
  test("the default Bern bear: honey fur, cream muzzle and belly, dark eyes", () => {
    expect(bearLook(defaultBear)).toEqual({
      fur: "#b97a45",
      muzzle: "#ecd3ad",
      belly: "#ecd3ad",
      limbs: "#b97a45",
      ears: "#b97a45",
      innerEars: "#e3b994",
      nose: "#3a2a26",
      eyes: DARK_EYES,
      eyePatches: null,
      faceMarks: null,
      horns: null,
    });
  });

  test("a panda has dark ears, limbs and eye patches, so its eyes are light", () => {
    const panda = bearLook({ ...defaultBear, kind: "panda", fur: "classic" });
    expect([panda.ears, panda.limbs, panda.eyePatches, panda.eyes]).toEqual([
      "#2b2a2e",
      "#2b2a2e",
      "#2b2a2e",
      LIGHT_EYES,
    ]);
    expect(bearLook({ ...defaultBear, kind: "panda", fur: "qinling" }).eyePatches).toBe("#5b4334");
  });

  test("a cocoa bear gets light eyes; a red panda gets white face marks; an ibex gets horns", () => {
    expect(bearLook({ ...defaultBear, fur: "cocoa" }).eyes).toBe(LIGHT_EYES);
    expect(bearLook({ ...defaultBear, kind: "red-panda", fur: "rust" }).faceMarks).toBe("#f6efe6");
    expect(bearLook({ ...defaultBear, kind: "ibex", fur: "fawn" }).horns).toBe("#e3d9c8");
  });
});
