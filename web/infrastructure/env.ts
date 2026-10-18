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

// Accounts and messages need the database and the app's own origin (for the CSRF origin check).
// They are parsed separately so pages that never touch accounts need neither value.
export type AccountsEnv = { readonly databaseUrl: string; readonly appOrigin: string };

const DEFAULT_APP_ORIGIN = "http://127.0.0.1:3000";

function parseDatabaseUrl(value: string | undefined): string {
  if (value === undefined || value === "") throw new MissingEnvError("DATABASE_URL");
  if (!URL.canParse(value)) throw new InvalidEnvError("DATABASE_URL");
  const protocol = new URL(value).protocol;
  if (protocol !== "postgres:" && protocol !== "postgresql:") {
    throw new InvalidEnvError("DATABASE_URL");
  }
  return value;
}

function parseAppOrigin(value: string | undefined): string {
  if (value === undefined || value === "") return DEFAULT_APP_ORIGIN;
  if (!URL.canParse(value)) throw new InvalidEnvError("APP_ORIGIN");
  const url = new URL(value);
  const bare = value.endsWith("/") ? value.slice(0, -1) : value;
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.origin !== bare) {
    throw new InvalidEnvError("APP_ORIGIN");
  }
  return url.origin;
}

export function parseAccountsEnv(source: EnvSource): AccountsEnv {
  return {
    databaseUrl: parseDatabaseUrl(source.DATABASE_URL),
    appOrigin: parseAppOrigin(source.APP_ORIGIN),
  };
}

let cachedAccounts: AccountsEnv | undefined;

export function accountsEnv(): AccountsEnv {
  cachedAccounts ??= parseAccountsEnv(process.env);
  return cachedAccounts;
}

// Database tests run against a throwaway database when one is given, and say so when skipped.
export function testDatabaseUrl(): string | null {
  return process.env.DATABASE_URL || null;
}
