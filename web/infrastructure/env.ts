// The only module that reads process.env. Parsing is a pure function so tests pass their own
// source; env() parses lazily on first use so a build that never calls the engine needs no values.

export type Env = {
  readonly engineUrl: URL | null;
  readonly demoFixtures: boolean;
};

type EnvSource = Readonly<Record<string, string | undefined>>;

export class MissingEnvError extends Error {
  constructor(readonly variable: string) {
    super(`Missing required environment variable ${variable}`);
    this.name = "MissingEnvError";
  }
}

export class InvalidEnvError extends Error {
  constructor(readonly variable: string) {
    super(`Invalid value for environment variable ${variable}`);
    this.name = "InvalidEnvError";
  }
}

function parseDemoFixtures(value: string | undefined): boolean {
  if (value === undefined || value === "" || value === "0") return false;
  if (value === "1") return true;
  throw new InvalidEnvError("DEMO_FIXTURES");
}

function parseEngineUrl(value: string | undefined, required: boolean): URL | null {
  if (value === undefined || value === "") {
    if (required) throw new MissingEnvError("ENGINE_URL");
    return null;
  }
  if (!URL.canParse(value)) throw new InvalidEnvError("ENGINE_URL");
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new InvalidEnvError("ENGINE_URL");
  }
  return url;
}

export function parseEnv(source: EnvSource): Env {
  const demoFixtures = parseDemoFixtures(source.DEMO_FIXTURES);
  return {
    engineUrl: parseEngineUrl(source.ENGINE_URL, !demoFixtures),
    demoFixtures,
  };
}

let cached: Env | undefined;

export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
