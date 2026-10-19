import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { startConversation } from "@/features/messages/store";
import { notifyUser } from "@/features/notifications/server-store";
import type { Sql } from "@/infrastructure/db";
import { SKIPPED, emptyTables, openTestDb } from "@/infrastructure/test-database";
import { postAndTell, readArrivals } from "../messages/arrivals";
import { NOW, type TestMember, json, member, request, testDeps } from "../testing";
import {
  NOTIFICATION_LIMITS,
  getPreferences,
  listNotifications,
  parsePreferences,
  parseRead,
  putPreferences,
  readNotifications,
} from "./handlers";

const ID = "11111111-1111-4111-8111-111111111111";

describe("notification input", () => {
  test("read takes all, or one to 50 ids; preferences take a boolean", () => {
    expect(parseRead({ all: true })).toBe("all");
    expect(parseRead({ ids: [ID] })).toEqual([ID]);
    expect([
      parseRead({ ids: [] }),
      parseRead({ ids: ["x"] }),
      parseRead({ ids: Array(51).fill(ID) }),
      parseRead(null),
    ]).toEqual([null, null, null, null]);
    expect([parsePreferences({ inApp: false }), parsePreferences({ inApp: "no" })]).toEqual([
      { inApp: false },
      null,
    ]);
  });
});

const testDb = openTestDb();
if (testDb === null) test.skip(SKIPPED, () => {});

describe.skipIf(testDb === null)("notification routes against a throwaway database", () => {
  const sql = testDb as Sql;
  const deps = testDeps(sql);
  let ada: TestMember;
  let bea: TestMember;

  type Listed = { notifications: { id: string; kind: string; title: string; read: boolean }[] };
  const list = async (as: TestMember) =>
    ((await json(await listNotifications(request("/api/notifications", { as }), deps))) as Listed)
      .notifications;
  const read = (as: TestMember | null, body: unknown, origin?: string) =>
    readNotifications(
      request("/api/notifications/read", { as, body, ...(origin ? { origin } : {}) }),
      deps,
    );
  const prefer = (as: TestMember | null, body: unknown, origin?: string) =>
    putPreferences(
      request("/api/notifications/preferences", {
        as,
        body,
        method: "PUT",
        ...(origin ? { origin } : {}),
      }),
      deps,
    );
  async function directWith(from: TestMember, to: TestMember): Promise<string> {
    const id = await startConversation(sql, from.id, { kind: "direct", handle: to.handle });
    if (id === "unknown_handle") throw new Error("expected a conversation");
    return id;
  }

  beforeEach(async () => {
    await emptyTables(sql);
    ada = await member(sql, "ada");
    bea = await member(sql, "bea");
  });
  afterAll(async () => {
    await emptyTables(sql);
    await sql.end();
  });

  test("a message tells the others once per conversation, never its text; reading clears it", async () => {
    const id = await directWith(ada, bea);
    await postAndTell(sql, ada.id, id, "The secret glucose numbers", NOW);
    await postAndTell(sql, ada.id, id, "And a second one", NOW);
    const told = await list(bea);
    expect(told.map((n) => [n.kind, n.title, n.read])).toEqual([
      ["message", "New message from Ada", false],
    ]);
    expect(JSON.stringify(told)).not.toContain("glucose");
    expect(await list(ada)).toEqual([]);
    const stored = await sql`select ref from notification`;
    expect(stored.map((row) => row.ref)).toEqual([id]);

    await readArrivals(sql, bea.id, id, NOW);
    expect((await list(bea)).map((n) => n.read)).toEqual([true]);
    await postAndTell(sql, ada.id, id, "A third", new Date(NOW.getTime() + 60_000));
    expect((await list(bea)).map((n) => n.read)).toEqual([false, true]);
  });

  test("notifications about one thing at the same moment leave one unread", async () => {
    const id = await directWith(ada, bea);
    await Promise.all([1, 2, 3, 4].map(() => notifyUser(sql, bea.id, "message", id, NOW)));
    const rows = await sql`select read_at from notification where user_id = ${bea.id}`;
    expect(rows.map((row) => row.read_at)).toEqual([null]);
  });

  test("a notification that cannot be written is logged and the message still counts", async () => {
    const id = await directWith(ada, bea);
    const logged: string[] = [];
    await sql`alter table notification add constraint test_refuse check (false) not valid`;
    try {
      const message = await postAndTell(sql, ada.id, id, "Hello", NOW, (text) => logged.push(text));
      expect(message?.body).toBe("Hello");
    } finally {
      await sql`alter table notification drop constraint test_refuse`;
    }
    expect(logged).toEqual(["messages: the arrival notification was not written"]);
  });

  test("marking read needs the origin, a session and the limit, and touches only your own", async () => {
    const id = await directWith(ada, bea);
    await postAndTell(sql, ada.id, id, "Hello", NOW);
    await postAndTell(sql, bea.id, id, "Hi", NOW);
    const [mine] = await list(bea);
    const [theirs] = await list(ada);
    if (mine === undefined || theirs === undefined) throw new Error("expected notifications");

    expect((await read(bea, { ids: [mine.id] }, "https://elsewhere.example")).status).toBe(403);
    expect((await read(null, { all: true })).status).toBe(401);
    expect((await read(bea, { ids: "all" })).status).toBe(400);
    expect((await read(bea, { ids: [theirs.id] })).status).toBe(204);
    expect((await list(ada)).map((n) => n.read)).toEqual([false]);
    expect((await read(bea, { ids: [mine.id] })).status).toBe(204);
    expect((await list(bea)).map((n) => n.read)).toEqual([true]);

    const key = `${NOTIFICATION_LIMITS.read.key}:user:${ada.id}`;
    await sql`insert into rate_limit (key, window_start, count)
              values (${key}, ${NOW}, ${NOTIFICATION_LIMITS.read.max})`;
    expect((await read(ada, { all: true })).status).toBe(429);
    expect((await list(ada)).map((n) => n.read)).toEqual([false]);
  });

  test("in-app notifications are on until turned off, and off means none are kept", async () => {
    const get = (as: TestMember | null) =>
      getPreferences(request("/api/notifications/preferences", { as }), deps);
    expect(await (await get(bea)).json()).toEqual({ inApp: true });
    expect((await get(null)).status).toBe(401);
    expect((await prefer(bea, { inApp: false }, "https://elsewhere.example")).status).toBe(403);
    expect((await prefer(null, { inApp: false })).status).toBe(401);
    expect((await prefer(bea, { inApp: "off" })).status).toBe(400);
    const off = await prefer(bea, { inApp: false });
    expect([off.status, await off.json()]).toEqual([200, { inApp: false }]);
    expect(await (await get(bea)).json()).toEqual({ inApp: false });

    const id = await directWith(ada, bea);
    await postAndTell(sql, ada.id, id, "Hello", NOW);
    expect(await list(bea)).toEqual([]);
    await prefer(bea, { inApp: true });
    await postAndTell(sql, ada.id, id, "Again", NOW);
    expect((await list(bea)).length).toBe(1);
  });
});
