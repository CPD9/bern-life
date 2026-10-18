// The SQL behind messages. Membership is part of every query (a join or an EXISTS on `member`),
// not a check made beforehand, so no query can read or write a conversation its caller is not in.
// Posting and deleting notify the `messages` channel with ids only; the live hub fans that out.
import type { Db, Sql } from "@/infrastructure/db";
import { encodeCursor, type Cursor, type Start } from "./input";
import type { ConversationSummary, MessagePage, MessageView, Notice } from "./types";

export const CHANNEL = "messages";

type MessageRow = {
  id: string;
  body: string;
  createdAt: Date;
  mine: boolean;
  handle: string;
  displayName: string;
};

function view(row: MessageRow): MessageView {
  return {
    id: row.id,
    author: { handle: row.handle, displayName: row.displayName },
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    mine: row.mine,
  };
}

async function notify(db: Db, notice: Notice): Promise<void> {
  await db`select pg_notify(${CHANNEL}, ${JSON.stringify(notice)})`;
}

export async function conversationsOf(db: Db, me: string): Promise<ConversationSummary[]> {
  return db<ConversationSummary[]>`
    select c.id, c.kind::text as kind, c.title,
      (select coalesce(json_agg(json_build_object('handle', u.handle, 'displayName', u.display_name)
                                order by u.handle), '[]'::json)
         from member m join app_user u on u.id = m.user_id where m.conversation_id = c.id) as members,
      (select json_build_object('body', x.body, 'at', x.created_at,
                                'author', json_build_object('handle', a.handle, 'displayName', a.display_name))
         from message x join app_user a on a.id = x.author_id
         where x.conversation_id = c.id and x.deleted_at is null
         order by x.created_at desc, x.id desc limit 1) as last,
      (select count(*)::int from message x
         where x.conversation_id = c.id and x.deleted_at is null and x.author_id <> ${me}
           and x.created_at > coalesce(mine.last_read_at, '-infinity')) as unread
    from conversation c
    join member mine on mine.conversation_id = c.id and mine.user_id = ${me}
    order by coalesce((select max(x.created_at) from message x where x.conversation_id = c.id),
                      c.created_at) desc, c.id`;
}

/** The conversation's id, or why not: an unknown handle (or yourself) cannot be messaged. */
export async function startConversation(
  sql: Sql,
  me: string,
  start: Start,
): Promise<string | "unknown_handle"> {
  const handles = start.kind === "direct" ? [start.handle] : start.handles;
  return sql.begin(async (tx) => {
    const others = await tx<{ id: string }[]>`
      select id from app_user where handle in ${tx(handles)} and id <> ${me}`;
    if (others.length !== handles.length) return "unknown_handle" as const;
    const ids = [me, ...others.map((o) => o.id)];
    let id: string;
    if (start.kind === "direct") {
      const key = [...ids].sort().join(":");
      await tx`insert into conversation (id, kind, direct_key) values (gen_random_uuid(), 'direct', ${key})
               on conflict (direct_key) do nothing`;
      const [row] = await tx<
        { id: string }[]
      >`select id from conversation where direct_key = ${key}`;
      id = (row as { id: string }).id;
    } else {
      const [row] = await tx<{ id: string }[]>`
        insert into conversation (id, kind, title) values (gen_random_uuid(), 'group', ${start.title})
        returning id`;
      id = (row as { id: string }).id;
    }
    for (const user of ids) {
      await tx`insert into member (conversation_id, user_id) values (${id}, ${user}) on conflict do nothing`;
    }
    return id;
  });
}

/** A page of messages, newest first, or null when the caller is not a member. */
export async function messagesIn(
  db: Db,
  me: string,
  conversationId: string,
  before: Cursor | null,
  limit: number,
): Promise<MessagePage | null> {
  const [member] =
    await db`select 1 from member where conversation_id = ${conversationId} and user_id = ${me}`;
  if (member === undefined) return null;
  const older =
    before === null ? db`` : db`and (x.created_at, x.id) < (${before.at}, ${before.id})`;
  const rows = await db<MessageRow[]>`
    select x.id, x.body, x.created_at as "createdAt", x.author_id = ${me} as mine,
           a.handle, a.display_name as "displayName"
    from message x
    join member mine on mine.conversation_id = x.conversation_id and mine.user_id = ${me}
    join app_user a on a.id = x.author_id
    where x.conversation_id = ${conversationId} and x.deleted_at is null ${older}
    order by x.created_at desc, x.id desc
    limit ${limit + 1}`;
  const page = rows.slice(0, limit);
  const oldest = page.at(-1);
  const next =
    rows.length > limit && oldest ? encodeCursor({ at: oldest.createdAt, id: oldest.id }) : null;
  return { messages: page.map(view), next };
}

/** The new message, or null when the caller is not a member. */
export async function post(
  sql: Sql,
  me: string,
  conversationId: string,
  body: string,
  now: Date,
): Promise<MessageView | null> {
  return sql.begin(async (tx) => {
    const [row] = await tx<MessageRow[]>`
      insert into message (id, conversation_id, author_id, body, created_at)
      select gen_random_uuid(), ${conversationId}, ${me}, ${body}, ${now}
      where exists (select 1 from member where conversation_id = ${conversationId} and user_id = ${me})
      returning id, body, created_at as "createdAt", true as mine,
        (select handle from app_user where id = ${me}) as handle,
        (select display_name from app_user where id = ${me}) as "displayName"`;
    if (row === undefined) return null;
    await notify(tx, { conversationId, messageId: row.id, kind: "posted" });
    return view(row);
  });
}

/** Hides your own message and drops its text; false when it is not yours or not there. */
export async function deleteOwn(
  sql: Sql,
  me: string,
  conversationId: string,
  messageId: string,
  now: Date,
): Promise<boolean> {
  return sql.begin(async (tx) => {
    const deleted = await tx`
      update message set deleted_at = ${now}, body = ''
      where id = ${messageId} and conversation_id = ${conversationId} and author_id = ${me}
        and deleted_at is null
        and exists (select 1 from member where conversation_id = ${conversationId} and user_id = ${me})
      returning id`;
    if (deleted.count === 0) return false;
    await notify(tx, { conversationId, messageId, kind: "deleted" });
    return true;
  });
}

export async function markRead(
  db: Db,
  me: string,
  conversationId: string,
  now: Date,
): Promise<boolean> {
  const updated = await db`update member set last_read_at = ${now}
                           where conversation_id = ${conversationId} and user_id = ${me} returning user_id`;
  return updated.count > 0;
}

export async function unreadTotal(db: Db, me: string): Promise<number> {
  const [row] = await db<{ unread: number }[]>`
    select count(*)::int as unread
    from member mine join message x on x.conversation_id = mine.conversation_id
    where mine.user_id = ${me} and x.deleted_at is null and x.author_id <> ${me}
      and x.created_at > coalesce(mine.last_read_at, '-infinity')`;
  return row?.unread ?? 0;
}

export async function membersOf(db: Db, conversationId: string): Promise<string[]> {
  const rows = await db<{ userId: string }[]>`
    select user_id as "userId" from member where conversation_id = ${conversationId}`;
  return rows.map((row) => row.userId);
}
