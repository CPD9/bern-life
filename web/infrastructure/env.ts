// The only module that reads process.env. Parsing is a pure function so tests pass their own
// source; env() parses lazily on first use so a build that never calls the engine needs no values.

export type Env =
  | { readonly demoFixtures: true; readonly engineUrl: URL | null }
  | { readonly demoFixtures: false; readonly engineUrl: URL };

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

function parseEngineUrl(value: string | undefined): URL | null {
  if (value === undefined || value === "") return null;
  if (!URL.canParse(value)) throw new InvalidEnvError("ENGINE_URL");
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new InvalidEnvError("ENGINE_URL");
  }
  return url;
}

export function parseEnv(source: EnvSource): Env {
  const engineUrl = parseEngineUrl(source.ENGINE_URL);
  if (parseDemoFixtures(source.DEMO_FIXTURES)) return { demoFixtures: true, engineUrl };
  if (engineUrl === null) throw new MissingEnvError("ENGINE_URL");
  return { demoFixtures: false, engineUrl };
}

let cached: Env | undefined;

export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
