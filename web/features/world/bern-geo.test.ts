import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BernGeoFormatError, decodeBernGeo, loadBernGeo } from "./bern-geo";
import { pointInPolygon } from "./geometry";
import { PLACES } from "./places";

const ORIGIN_E = 2600706.2;
const ORIGIN_N = 1199646.9;

/** The same file infra/tests/test_geo.py encodes: one landmark, one water line, one anchor. */
function tinyFile(): ArrayBuffer {
  const bytes: number[] = [];
  const view = new DataView(new ArrayBuffer(8));
  const push = (size: number, write: (v: DataView) => void) => {
    write(view);
    for (let i = 0; i < size; i++) bytes.push(view.getUint8(i));
  };
  const u8 = (v: number) => push(1, (d) => d.setUint8(0, v));
  const u16 = (v: number) => push(2, (d) => d.setUint16(0, v, true));
  const i16 = (v: number) => push(2, (d) => d.setInt16(0, v, true));
  const u32 = (v: number) => push(4, (d) => d.setUint32(0, v, true));
  const i32 = (v: number) => push(4, (d) => d.setInt32(0, v, true));
  "BGEO".split("").forEach((c) => u8(c.charCodeAt(0)));
  u16(1);
  u16(16);
  push(4, (d) => d.setFloat32(0, 20, true));
  push(8, (d) => d.setFloat64(0, ORIGIN_E, true));
  push(8, (d) => d.setFloat64(0, ORIGIN_N, true));
  u16(3);
  const section = (kind: number, count: number, length: number) => {
    u8(kind);
    u32(count);
    u32(length);
  };
  section(1, 1, 16);
  [1, 12].forEach(u8);
  u16(3);
  [0, 0, 16, 0, 16, 16].forEach(i16);
  section(2, 1, 13);
  [2, 50, 4].forEach(u8);
  u16(2);
  [0, 0, -16, 32].forEach(i16);
  section(3, 1, 12);
  u8(3);
  "inf".split("").forEach((c) => u8(c.charCodeAt(0)));
  [8, -4].forEach(i16);
  i32(0);
  return new Uint8Array(bytes).buffer;
}

describe("decodeBernGeo", () => {
  test("reads the header, a building, a line and an anchor exactly", () => {
    const geo = decodeBernGeo(tinyFile());
    expect([geo.originE, geo.originN, geo.metresPerUnit]).toEqual([ORIGIN_E, ORIGIN_N, 20]);
    expect(geo.buildings.map((b) => [b.landmark, b.heightM, [...b.ring]])).toEqual([
      [true, 12, [0, 0, 1, 0, 1, 1]],
    ]);
    expect(geo.lines.map((l) => [l.category, l.widthM, l.objektart, [...l.points]])).toEqual([
      ["water", 50, 4, [0, 0, -1, 2]],
    ]);
    expect(geo.anchors).toEqual([{ placeId: "inf", x: 0.5, z: -0.25, building: 0 }]);
  });

  test("refuses another format, another version, a cut-off file and trailing bytes", () => {
    const wrongMagic = new Uint8Array(tinyFile());
    wrongMagic[0] = 0;
    expect(() => decodeBernGeo(wrongMagic.buffer)).toThrow(
      new BernGeoFormatError("not a bern.geo file"),
    );
    const wrongVersion = new Uint8Array(tinyFile());
    wrongVersion[4] = 2;
    expect(() => decodeBernGeo(wrongVersion.buffer)).toThrow(
      new BernGeoFormatError("version 2 is not 1"),
    );
    expect(() => decodeBernGeo(tinyFile().slice(0, 40))).toThrow(
      new BernGeoFormatError("truncated"),
    );
    const longer = new Uint8Array(tinyFile().byteLength + 1);
    longer.set(new Uint8Array(tinyFile()));
    expect(() => decodeBernGeo(longer.buffer)).toThrow(
      new BernGeoFormatError("bytes after the last section"),
    );
  });

  test("a failed download is a named error, not a half-built city", async () => {
    await expect(loadBernGeo(async () => new Response(null, { status: 404 }))).rejects.toThrow(
      new BernGeoFormatError("could not be loaded (404)"),
    );
  });
});

describe("the shipped bern.geo", () => {
  const file = readFileSync(join(import.meta.dir, "..", "..", "public", "world", "bern.geo"));
  const geo = decodeBernGeo(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));

  test("every place with an address has an anchor inside its own building", () => {
    const addressed = PLACES.filter((place) => place.position_method === "address").map(
      (p) => p.id,
    );
    expect(geo.anchors.map((anchor) => anchor.placeId)).toEqual([...addressed].sort());
    for (const anchor of geo.anchors) {
      const building = geo.buildings[anchor.building];
      if (building === undefined) throw new Error(`${anchor.placeId} matched no footprint`);
      const ring: [number, number][] = [];
      for (let i = 0; i < building.ring.length; i += 2) {
        ring.push([building.ring[i] ?? 0, building.ring[i + 1] ?? 0]);
      }
      expect(pointInPolygon([anchor.x, anchor.z], ring)).toBe(true);
    }
  });

  test("the Zytglogge, a landmark, stands at the origin of the map frame", () => {
    const atOrigin = geo.buildings.filter((building) => {
      const ring: [number, number][] = [];
      for (let i = 0; i < building.ring.length; i += 2) {
        ring.push([building.ring[i] ?? 0, building.ring[i + 1] ?? 0]);
      }
      return pointInPolygon([0, 0], ring);
    });
    expect(atOrigin.map((building) => building.landmark)).toEqual([true]);
  });
});
