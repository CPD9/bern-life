import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { deleteUser } from "@/features/accounts/store";
import type { Sql } from "@/infrastructure/db";
import { SKIPPED, emptyTables, openTestDb } from "@/infrastructure/test-database";
import { decodeCursor, parseBody } from "./input";
import { Hub } from "./live";
import {
  conversationsOf,
  deleteOwn,
  markRead,
  membersOf,
  messagesIn,
  post,
  startConversation,
  unreadTotal,
} from "./store";
import type { MessagePage, Notice } from "./types";

const NOW = new Date("2026-10-18T21:00:00Z");
const seconds = (n: number) => new Date(NOW.getTime() + n * 1000);

const testDb = openTestDb();
if (testDb === null) test.skip(SKIPPED, () => {});

describe.skipIf(testDb === null)("messages against a throwaway database", () => {
  const sql = testDb as Sql;
  let a = "";
  let b = "";
  let c = "";

  async function person(handle: string): Promise<string> {
    const [row] = await sql<{ id: string }[]>`insert into app_user (id, handle, display_name)
      values (gen_random_uuid(), ${handle}, ${handle.toUpperCase()}) returning id`;
    return (row as { id: string }).id;
  }

  async function direct(from: string, to: string): Promise<string> {
    const id = await startConversation(sql, from, { kind: "direct", handle: to });
    if (id === "unknown_handle") throw new Error("expected a conversation");
    return id;
  }

  function bodies(page: MessagePage | null): string[] {
    return (page?.messages ?? []).map((m) => m.body);
  }

  beforeEach(async () => {
    await emptyTables(sql);
    [a, b, c] = [await person("ada"), await person("bea"), await person("cem")];
  });
  afterAll(async () => {
    await emptyTables(sql);
    await sql.end();
  });

  test("a pair has one direct conversation; a group needs known handles", async () => {
    const first = await direct(a, "bea");
    expect(await direct(b, "ada")).toBe(first);
    const group = await startConversation(sql, a, {
      kind: "group",
      title: "Bern Life",
      handles: ["bea", "cem"],
    });
    expect(group).not.toBe(first);
    expect(await startConversation(sql, a, { kind: "direct", handle: "nobody" })).toBe(
      "unknown_handle",
    );
    expect(await startConversation(sql, a, { kind: "direct", handle: "ada" })).toBe(
      "unknown_handle",
    );
    const summaries = await conversationsOf(sql, c);
    expect(summaries.map((s) => [s.kind, s.title, s.members.map((m) => m.handle)])).toEqual([
      ["group", "Bern Life", ["ada", "bea", "cem"]],
    ]);
  });

  test("only members can read, post, delete or mark read", async () => {
    const chat = await direct(a, "bea");
    const hello = await post(sql, a, chat, "Hallo Bea", NOW);
    expect(await messagesIn(sql, c, chat, null, 50)).toBeNull();
    expect(await post(sql, c, chat, "let me in", NOW)).toBeNull();
    expect(await deleteOwn(sql, c, chat, hello?.id ?? "", NOW)).toBe(false);
    expect(await markRead(sql, c, chat, NOW)).toBe(false);
    const seenByBea = await messagesIn(sql, b, chat, null, 50);
    expect(seenByBea?.messages.map((m) => [m.body, m.mine, m.author.handle])).toEqual([
      ["Hallo Bea", false, "ada"],
    ]);
    expect((await messagesIn(sql, a, chat, null, 50))?.messages[0]?.mine).toBe(true);
  });

  test("deleting hides a message for everyone and drops its text; only its author can", async () => {
    const chat = await direct(a, "bea");
    const hello = await post(sql, a, chat, "Hallo Bea", NOW);
    expect(await deleteOwn(sql, b, chat, hello?.id ?? "", NOW)).toBe(false);
    expect(await deleteOwn(sql, a, chat, hello?.id ?? "", NOW)).toBe(true);
    expect(bodies(await messagesIn(sql, b, chat, null, 50))).toEqual([]);
    const [row] = await sql<{ body: string; deleted: boolean }[]>`
      select body, deleted_at is not null as deleted from message where id = ${hello?.id ?? ""}`;
    expect(row).toEqual({ body: "", deleted: true });
  });

  test("unread counts other people's messages since the last read", async () => {
    const chat = await direct(a, "bea");
    await post(sql, a, chat, "one", NOW);
    await post(sql, a, chat, "two", seconds(1));
    expect([await unreadTotal(sql, b), await unreadTotal(sql, a)]).toEqual([2, 0]);
    expect((await conversationsOf(sql, b))[0]?.last?.body).toBe("two");
    expect(await markRead(sql, b, chat, seconds(2))).toBe(true);
    expect(await unreadTotal(sql, b)).toBe(0);
    await post(sql, a, chat, "three", seconds(3));
    expect((await conversationsOf(sql, b))[0]?.unread).toBe(1);
  });

  test("pagination is exact across a page boundary", async () => {
    const chat = await direct(a, "bea");
    for (let i = 0; i < 55; i++) await post(sql, a, chat, `m${i}`, seconds(i));
    const first = await messagesIn(sql, b, chat, null, 50);
    expect(bodies(first)).toEqual(Array.from({ length: 50 }, (_, i) => `m${54 - i}`));
    const before = decodeCursor(first?.next ?? null);
    if (before === null || before === "invalid") throw new Error("expected a cursor");
    const second = await messagesIn(sql, b, chat, before, 50);
    expect([bodies(second), second?.next]).toEqual([["m4", "m3", "m2", "m1", "m0"], null]);
  });

  test("a body over 4,000 characters is refused by the parser and by the database", async () => {
    expect(parseBody({ body: "x".repeat(4001) })).toBeNull();
    expect(parseBody({ body: `  ${"x".repeat(4000)}  ` })).toBe("x".repeat(4000));
    expect(parseBody({ body: "   " })).toBeNull();
    const chat = await direct(a, "bea");
    // postgres runs a query only when its then() is called, so the outcome is taken explicitly.
    const outcome = await sql`insert into message (id, conversation_id, author_id, body)
      values (gen_random_uuid(), ${chat}, ${a}, ${"x".repeat(4001)})`.then(
      () => "inserted",
      (error: Error) => error.message,
    );
    expect(outcome).toContain("message_body_length");
  });

  test("the live stream tells the other member and never a non-member", async () => {
    const live = new Hub(
      (channel, onPayload) => sql.listen(channel, onPayload),
      (conversationId) => membersOf(sql, conversationId),
    );
    const toBea: Notice[] = [];
    const toCem: Notice[] = [];
    let arrived: () => void = () => {};
    const delivered = new Promise<void>((resolve) => {
      arrived = resolve;
    });
    const stopBea = await live.subscribe(b, (notice) => {
      toBea.push(notice);
      arrived();
    });
    const stopCem = await live.subscribe(c, (notice) => toCem.push(notice));
    const chat = await direct(a, "bea");
    const hello = await post(sql, a, chat, "Hallo Bea", NOW);
    await Promise.race([delivered, Bun.sleep(3000)]);
    await Bun.sleep(200);
    stopBea();
    stopCem();
    expect(toBea).toEqual([{ conversationId: chat, messageId: hello?.id ?? "", kind: "posted" }]);
    expect(toCem).toEqual([]);
  });

  test("deleting an account removes its memberships, messages and conversations left empty", async () => {
    const withBea = await direct(a, "bea");
    const alone = await startConversation(sql, a, {
      kind: "group",
      title: "Notes",
      handles: ["cem"],
    });
    await sql`delete from member where conversation_id = ${alone} and user_id = ${c}`;
    await post(sql, a, withBea, "bye", NOW);
    await deleteUser(sql, a);
    const [left] = await sql<{ members: number; messages: number; conversations: string[] }[]>`
      select (select count(*)::int from member where user_id = ${a}) as members,
             (select count(*)::int from message where author_id = ${a}) as messages,
             (select coalesce(array_agg(id::text order by id), '{}') from conversation) as conversations`;
    expect(left).toEqual({ members: 0, messages: 0, conversations: [withBea] });
  });
});
