import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import type { Sql } from "./db";
import {
  countAttempt,
  createEngineGuard,
  type EngineAccess,
  type EngineRoute,
} from "./engine-guard";
import { fromOwnOrigin } from "./session";
import { SKIPPED, emptyTables, openTestDb } from "./test-database";

const NOW = new Date("2026-10-19T09:00:00Z");
const ADDRESS = "198.51.100.7";
const APP_ORIGIN = "http://127.0.0.1:3013";
const USER = "0b6f3c2e-9a41-4d7e-8c55-2f1e7a9d4b10";

type Step = "countAttempt" | "userId";
type Setup = {
  readonly user?: string | null;
  readonly origin?: string | null;
  readonly counts?: Record<string, number>;
  readonly demoFixtures?: boolean;
  readonly failingStep?: Step;
};

/** A database round trip, so requests in flight together interleave as they would on Postgres. */
const roundTrip = () => new Promise<void>((resolve) => setTimeout(resolve, 1));

/** A guard over an in-memory limiter that records every call it gets. */
function guardOver(setup: Setup = {}) {
  const { user = null, origin = APP_ORIGIN, counts = {}, demoFixtures = false } = setup;
  const stored = new Map(Object.entries(counts));
  const calls: string[] = [];
  const logged: string[] = [];
  const step = (name: Step, detail: string) => {
    calls.push(`${name} ${detail}`);
    if (name === setup.failingStep) throw new Error("connect ECONNREFUSED 127.0.0.1:5433");
  };
  const guard = createEngineGuard({
    demoFixtures,
    clientIp: () => ADDRESS,
    fromOwnOrigin: (request) => fromOwnOrigin(request, APP_ORIGIN),
    userId: async (_request, now) => {
      step("userId", now.toISOString());
      return user;
    },
    countAttempt: async (key) => {
      step("countAttempt", key);
      await roundTrip();
      const count = (stored.get(key) ?? 0) + 1;
      stored.set(key, count);
      return count;
    },
    now: () => NOW,
    logError: (message) => logged.push(message),
  });
  const headers: Record<string, string> = origin === null ? {} : { origin };
  const ask = (route: EngineRoute): Promise<EngineAccess> =>
    guard(new Request(`${APP_ORIGIN}/api/${route}`, { method: "POST", headers }), route);
  return { ask, stored, calls, logged };
}

async function liveAnswers(route: EngineRoute, count: number): Promise<boolean[]> {
  const { ask } = guardOver({ user: USER });
  const answers: boolean[] = [];
  for (let i = 0; i < count; i++) {
    const access = await ask(route);
    if (!access.ok) throw new Error(`refused after ${i} requests`);
    answers.push(access.live);
  }
  return answers;
}

function outcome(access: EngineAccess): "live" | "cache" | "refused" {
  if (!access.ok) return "refused";
  return access.live ? "live" : "cache";
}

describe("createEngineGuard", () => {
  test("an anonymous request is cache-only and counted against its address", async () => {
    const { ask, stored } = guardOver();
    expect(await ask("search")).toEqual({ ok: true, live: false });
    expect(Object.fromEntries(stored)).toEqual({ "engine:search:ip:198.51.100.7": 1 });
  });

  test("a signed-in person under their live limit may reach the model", async () => {
    const { ask, stored, calls } = guardOver({ user: USER });
    expect(await ask("brief")).toEqual({ ok: true, live: true });
    expect(Object.fromEntries(stored)).toEqual({
      "engine:brief:ip:198.51.100.7": 1,
      [`engine:brief:live:${USER}`]: 1,
    });
    expect(calls).toContain("userId 2026-10-19T09:00:00.000Z");
  });

  test("over the personal live limit the answer is cache-only, not an error", async () => {
    expect(await liveAnswers("search", 21)).toEqual([...Array<boolean>(20).fill(true), false]);
    expect(await liveAnswers("brief", 6)).toEqual([...Array<boolean>(5).fill(true), false]);
    expect(await liveAnswers("agent", 11)).toEqual([...Array<boolean>(10).fill(true), false]);
  });

  test("requests in flight together cannot pass a limit by reading the same count", async () => {
    const { ask, stored } = guardOver({ user: USER });
    const answers = await Promise.all(Array.from({ length: 12 }, () => ask("brief")));
    const tally = Object.groupBy(answers, outcome);
    expect([tally.live?.length, tally.cache?.length, tally.refused?.length]).toEqual([5, 5, 2]);
    expect(Object.fromEntries(stored)).toEqual({
      "engine:brief:ip:198.51.100.7": 12,
      [`engine:brief:live:${USER}`]: 10,
    });
  });

  test("a post from another origin, or with none, is cache-only and looks nobody up", async () => {
    for (const origin of ["http://127.0.0.1:4000", null]) {
      const { ask, stored, calls } = guardOver({ user: USER, origin });
      expect(await ask("search")).toEqual({ ok: true, live: false });
      expect(Object.fromEntries(stored)).toEqual({ "engine:search:ip:198.51.100.7": 1 });
      expect(calls).toEqual(["countAttempt engine:search:ip:198.51.100.7"]);
    }
  });

  test("over the address limit the request is refused with 429 before anyone is looked up", async () => {
    for (const [route, limit] of [
      ["search", 60],
      ["brief", 10],
      ["agent", 20],
    ] as const) {
      const { ask, calls } = guardOver({ user: USER });
      for (let i = 0; i < limit; i++) expect((await ask(route)).ok).toBe(true);
      const refused = await ask(route);
      const response = refused.ok ? null : refused.response;
      expect(response?.status).toBe(429);
      expect(await response?.json()).toEqual({ error: "rate_limited" });
      expect(calls.filter((call) => call.startsWith("userId"))).toHaveLength(limit);
    }
  });

  test("routes and addresses are counted apart", async () => {
    const { ask } = guardOver({ counts: { "engine:brief:ip:198.51.100.7": 10 } });
    expect((await ask("brief")).ok).toBe(false);
    expect(await ask("search")).toEqual({ ok: true, live: false });
    expect(
      (await guardOver({ counts: { "engine:brief:ip:203.0.113.9": 10 } }).ask("brief")).ok,
    ).toBe(true);
  });

  test("a limiter whose database fails means cache-only, never an error", async () => {
    for (const failingStep of ["countAttempt", "userId"] as const) {
      const { ask, logged } = guardOver({ user: USER, failingStep });
      expect(await ask("agent")).toEqual({ ok: true, live: false });
      expect(logged).toEqual(["engine guard: limiter unavailable, answering from the cache only"]);
    }
  });

  test("with DEMO_FIXTURES the limiter is never called", async () => {
    const { ask, calls } = guardOver({ user: USER, demoFixtures: true });
    expect(await ask("search")).toEqual({ ok: true, live: false });
    expect(calls).toEqual([]);
  });
});

const testDb = openTestDb();
if (testDb === null) test.skip(SKIPPED, () => {});

describe.skipIf(testDb === null)("countAttempt against a throwaway database", () => {
  const sql = testDb as Sql;

  beforeEach(() => emptyTables(sql));
  afterAll(async () => {
    await emptyTables(sql);
    await sql.end();
  });

  test("attempts in flight together each get their own count", async () => {
    const key = "engine:brief:ip:198.51.100.7";
    const counts = await Promise.all(Array.from({ length: 12 }, () => countAttempt(sql, key, NOW)));
    expect(counts.toSorted((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });
});
