import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import type { Sql } from "@/infrastructure/db";
import { SKIPPED, emptyTables, openTestDb } from "@/infrastructure/test-database";
import { listNotifications } from "../notifications/handlers";
import { NOW, type TestMember, json, member, request, testDeps } from "../testing";
import { CONNECTION_LIMITS, answerConnection, askToConnect, listRequests } from "./handlers";

const testDb = openTestDb();
if (testDb === null) test.skip(SKIPPED, () => {});

describe.skipIf(testDb === null)("connection routes against a throwaway database", () => {
  const sql = testDb as Sql;
  const deps = testDeps(sql);
  let ada: TestMember;
  let bea: TestMember;
  let cem: TestMember;

  const ask = (as: TestMember | null, body: unknown, origin?: string) =>
    askToConnect(request("/api/connections", { as, body, ...(origin ? { origin } : {}) }), deps);
  const answer = (as: TestMember, id: string, verdict: string) =>
    answerConnection(
      request(`/api/connections/${id}`, { as, body: { answer: verdict } }),
      deps,
      id,
    );
  const asked = async (as: TestMember, body: unknown) => {
    const response = await ask(as, body);
    expect(response.status).toBe(201);
    return ((await response.json()) as { id: string }).id;
  };
  const requests = async (as: TestMember) =>
    (
      (await json(await listRequests(request("/api/connections", { as }), deps))) as {
        requests: { person: { handle: string }; status: string; direction: string }[];
      }
    ).requests.map((r) => `${r.person.handle}:${r.status}:${r.direction}`);
  const unread = async (as: TestMember) =>
    (
      (await json(await listRequests(request("/api/connections", { as }), deps))) as {
        requests: { unread: boolean }[];
      }
    ).requests.map((r) => r.unread);
  const told = async (as: TestMember) =>
    (
      (await json(await listNotifications(request("/api/notifications", { as }), deps))) as {
        notifications: { title: string; read: boolean }[];
      }
    ).notifications.map((n) => `${n.title}${n.read ? " (read)" : ""}`);

  beforeEach(async () => {
    await emptyTables(sql);
    ada = await member(sql, "ada");
    bea = await member(sql, "bea", "public");
    cem = await member(sql, "cem", "private");
  });
  afterAll(async () => {
    await emptyTables(sql);
    await sql.end();
  });

  test("a change needs the app's own origin, a session, and stays within the limit", async () => {
    const other = await ask(ada, { handle: "bea" }, "https://elsewhere.example");
    expect([other.status, await other.json()]).toEqual([403, { error: "forbidden" }]);
    const anonymous = await ask(null, { handle: "bea" });
    expect([anonymous.status, await anonymous.json()]).toEqual([401, { error: "unauthenticated" }]);
    expect((await listRequests(request("/api/connections"), deps)).status).toBe(401);

    const key = `${CONNECTION_LIMITS.ask.key}:user:${ada.id}`;
    await sql`insert into rate_limit (key, window_start, count)
              values (${key}, ${NOW}, ${CONNECTION_LIMITS.ask.max})`;
    const flooded = await ask(ada, { handle: "bea" });
    expect([flooded.status, await flooded.json()]).toEqual([429, { error: "rate_limited" }]);
    expect(await requests(bea)).toEqual([]);
  });

  test("only a member whose profile members may see can be asked; others look unknown", async () => {
    const tries = [
      await ask(ada, { handle: "cem" }),
      await ask(ada, { handle: "nobody" }),
      await ask(ada, { handle: "ada" }),
    ];
    expect(tries.map((r) => r.status)).toEqual([404, 404, 404]);
    expect((await ask(ada, { handle: "bea", note: "x".repeat(281) })).status).toBe(400);
    expect((await ask(ada, { handle: "bea", note: "a\u0007b" })).status).toBe(400);
    expect(await requests(cem)).toEqual([]);
    expect(await told(cem)).toEqual([]);
  });

  test("the recipient accepts once; both are told, and the pair is connected", async () => {
    const id = await asked(ada, { handle: "BEA", note: "  Glucose sensors?  " });
    expect(await requests(ada)).toEqual(["bea:pending:outgoing"]);
    expect(await requests(bea)).toEqual(["ada:pending:incoming"]);
    expect(await told(bea)).toEqual(["Ada asks to connect"]);
    const [stored] = await sql`select note from connection_request where id = ${id}`;
    expect(stored?.note).toBe("Glucose sensors?");

    expect((await ask(ada, { handle: "bea" })).status).toBe(409);
    expect((await ask(bea, { handle: "ada" })).status).toBe(409);
    expect((await answer(cem, id, "accept")).status).toBe(404);
    expect((await answer(ada, id, "accept")).status).toBe(404);
    expect((await answer(bea, id, "maybe")).status).toBe(400);
    expect((await answer(bea, "not-an-id", "accept")).status).toBe(404);

    expect((await answer(bea, id, "accept")).status).toBe(204);
    expect((await answer(bea, id, "decline")).status).toBe(404);
    expect(await requests(ada)).toEqual(["bea:accepted:outgoing"]);
    expect(await told(ada)).toEqual(["Bea accepted your request"]);
    expect(await told(bea)).toEqual(["You and Ada are connected (read)"]);
    expect([await unread(ada), await unread(bea)]).toEqual([[true], [false]]);
    await sql`update notification set read_at = ${NOW} where user_id = ${ada.id}`;
    expect(await unread(ada)).toEqual([false]);
    const again = await ask(ada, { handle: "bea" });
    expect([again.status, await again.json()]).toEqual([409, { error: "connected" }]);
  });

  test("a decline holds against its sender; the one who declined may ask; a withdrawal clears", async () => {
    await sql`update user_profile set visibility = 'members' where user_id = ${cem.id}`;
    const id = await asked(ada, { handle: "cem" });
    expect((await answer(cem, id, "decline")).status).toBe(204);
    expect(await requests(ada)).toEqual(["cem:declined:outgoing"]);
    expect(await told(cem)).toEqual(["You declined Ada's request (read)"]);
    expect((await ask(ada, { handle: "cem" })).status).toBe(409);

    expect(await asked(cem, { handle: "ada" })).toBe(id);
    expect(await requests(ada)).toEqual(["cem:pending:incoming"]);
    expect(await told(cem)).toEqual([]);
    expect(await told(ada)).toEqual(["Cem asks to connect"]);
    expect((await answer(ada, id, "withdraw")).status).toBe(404);
    expect((await answer(cem, id, "withdraw")).status).toBe(204);
    expect([await requests(ada), await told(ada)]).toEqual([[], []]);
    expect(await asked(ada, { handle: "cem" })).toBe(id);
  });
});
