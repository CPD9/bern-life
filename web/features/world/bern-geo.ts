// Reads web/public/world/bern.geo: Bern's real building footprints, roads, water and railways from
// swisstopo open data (©swisstopo), already projected to the map frame by infra/geo/build.py. The
// format is written down in infra/geo/encode.py; this decoder checks the magic, version and
// section lengths and refuses anything else. The scene does not use it yet (W12b).

export type GeoBuilding = {
  readonly landmark: boolean;
  readonly heightM: number;
  /** x, z pairs in map units, the ring not closed. */
  readonly ring: Float32Array;
};

export type GeoLineCategory = "road" | "water" | "rail";

export type GeoLine = {
  readonly category: GeoLineCategory;
  readonly widthM: number;
  readonly objektart: number;
  readonly points: Float32Array;
};

export type GeoAnchor = {
  readonly placeId: string;
  readonly x: number;
  readonly z: number;
  /** Index into buildings, or -1 when the address matched no footprint. */
  readonly building: number;
};

export type BernGeo = {
  readonly originE: number;
  readonly originN: number;
  readonly metresPerUnit: number;
  readonly buildings: readonly GeoBuilding[];
  readonly lines: readonly GeoLine[];
  readonly anchors: readonly GeoAnchor[];
};

export class BernGeoFormatError extends Error {
  constructor(readonly reason: string) {
    super(`bern.geo: ${reason}`);
    this.name = "BernGeoFormatError";
  }
}

const VERSION = 1;
const SECTION_BUILDINGS = 1;
const SECTION_LINES = 2;
const SECTION_ANCHORS = 3;
const CATEGORIES: Readonly<Record<number, GeoLineCategory>> = { 1: "road", 2: "water", 3: "rail" };

class Reader {
  offset = 0;
  constructor(readonly view: DataView) {}
  need(bytes: number) {
    if (this.offset + bytes > this.view.byteLength) throw new BernGeoFormatError("truncated");
  }
  u8() {
    this.need(1);
    return this.view.getUint8(this.offset++);
  }
  u16() {
    this.need(2);
    const value = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }
  i16() {
    this.need(2);
    const value = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return value;
  }
  u32() {
    this.need(4);
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }
  i32() {
    this.need(4);
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }
  f32() {
    this.need(4);
    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  }
  f64() {
    this.need(8);
    const value = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return value;
  }
  points(count: number, scale: number) {
    const points = new Float32Array(count * 2);
    for (let i = 0; i < count * 2; i++) points[i] = this.i16() / scale;
    return points;
  }
  text(length: number) {
    this.need(length);
    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, length);
    this.offset += length;
    return new TextDecoder().decode(bytes);
  }
}

export function decodeBernGeo(buffer: ArrayBuffer): BernGeo {
  const read = new Reader(new DataView(buffer));
  if (read.text(4) !== "BGEO") throw new BernGeoFormatError("not a bern.geo file");
  const version = read.u16();
  if (version !== VERSION) throw new BernGeoFormatError(`version ${version} is not ${VERSION}`);
  const scale = read.u16();
  const metresPerUnit = read.f32();
  const originE = read.f64();
  const originN = read.f64();
  const sections = read.u16();
  const buildings: GeoBuilding[] = [];
  const lines: GeoLine[] = [];
  const anchors: GeoAnchor[] = [];
  for (let s = 0; s < sections; s++) {
    const kind = read.u8();
    const count = read.u32();
    const length = read.u32();
    const end = read.offset + length;
    for (let i = 0; i < count; i++) {
      if (kind === SECTION_BUILDINGS) {
        const flags = read.u8();
        const heightM = read.u8();
        buildings.push({
          landmark: (flags & 1) === 1,
          heightM,
          ring: read.points(read.u16(), scale),
        });
      } else if (kind === SECTION_LINES) {
        const category = CATEGORIES[read.u8()];
        if (category === undefined) throw new BernGeoFormatError("unknown line category");
        const widthM = read.u8();
        const objektart = read.u8();
        lines.push({ category, widthM, objektart, points: read.points(read.u16(), scale) });
      } else if (kind === SECTION_ANCHORS) {
        const placeId = read.text(read.u8());
        anchors.push({
          placeId,
          x: read.i16() / scale,
          z: read.i16() / scale,
          building: read.i32(),
        });
      } else {
        throw new BernGeoFormatError(`unknown section ${kind}`);
      }
    }
    if (read.offset !== end) throw new BernGeoFormatError(`section ${kind} length does not match`);
  }
  if (read.offset !== buffer.byteLength)
    throw new BernGeoFormatError("bytes after the last section");
  return { originE, originN, metresPerUnit, buildings, lines, anchors };
}

export async function loadBernGeo(
  fetchFile: () => Promise<Response> = () => fetch("/world/bern.geo"),
): Promise<BernGeo> {
  const response = await fetchFile();
  if (!response.ok) throw new BernGeoFormatError(`could not be loaded (${response.status})`);
  return decodeBernGeo(await response.arrayBuffer());
}
