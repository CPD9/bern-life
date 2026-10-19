// Sessions are opaque random tokens in an HttpOnly cookie. The database keeps only the token's
// SHA-256, so reading the session table cannot sign anyone in. State-changing routes accept a
// request only when its Origin is the app's own; with SameSite=Lax that refuses cross-site posts.
import { createHash, randomBytes } from "node:crypto";
import { trustProxy } from "./env";

export const SESSION_COOKIE = "bl_session";
export const SESSION_DAYS = 14;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(now: Date): Date {
  return new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

function cookie(value: string, maxAge: number, appOrigin: string): string {
  const secure = appOrigin.startsWith("https:") ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

export function sessionCookie(token: string, appOrigin: string): string {
  return cookie(token, SESSION_DAYS * 24 * 60 * 60, appOrigin);
}

export function clearedSessionCookie(appOrigin: string): string {
  return cookie("", 0, appOrigin);
}

export function sessionToken(request: Request): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [name, value] = part.trim().split("=", 2);
    if (name === SESSION_COOKIE && value !== undefined && TOKEN.test(value)) return value;
  }
  return null;
}

export function fromOwnOrigin(request: Request, appOrigin: string): boolean {
  return request.headers.get("origin") === appOrigin;
}

/** The address limits are counted against. Next fills X-Forwarded-For with the peer only when the
 *  header is missing, so without a proxy that overwrites it (TRUST_PROXY=1) a forged value and a
 *  real one look the same, and every request counts as the one address "unknown". */
export function clientIp(request: Request, behindProxy: boolean = trustProxy()): string {
  if (!behindProxy) return "unknown";
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
