// The stylised Bern every world feature shares, drawn by hand from public maps at street-level
// precision. No tiles and no geodata at run time, so the map works air-gapped.
//
// Frame: 1 unit ≈ 20 m. Origin at the Zytglogge. +x points east, -z points north (three.js
// ground plane, y up). Distances between places (spaces, walking) are measured in this frame, so
// multiply by METRES_PER_UNIT for metres.

export const METRES_PER_UNIT = 20;

export type MapPoint = readonly [x: number, z: number];

export type LandmarkId =
  | "zytglogge"
  | "muenster"
  | "bahnhof"
  | "bundeshaus"
  | "rathaus"
  | "nydegg"
  | "baerengraben"
  | "hauptgebaeude"
  | "inselspital"
  | "unitobler"
  | "vetsuisse"
  | "marzili"
  | "kirchenfeld"
  | "liebefeld";

export const LANDMARKS: Readonly<Record<LandmarkId, MapPoint>> = {
  zytglogge: [0, 0],
  muenster: [14.5, 4.2],
  /** The station hall; the roads meet on Bahnhofplatz in front of it. */
  bahnhof: [-28.4, -7.4],
  bundeshaus: [-11.9, 8],
  rathaus: [23.1, -5.3],
  nydegg: [38.3, -0.9],
  baerengraben: [47.8, 0.2],
  hauptgebaeude: [-35.5, -13.7],
  inselspital: [-85.2, 5.8],
  unitobler: [-54.8, -44.3],
  vetsuisse: [-59.4, -76.5],
  marzili: [-18.7, 28],
  kirchenfeld: [21.2, 30.8],
  liebefeld: [-119.4, 97.5],
};

/** Where the agent characters stand: the square in front of the city hall. */
export const RATHAUSPLATZ: MapPoint = [21.9, -7];

/** The Aare downstream, from Schönau past Marzili, round the Old Town, to the Engehalde. */
export const AARE_PATH: readonly MapPoint[] = [
  [17.4, 83.6],
  [-1.6, 61.4],
  [-13, 41.9],
  [-17.6, 28],
  [-13.8, 16.9],
  [-3.5, 13],
  [6.7, 11.9],
  [15.5, 10.2],
  [26.9, 7.5],
  [36.4, 3.6],
  [43.2, -0.9],
  [45.5, -8.1],
  [40.9, -15.3],
  [32.6, -20.9],
  [19.3, -25.4],
  [6, -27.6],
  [-5.4, -30.9],
  [-14.2, -35.9],
  [-22.5, -43.1],
  [-27.5, -55.4],
  [-31.3, -72.1],
  [-41.5, -88.7],
  [-58.6, -102.6],
  [-77.6, -113.8],
];

/** About 60 m: wide enough to read as a river at the default zoom. */
export const AARE_WIDTH = 3;

/** The wooded slopes either side of the water, drawn darker than the ground. */
export const BANK_WIDTH = 0.7;

export type BridgeId = "monbijou" | "kirchenfeld" | "nydegg" | "kornhaus" | "lorraine";

export const BRIDGES: Readonly<Record<BridgeId, readonly [MapPoint, MapPoint]>> = {
  monbijou: [
    [-22.5, 34.7],
    [-6.2, 40.3],
  ],
  kirchenfeld: [
    [2.9, 5.8],
    [9.8, 20.8],
  ],
  nydegg: [
    [37.1, -0.3],
    [48.9, -0.9],
  ],
  kornhaus: [
    [3.7, -19.2],
    [6.7, -35.9],
  ],
  lorraine: [
    [-18.7, -27.6],
    [-10.4, -43.1],
  ],
};

/** Openings per bridge: Kirchenfeld's two arches, Nydegg's one great arch, the others more. */
export const BRIDGE_ARCHES: Readonly<Record<BridgeId, number>> = {
  monbijou: 3,
  kirchenfeld: 2,
  nydegg: 1,
  kornhaus: 3,
  lorraine: 2,
};

export type DistrictId =
  | "old-town"
  | "grosse-schanze"
  | "insel"
  | "laenggasse"
  | "laenggasse-north"
  | "kirchenfeld"
  | "lorraine"
  | "mattenhof"
  | "liebefeld";

export type District = {
  readonly id: DistrictId;
  readonly name: string;
  readonly outline: readonly MapPoint[];
};

export const DISTRICTS: readonly District[] = [
  {
    id: "old-town",
    name: "Altstadt",
    outline: [
      [-26.3, -13.7],
      [9.8, -20.9],
      [32.6, -14.2],
      [42.1, -5.3],
      [39.4, 2.4],
      [17.4, 7.5],
      [-5.4, 9.7],
      [-26.3, 5.8],
    ],
  },
  {
    id: "grosse-schanze",
    name: "Grosse Schanze",
    outline: [
      [-42.7, -20.9],
      [-27.5, -20.9],
      [-27.5, -8.1],
      [-42.7, -8.1],
    ],
  },
  {
    id: "insel",
    name: "Insel",
    outline: [
      [-98.5, -6.4],
      [-66.2, -6.4],
      [-66.2, 14.1],
      [-98.5, 14.1],
    ],
  },
  {
    id: "laenggasse",
    name: "Länggasse",
    outline: [
      [-79.5, -58.2],
      [-43.4, -58.2],
      [-28.2, -22],
      [-73.8, -20.9],
    ],
  },
  {
    id: "laenggasse-north",
    name: "Länggasse Nord",
    outline: [
      [-83.3, -91.5],
      [-49.1, -91.5],
      [-49.1, -58.2],
      [-83.3, -58.2],
    ],
  },
  {
    id: "kirchenfeld",
    name: "Kirchenfeld",
    outline: [
      [-1.6, 19.7],
      [47.8, 15.8],
      [47.8, 50.3],
      [2.2, 50.3],
    ],
  },
  {
    id: "lorraine",
    name: "Lorraine",
    outline: [
      [-17, -46],
      [-24.4, -69.3],
      [9.8, -66.5],
      [9.8, -33.1],
    ],
  },
  {
    id: "mattenhof",
    name: "Mattenhof",
    outline: [
      [-98.5, 14.1],
      [-30.1, 14.1],
      [-24.4, 44.7],
      [-94.7, 78.1],
      [-119.4, 78.1],
    ],
  },
  {
    id: "liebefeld",
    name: "Liebefeld",
    outline: [
      [-142.2, 80.8],
      [-96.6, 80.8],
      [-96.6, 111.4],
      [-142.2, 111.4],
    ],
  },
];

/** Spitalgasse to Gerechtigkeitsgasse: from Bahnhofplatz under the Zytglogge to the Nydegg. The
 * Old Town's house rows follow it. */
export const OLD_TOWN_AXIS: readonly MapPoint[] = [
  [-31.3, -5.3],
  [-20, -2.6],
  [-10, -0.8],
  [0, 0],
  [12, 0.4],
  [26, -0.4],
  [38.3, -0.9],
];

/** Main streets as centre lines: the Old Town axis, the street from the Kornhaus bridge across
 * the axis to the Kirchenfeld bridge, Länggassstrasse, Murtenstrasse, the road to Liebefeld, and
 * the streets off the three big bridges. */
export const ROADS: readonly (readonly MapPoint[])[] = [
  OLD_TOWN_AXIS,
  [
    [3.7, -19.2],
    [2.4, 0.1],
    [2.9, 5.8],
  ],
  [
    [-31.3, -5.3],
    [-44, -12],
    [-45, -24],
    [-58, -44],
    [-60, -66],
  ],
  [
    [-31.3, -5.3],
    [-55, -5.5],
    [-75, -5.5],
    [-98.5, -5.5],
  ],
  [
    [-28, 8],
    [-55, 30],
    [-85, 60],
    [-119.4, 97.5],
  ],
  [
    [9.8, 20.8],
    [21.2, 30.8],
  ],
  [
    [6.7, -35.9],
    [5, -60],
  ],
  [
    [-10.4, -43.1],
    [-6, -60],
  ],
];

export const ROAD_WIDTH = 1.4;

export type MapLabel = {
  readonly key: string;
  readonly name: string;
  readonly at: MapPoint;
  /** The district the label names, or null for the river. */
  readonly district: DistrictId | null;
};

/** Names on the ground, set where few place markers stand so the two rarely cover each other. */
export const MAP_LABELS: readonly MapLabel[] = [
  { key: "aare", name: "Aare", at: [-5.9, 54], district: null },
  { key: "altstadt", name: "Altstadt", at: [10, -12], district: "old-town" },
  { key: "laenggasse", name: "Länggasse", at: [-58, -52], district: "laenggasse" },
  { key: "insel", name: "Insel", at: [-80, 13], district: "insel" },
  { key: "kirchenfeld", name: "Kirchenfeld", at: [26, 40], district: "kirchenfeld" },
  { key: "lorraine", name: "Lorraine", at: [-1, -55], district: "lorraine" },
  { key: "mattenhof", name: "Mattenhof", at: [-60, 40], district: "mattenhof" },
  { key: "liebefeld", name: "Liebefeld", at: [-119, 104], district: "liebefeld" },
];

/** The ground and the camera's pan limits: every district and the river, plus a margin. */
export const MAP_BOUNDS = { minX: -150, maxX: 60, minZ: -120, maxZ: 120 } as const;
