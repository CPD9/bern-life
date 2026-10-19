import { describe, expect, test } from "bun:test";
import { createEngineGuard, type EngineAccess, type EngineRoute } from "./engine-guard";

const NOW = new Date("2026-10-19T09:00:00Z");
const ADDRESS = "198.51.100.7";
const USER = "0b6f3c2e-9a41-4d7e-8c55-2f1e7a9d4b10";

type Step = "attempts" | "recordAttempt" | "userId";
type Setup = {
  readonly user?: string | null;
  readonly counts?: Record<string, number>;
  readonly demoFixtures?: boolean;
  readonly failingStep?: Step;
};

/** A guard over an in-memory limiter that records every call it gets. */
function guardOver({ user = null, counts = {}, demoFixtures = false, failingStep }: Setup = {}) {
  const stored = new Map(Object.entries(counts));
  const calls: string[] = [];
  const logged: string[] = [];
  const step = (name: Step, detail: string) => {
    calls.push(`${name} ${detail}`);
    if (name === failingStep) throw new Error("connect ECONNREFUSED 127.0.0.1:5433");
  };
  const guard = createEngineGuard({
    demoFixtures,
    clientIp: () => ADDRESS,
    userId: async (_request, now) => {
      step("userId", now.toISOString());
      return user;
    },
    attempts: async (key) => {
      step("attempts", key);
      return stored.get(key) ?? 0;
    },
    recordAttempt: async (key) => {
      step("recordAttempt", key);
      stored.set(key, (stored.get(key) ?? 0) + 1);
    },
    now: () => NOW,
    logError: (message) => logged.push(message),
  });
  const ask = (route: EngineRoute): Promise<EngineAccess> =>
    guard(new Request("http://127.0.0.1:3013/api/search", { method: "POST" }), route);
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
    for (const failingStep of ["attempts", "recordAttempt", "userId"] as const) {
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
