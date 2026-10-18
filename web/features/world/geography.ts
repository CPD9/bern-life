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
  bahnhof: [-31.3, -5.3],
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

/** The ground and the camera's pan limits: every district and the river, plus a margin. */
export const MAP_BOUNDS = { minX: -150, maxX: 60, minZ: -120, maxZ: 120 } as const;
