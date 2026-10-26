import { describe, expect, test } from "bun:test";
import activity from "../../../../contracts/fixtures/admin-activity.json";
import flagged from "../../../../contracts/fixtures/admin-flagged.json";
import type { User } from "@/features/accounts/store";
import { createEngineClient } from "@/infrastructure/engine-client";
import type { Sql } from "@/infrastructure/db";
import type { MemberRouteDeps } from "../member-route";
import { NOW, ORIGIN, request } from "../testing";
import { adminActivity, adminFlagged } from "./handlers";

const ADMIN: User = { id: "u-admin", handle: "admin", displayName: "Admin", role: "admin" };
const MEMBER: User = { id: "u-ada", handle: "ada", displayName: "Ada", role: "member" };

/** Sessions are faked by the Cookie header's value; the database is never reached. */
function fakeDeps(users: Record<string, User>): MemberRouteDeps {
  return {
    sql: {} as Sql,
    appOrigin: ORIGIN,
    now: () => NOW,
    userOf: async (incoming) => {
      const cookie = incoming.headers.get("cookie") ?? "";
      return users[cookie.replace("bl_session=", "")] ?? null;
    },
  };
}

function engineAnswering(answer: (path: string) => Response) {
  const asked: string[] = [];
  const client = createEngineClient({
    baseUrl: new URL("http://127.0.0.1:8100"),
    fetch: async (url) => {
      asked.push(url.pathname);
      return answer(url.pathname);
    },
    logError: () => {},
    timeoutMs: 1000,
  });
  return { engine: () => client, asked };
}

const fixtures = (path: string) =>
  Response.json(path === "/api/admin/activity" ? activity : flagged);

function asUser(path: string, token: string | null) {
  const headers: Record<string, string> = { origin: ORIGIN };
  if (token !== null) headers.cookie = `bl_session=${token}`;
  return new Request(`${ORIGIN}${path}`, { headers });
}

describe("admin routes", () => {
  const users = { "admin-token": ADMIN, "ada-token": MEMBER };

  test("an admin gets the engine's answer, passed on whole", async () => {
    const { engine, asked } = engineAnswering(fixtures);
    const deps = { ...fakeDeps(users), engine };
    const shown = await adminActivity(asUser("/api/admin/activity", "admin-token"), deps);
    expect([shown.status, await shown.json()]).toEqual([200, activity]);
    const people = await adminFlagged(asUser("/api/admin/flagged", "admin-token"), deps);
    expect([people.status, await people.json()]).toEqual([200, flagged]);
    expect(asked).toEqual(["/api/admin/activity", "/api/admin/flagged"]);
  });

  test("a member is forbidden and the engine is never asked", async () => {
    const { engine, asked } = engineAnswering(fixtures);
    const deps = { ...fakeDeps(users), engine };
    for (const handler of [adminActivity, adminFlagged]) {
      const refused = await handler(asUser("/api/admin/activity", "ada-token"), deps);
      expect([refused.status, await refused.json()]).toEqual([403, { error: "forbidden" }]);
    }
    expect(asked).toEqual([]);
  });

  test("signed out is unauthenticated, as on every member route", async () => {
    const { engine, asked } = engineAnswering(fixtures);
    const deps = { ...fakeDeps(users), engine };
    const refused = await adminActivity(asUser("/api/admin/activity", null), deps);
    expect([refused.status, await refused.json()]).toEqual([401, { error: "unauthenticated" }]);
    const stale = await adminFlagged(request("/api/admin/flagged", { as: null }), deps);
    expect(stale.status).toBe(401);
    expect(asked).toEqual([]);
  });

  test("an engine body off the contract reaches the admin as an engine error, never as data", async () => {
    const { engine } = engineAnswering(() =>
      Response.json({ people: [{ name: "x", error: "raw provider text" }] }),
    );
    const deps = { ...fakeDeps(users), engine };
    const response = await adminFlagged(asUser("/api/admin/flagged", "admin-token"), deps);
    expect([response.status, await response.json()]).toEqual([502, { error: "engine_error" }]);
  });
});
