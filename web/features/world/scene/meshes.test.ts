import { describe, expect, test } from "bun:test";
import { BoxGeometry, Color, Matrix4 } from "three";
import { gableRoofGeometry, mergeColoured, partGeometry } from "./meshes";

describe("meshes", () => {
  test("a unit gable roof: six triangles, ridge at height 1, faces pointing outward", () => {
    const roof = gableRoofGeometry();
    const position = roof.getAttribute("position");
    expect(position.count).toBe(18);
    roof.computeBoundingBox();
    expect(roof.boundingBox?.min.toArray()).toEqual([-0.5, 0, -0.5]);
    expect(roof.boundingBox?.max.toArray()).toEqual([0.5, 1, 0.5]);
    const normal = roof.getAttribute("normal");
    expect(normal.getY(0)).toBeGreaterThan(0);
    expect(normal.getZ(0)).toBeGreaterThan(0);
    expect(normal.getZ(6)).toBeLessThan(0);
    expect(normal.getX(12)).toBeCloseTo(1, 10);
  });

  test("a part is scaled to its size and stands on its base point inside its frame", () => {
    const frame = new Matrix4().makeTranslation(10, 0, -5);
    const hip = partGeometry(
      { shape: "hip", tone: "slate", at: [1, 2, 0], size: [4, 0.5, 2] },
      8,
      frame,
    );
    hip.computeBoundingBox();
    const box = hip.boundingBox;
    expect(box?.min.x).toBeCloseTo(9, 6);
    expect(box?.max.x).toBeCloseTo(13, 6);
    expect(box?.min.y).toBeCloseTo(2, 6);
    expect(box?.max.y).toBeCloseTo(2.5, 6);
    expect(box?.min.z).toBeCloseTo(-6, 6);
    expect(box?.max.z).toBeCloseTo(-4, 6);
  });

  test("merging keeps every vertex and paints each piece its own colour", () => {
    const merged = mergeColoured([
      { geometry: new BoxGeometry(), colour: "#ff0000" },
      { geometry: gableRoofGeometry(), colour: "#0000ff" },
    ]);
    expect(merged.getAttribute("position").count).toBe(36 + 18);
    expect(merged.getAttribute("uv")).toBeUndefined();
    const colour = merged.getAttribute("color");
    const blue = new Color("#0000ff");
    expect([colour.getX(0), colour.getY(0), colour.getZ(0)]).toEqual([1, 0, 0]);
    expect([colour.getX(40), colour.getY(40), colour.getZ(40)]).toEqual([blue.r, blue.g, blue.b]);
  });
});
