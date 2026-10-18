// Geometry for the static parts of the city. Everything that never changes after load (landmarks,
// bridges, roads, plates) is baked into one geometry per material with colours per vertex, so a
// whole layer costs one draw call.

import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Matrix4,
  SphereGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { type Part } from "./landmark-plan";

/** A unit gable roof: ridge along x at height 1, eaves at y 0 and z ±0.5, x from -0.5 to 0.5. */
export function gableRoofGeometry(): BufferGeometry {
  const [w, d] = [0.5, 0.5];
  // prettier-ignore
  const triangles = [
    -w, 0, d,   w, 0, d,   w, 1, 0,
    -w, 0, d,   w, 1, 0,  -w, 1, 0,
     w, 0, -d, -w, 0, -d, -w, 1, 0,
     w, 0, -d, -w, 1, 0,   w, 1, 0,
     w, 0, d,   w, 0, -d,  w, 1, 0,
    -w, 0, -d, -w, 0, d,  -w, 1, 0,
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(triangles, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** The unit shape for a part: base centred on the origin, one unit wide, deep and high. */
function unitShape(shape: Part["shape"], segments: number): BufferGeometry {
  switch (shape) {
    case "box":
      return new BoxGeometry().translate(0, 0.5, 0);
    case "gable":
      return gableRoofGeometry();
    case "hip":
      return new ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0);
    case "cylinder":
      return new CylinderGeometry(0.5, 0.5, 1, segments).translate(0, 0.5, 0);
    case "cone":
      return new ConeGeometry(0.5, 1, segments).translate(0, 0.5, 0);
    case "dome":
      return new SphereGeometry(
        0.5,
        segments,
        Math.max(3, segments / 2),
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      ).scale(1, 2, 1);
  }
}

/** A part placed by `frame` (its landmark's position and turn). */
export function partGeometry(part: Part, segments: number, frame: Matrix4): BufferGeometry {
  const [x, y, z] = part.at;
  const [width, height, depth] = part.size;
  return unitShape(part.shape, segments)
    .applyMatrix4(new Matrix4().makeScale(width, height, depth))
    .applyMatrix4(new Matrix4().makeTranslation(x, y, z))
    .applyMatrix4(frame);
}

export type Coloured = { readonly geometry: BufferGeometry; readonly colour: string };

const tint = new Color();

/** One geometry from many, each painted its colour; uv is dropped since nothing is textured. */
export function mergeColoured(pieces: readonly Coloured[]): BufferGeometry {
  const prepared = pieces.map(({ geometry, colour }) => {
    const flat = geometry.index === null ? geometry.clone() : geometry.toNonIndexed();
    flat.deleteAttribute("uv");
    tint.set(colour);
    const count = flat.getAttribute("position").count;
    const colours = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) colours.set([tint.r, tint.g, tint.b], i * 3);
    flat.setAttribute("color", new Float32BufferAttribute(colours, 3));
    return flat;
  });
  const merged = mergeGeometries(prepared);
  if (merged === null) throw new Error("the city's static geometry could not be merged");
  return merged;
}
