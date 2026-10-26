import { describe, expect, test } from "bun:test";
import { parseAccountsEnv } from "@/infrastructure/env";
import { InvalidEnvError, MissingEnvError } from "@/infrastructure/env";
import {
  clearedSessionCookie,
  clientIp,
  sessionCookie,
  sessionToken,
} from "@/infrastructure/session";
import { inviteHash, newInviteCode } from "./accounts";
import { crossSite, signedIn } from "./http";
import { parseProfile, parseSignIn, parseSignUp } from "./input";

const ORIGIN = "http://127.0.0.1:3016";
const TOKEN = "A".repeat(43);

function post(headers: Record<string, string>): Request {
  return new Request(`${ORIGIN}/api/auth/sign-in`, { method: "POST", headers });
}

describe("cross-site requests", () => {
  test("a foreign or missing Origin is refused with 403 before the body is read", async () => {
    for (const headers of [{ origin: "https://evil.test" }, {}]) {
      const refused = crossSite(post(headers), ORIGIN);
      expect(refused?.status).toBe(403);
      expect(await refused?.json()).toEqual({ error: "forbidden" });
    }
    expect(crossSite(post({ origin: ORIGIN }), ORIGIN)).toBeNull();
  });
});

describe("the session cookie", () => {
  test("is HttpOnly, SameSite=Lax, and Secure only over https", () => {
    expect(sessionCookie(TOKEN, ORIGIN)).toBe(
      `bl_session=${TOKEN}; HttpOnly; SameSite=Lax; Path=/; Max-Age=1209600`,
    );
    expect(sessionCookie(TOKEN, "https://bernlife.example")).toBe(
      `bl_session=${TOKEN}; HttpOnly; SameSite=Lax; Path=/; Max-Age=1209600; Secure`,
    );
    expect(clearedSessionCookie(ORIGIN)).toBe(
      "bl_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    );
  });

  test("is read only when it looks like a token we issue", () => {
    expect(sessionToken(post({ cookie: `theme=dark; bl_session=${TOKEN}` }))).toBe(TOKEN);
    expect(sessionToken(post({ cookie: "bl_session=short" }))).toBeNull();
    expect(sessionToken(post({}))).toBeNull();
  });

  test("a sign-in response carries the user and the cookie, nothing else", async () => {
    const user = {
      id: "u1",
      handle: "ada_example",
      displayName: "Ada Example",
      role: "member",
    } as const;
    const response = signedIn({ user, token: TOKEN }, ORIGIN);
    expect(await response.json()).toEqual({ user });
    expect(response.headers.get("set-cookie")).toBe(sessionCookie(TOKEN, ORIGIN));
  });
});

describe("request bodies", () => {
  test("sign-up lowercases the handle and refuses short passwords and bad names", () => {
    const valid = {
      invite: "AAAA-BBBB",
      handle: " Ada_Example ",
      displayName: "Ada Example",
      password: "x".repeat(12),
    };
    expect(parseSignUp(valid)).toEqual({ ...valid, handle: "ada_example" });
    expect(parseSignUp({ ...valid, password: "x".repeat(11) })).toBeNull();
    expect(parseSignUp({ ...valid, handle: "ad" })).toBeNull();
    expect(parseSignUp({ ...valid, displayName: "Ada\u0007" })).toBeNull();
    expect(parseSignIn({ handle: "ADA_EXAMPLE", password: "anything" })).toEqual({
      handle: "ada_example",
      password: "anything",
    });
  });

  test("a profile is private unless chosen otherwise and refuses unknown visibility", () => {
    expect(parseProfile({ expertise: ["CGM"] })).toEqual({
      role: null,
      goal: null,
      expertise: ["CGM"],
      visibility: "private",
      avatar: null,
    });
    expect(parseProfile({ visibility: "everyone" })).toBeNull();
    expect(
      parseProfile({ expertise: Array.from({ length: 21 }, (_, i) => `topic ${i}`) }),
    ).toBeNull();
  });
});

describe("invite codes", () => {
  test("carry 128 random bits as 26 base32 characters and hash the same however typed", () => {
    const code = newInviteCode();
    expect(code).toMatch(/^([A-Z2-7]{4}-){6}[A-Z2-7]{2}$/);
    expect(newInviteCode()).not.toBe(code);
    expect(inviteHash(code.toLowerCase().replaceAll("-", " "))).toBe(inviteHash(code));
  });
});

describe("accounts settings", () => {
  test("need a postgres URL and default the origin to the local app", () => {
    expect(() => parseAccountsEnv({})).toThrow(new MissingEnvError("DATABASE_URL"));
    expect(() => parseAccountsEnv({ DATABASE_URL: "mysql://x" })).toThrow(
      new InvalidEnvError("DATABASE_URL"),
    );
    expect(
      parseAccountsEnv({ DATABASE_URL: "postgresql://u:p@127.0.0.1:5433/bernlife" }).appOrigin,
    ).toBe("http://127.0.0.1:3000");
    expect(() =>
      parseAccountsEnv({
        DATABASE_URL: "postgres://h/db",
        APP_ORIGIN: "http://127.0.0.1:3016/app",
      }),
    ).toThrow(new InvalidEnvError("APP_ORIGIN"));
  });

  test("the client address is the first forwarded hop, and only behind a trusted proxy", () => {
    const forwarded = post({ "x-forwarded-for": "198.51.100.7, 10.0.0.1" });
    expect(clientIp(forwarded, true)).toBe("198.51.100.7");
    expect(clientIp(post({}), true)).toBe("unknown");
    expect(clientIp(forwarded, false)).toBe("unknown");
  });
});
