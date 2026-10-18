import { afterAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { Sql } from "@/infrastructure/db";
import { tokenHash } from "@/infrastructure/session";
import {
  createInvites,
  currentUser,
  deleteAccount,
  saveProfile,
  signIn,
  signOut,
  signUp,
  type Outcome,
  type SignedIn,
} from "./accounts";
import { failure, signedIn } from "./http";
import type { SignUp } from "./input";
import { profileOf } from "./store";
import { SKIPPED, emptyTables, openTestDb } from "@/infrastructure/test-database";

const NOW = new Date("2026-10-18T20:00:00Z");
const IP = "192.0.2.10";
const PASSWORD = "correct horse battery";
const ORIGIN = "http://127.0.0.1:3016";
const minutes = (n: number) => new Date(NOW.getTime() + n * 60 * 1000);
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

const testDb = openTestDb();
if (testDb === null) test.skip(SKIPPED, () => {});

describe.skipIf(testDb === null)("accounts against a throwaway database", () => {
  const sql = testDb as Sql;

  beforeEach(() => emptyTables(sql));
  afterAll(async () => {
    await emptyTables(sql);
    await sql.end();
  });

  async function invite(at = NOW, createdBy: string | null = null): Promise<string> {
    const [code] = await createInvites(sql, 1, at, createdBy);
    return code as string;
  }

  function joining(code: string, handle = "ada_example"): SignUp {
    return { invite: code, handle, displayName: "Ada Example", password: PASSWORD };
  }

  function signedInOrThrow(outcome: Outcome<SignedIn>): SignedIn {
    if (!outcome.ok) throw new Error(`expected success, got ${outcome.error}`);
    return outcome.value;
  }

  test("an invite is required, works once, and expires after seven days", async () => {
    expect(await signUp(sql, joining("NOPE-NOPE"), IP, NOW)).toEqual({
      ok: false,
      error: "invite_invalid",
    });
    const code = await invite();
    const typedLoosely = code.toLowerCase().replaceAll("-", " ");
    expect(signedInOrThrow(await signUp(sql, joining(typedLoosely), IP, NOW)).user.handle).toBe(
      "ada_example",
    );
    expect(await signUp(sql, joining(code, "bea_example"), IP, NOW)).toEqual({
      ok: false,
      error: "invite_invalid",
    });
    const old = await invite(days(-8));
    expect(await signUp(sql, joining(old, "bea_example"), IP, NOW)).toEqual({
      ok: false,
      error: "invite_invalid",
    });
    expect(await signUp(sql, joining(await invite()), IP, NOW)).toEqual({
      ok: false,
      error: "handle_taken",
    });
  });

  test("the stored hash is argon2id with the documented parameters", async () => {
    await signUp(sql, joining(await invite()), IP, NOW);
    const [row] = await sql<{ hash: string }[]>`select hash from credential`;
    expect(row?.hash.startsWith("$argon2id$v=19$m=19456,t=2,p=1$")).toBe(true);
  });

  test("a wrong password is refused and the sixth failure for a handle is rate limited", async () => {
    await signUp(sql, joining(await invite()), IP, NOW);
    const wrong = { handle: "ada_example", password: "wrong password!" };
    for (let attempt = 1; attempt <= 5; attempt++) {
      expect(await signIn(sql, wrong, IP, NOW, null)).toEqual({
        ok: false,
        error: "invalid_credentials",
      });
    }
    const right = { handle: "ada_example", password: PASSWORD };
    expect(await signIn(sql, right, IP, NOW, null)).toEqual({ ok: false, error: "rate_limited" });
    expect((await signIn(sql, right, IP, minutes(16), null)).ok).toBe(true);
    const unknown = { handle: "nobody_here", password: PASSWORD };
    expect(await signIn(sql, unknown, IP, minutes(16), null)).toEqual({
      ok: false,
      error: "invalid_credentials",
    });
  });

  test("sessions are stored hashed, expire, rotate on sign-in and end on sign-out", async () => {
    const first = signedInOrThrow(await signUp(sql, joining(await invite()), IP, NOW));
    const [stored] = await sql<{ id_hash: string }[]>`select id_hash from session`;
    expect(stored?.id_hash).toBe(tokenHash(first.token));
    expect((await currentUser(sql, first.token, days(13)))?.handle).toBe("ada_example");
    expect(await currentUser(sql, first.token, days(14))).toBeNull();

    const right = { handle: "ada_example", password: PASSWORD };
    const second = signedInOrThrow(await signIn(sql, right, IP, NOW, first.token));
    expect(await currentUser(sql, first.token, NOW)).toBeNull();
    expect((await currentUser(sql, second.token, NOW))?.handle).toBe("ada_example");
    await signOut(sql, second.token);
    expect(await currentUser(sql, second.token, NOW)).toBeNull();
  });

  test("deleting an account removes every row of the user", async () => {
    const redeemed = await invite();
    const { user } = signedInOrThrow(await signUp(sql, joining(redeemed), IP, NOW));
    await saveProfile(
      sql,
      user,
      {
        role: "Researcher",
        goal: null,
        expertise: ["sensors"],
        visibility: "private",
        avatar: { hair: 2 },
      },
      NOW,
    );
    await createInvites(sql, 2, NOW, user.id);
    await signIn(sql, { handle: "ada_example", password: PASSWORD }, IP, NOW, null);

    expect(await deleteAccount(sql, user, "not my password")).toEqual({
      ok: false,
      error: "invalid_credentials",
    });
    expect(await deleteAccount(sql, user, PASSWORD)).toEqual({ ok: true, value: null });
    const [left] = await sql<
      {
        users: number;
        credentials: number;
        sessions: number;
        profiles: number;
        invites: number;
        redeemed: number;
      }[]
    >`
      select (select count(*)::int from app_user where id = ${user.id}) as users,
             (select count(*)::int from credential where user_id = ${user.id}) as credentials,
             (select count(*)::int from session where user_id = ${user.id}) as sessions,
             (select count(*)::int from user_profile where user_id = ${user.id}) as profiles,
             (select count(*)::int from invite where created_by = ${user.id}) as invites,
             (select count(*)::int from invite where used_by = ${user.id}) as redeemed`;
    expect(left).toEqual({
      users: 0,
      credentials: 0,
      sessions: 0,
      profiles: 0,
      invites: 0,
      redeemed: 0,
    });
  });

  test("the onboarding profile is saved and read back, private by default", async () => {
    const { user } = signedInOrThrow(await signUp(sql, joining(await invite()), IP, NOW));
    await saveProfile(
      sql,
      user,
      {
        role: null,
        goal: "Find a sensor lab",
        expertise: ["CGM", "wearables"],
        visibility: "private",
        avatar: null,
      },
      NOW,
    );
    expect(await profileOf(sql, user.id)).toEqual({
      role: null,
      goal: "Find a sensor lab",
      expertise: ["CGM", "wearables"],
      visibility: "private",
      avatar: null,
      updatedAt: NOW,
    });
  });

  test("no password or hash appears in a response body or a log line", async () => {
    const logged: string[] = [];
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
      spyOn(console, level).mockImplementation((...args: unknown[]) => {
        logged.push(args.map(String).join(" "));
      }),
    );
    try {
      const joined = signedInOrThrow(await signUp(sql, joining(await invite()), IP, NOW));
      const refused = await signIn(
        sql,
        { handle: "ada_example", password: "wrong password!" },
        IP,
        NOW,
        null,
      );
      const bodies = [
        await signedIn(joined, ORIGIN).text(),
        await failure(refused.ok ? "bad_request" : refused.error).text(),
      ];
      const [row] = await sql<{ hash: string }[]>`select hash from credential`;
      const secrets = [PASSWORD, "wrong password!", row?.hash ?? "missing"];
      for (const text of [...bodies, ...logged]) {
        for (const secret of secrets) expect(text.includes(secret)).toBe(false);
      }
      expect(JSON.parse(bodies[0] ?? "{}")).toEqual({ user: joined.user });
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});
