// The SQL behind in-app notifications kept for an account. A row says whom, what kind and the id
// of what it is about; listing reads the current state of that thing (who asked, who wrote) and
// never a message's text. One unread notification per thing is enough: a second message in the
// same conversation does not add another, and a unique index on the unread ones keeps it so when
// two arrive at once. Someone who turned in-app notifications off gets none.
import type { Db } from "@/infrastructure/db";

export type ServerKind = "message" | "connection";

type About =
  | { status: string; outgoing: boolean; handle: string; displayName: string }
  | { kind: "direct" | "group"; title: string | null; from: { displayName: string } | null };

export type StoredNotification = {
  id: string;
  kind: ServerKind;
  createdAt: Date;
  read: boolean;
  about: About | null;
};

export const LIST_MAX = 50;

export async function notifyUser(
  db: Db,
  userId: string,
  kind: ServerKind,
  ref: string,
  now: Date,
): Promise<void> {
  await db`insert into notification (id, user_id, kind, ref, created_at)
    select gen_random_uuid(), ${userId}, ${kind}, ${ref}, ${now}
    where coalesce((select in_app from notification_preference where user_id = ${userId}), true)
    on conflict (user_id, kind, ref) where read_at is null do nothing`;
}

/** Marks what one person was told about a thing as read, as reading the conversation does. */
export async function markReadAbout(
  db: Db,
  userId: string,
  kind: ServerKind,
  ref: string,
  now: Date,
): Promise<void> {
  await db`update notification set read_at = ${now}
    where user_id = ${userId} and kind = ${kind} and ref = ${ref} and read_at is null`;
}

/** Forgets every notification about a thing, for everyone, as when a request is withdrawn. */
export async function forgetAbout(db: Db, kind: ServerKind, ref: string): Promise<void> {
  await db`delete from notification where kind = ${kind} and ref = ${ref}`;
}

/** Marks the given notifications of yours read, or all of them when `ids` is "all". */
export async function markRead(
  db: Db,
  userId: string,
  ids: readonly string[] | "all",
  now: Date,
): Promise<void> {
  const which = ids === "all" ? db`` : db`and id in ${db(ids)}`;
  await db`update notification set read_at = ${now}
    where user_id = ${userId} and read_at is null ${which}`;
}

/** Your newest notifications, with what each is about as it stands now. */
export async function notificationsOf(db: Db, me: string): Promise<StoredNotification[]> {
  return db<StoredNotification[]>`
    select n.id, n.kind::text as kind, n.created_at as "createdAt", n.read_at is not null as read,
      case n.kind
        when 'connection' then (
          select json_build_object('status', r.status, 'outgoing', r.from_id = ${me},
                                   'handle', u.handle, 'displayName', u.display_name)
          from connection_request r
          join app_user u on u.id = case when r.from_id = ${me} then r.to_id else r.from_id end
          where r.id = n.ref and (r.from_id = ${me} or r.to_id = ${me}))
        when 'message' then (
          select json_build_object('kind', c.kind, 'title', c.title, 'from', (
            select json_build_object('displayName', a.display_name)
            from message x join app_user a on a.id = x.author_id
            where x.conversation_id = c.id and x.deleted_at is null and x.author_id <> ${me}
            order by x.created_at desc, x.id desc limit 1))
          from conversation c
          join member mine on mine.conversation_id = c.id and mine.user_id = ${me}
          where c.id = n.ref)
      end as about
    from notification n
    where n.user_id = ${me}
    order by n.created_at desc, n.id desc
    limit ${LIST_MAX}`;
}

export async function inAppOn(db: Db, userId: string): Promise<boolean> {
  const [row] = await db<{ inApp: boolean }[]>`
    select in_app as "inApp" from notification_preference where user_id = ${userId}`;
  return row?.inApp ?? true;
}

export async function setInApp(db: Db, userId: string, on: boolean, now: Date): Promise<void> {
  await db`insert into notification_preference (user_id, in_app, updated_at)
    values (${userId}, ${on}, ${now})
    on conflict (user_id) do update set in_app = excluded.in_app, updated_at = excluded.updated_at`;
}
