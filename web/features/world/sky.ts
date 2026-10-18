// Light follows the hour in Bern. The night-mode setting decides how dark the scene is; the hour
// decides where the sun stands and how warm it is. In day mode a Bern night hour shows dusk, so the
// world never turns dark under a light interface.

export type Phase = "dawn" | "day" | "dusk" | "night";

export type Lighting = {
  readonly phase: Phase;
  readonly sunDirection: readonly [x: number, y: number, z: number];
  readonly sunColour: string;
  readonly sunIntensity: number;
  readonly skyColour: string;
  readonly groundColour: string;
  readonly ambientIntensity: number;
};

type Palette = Omit<Lighting, "phase" | "sunDirection"> & { readonly elevation: number };

const PALETTES: Readonly<Record<Phase, Palette>> = {
  dawn: {
    sunColour: "#ffe2c4",
    sunIntensity: 1.8,
    skyColour: "#dae6f5",
    groundColour: "#bdb7a8",
    ambientIntensity: 1.3,
    elevation: 0.35,
  },
  day: {
    sunColour: "#fff6e8",
    sunIntensity: 2.2,
    skyColour: "#dcebfa",
    groundColour: "#a9b88f",
    ambientIntensity: 1.3,
    elevation: 0.9,
  },
  dusk: {
    sunColour: "#ffd9b8",
    sunIntensity: 1.7,
    skyColour: "#d4dcf0",
    groundColour: "#b8b0a4",
    ambientIntensity: 1.25,
    elevation: 0.3,
  },
  night: {
    sunColour: "#c4d2f0",
    sunIntensity: 1.4,
    skyColour: "#8fa3cc",
    groundColour: "#3a4458",
    ambientIntensity: 1.6,
    elevation: 0.8,
  },
};

export function phaseAt(hour: number): Phase {
  if (hour >= 6.5 && hour < 9) return "dawn";
  if (hour >= 9 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

/** The sun is due south around 13:00 in Bern summer time; +z is south in the map frame. */
function sunDirection(hour: number, elevation: number): Lighting["sunDirection"] {
  const azimuth = ((hour - 13) / 24) * 2 * Math.PI;
  return [
    -Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
  ];
}

export function lightingAt(hour: number, night: boolean): Lighting {
  const byHour = phaseAt(hour);
  const phase = night ? "night" : byHour === "night" ? "dusk" : byHour;
  const { elevation, ...palette } = PALETTES[phase];
  return { phase, sunDirection: sunDirection(hour, elevation), ...palette };
}

const BERN_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Zurich",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

export function bernHour(date: Date): number {
  const parts = BERN_TIME.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour + minute / 60;
}
