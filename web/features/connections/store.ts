// The SQL behind connections. Every query names the caller in its WHERE clause (only the recipient
// answers, only the sender withdraws), so no call can change a request between two other people.
// Functions take a Db, so a route runs a request and its notification in one transaction.
import type { Db } from "@/infrastructure/db";
import type { Ask } from "./input";
import type { ConnectionView, RequestStatus } from "./types";

export type SendOutcome =
  | { ok: true; id: string; to: string }
  | { ok: false; error: "not_found" | "request_exists" | "connected" };

type Row = {
  id: string;
  status: RequestStatus;
  outgoing: boolean;
  note: string | null;
  createdAt: Date;
  respondedAt: Date | null;
  handle: string;
  displayName: string;
  unread: boolean;
};

function view(row: Row): ConnectionView {
  return {
    id: row.id,
    person: { handle: row.handle, displayName: row.displayName },
    status: row.status,
    direction: row.outgoing ? "outgoing" : "incoming",
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    respondedAt: row.respondedAt === null ? null : row.respondedAt.toISOString(),
    unread: row.unread,
  };
}

/**
 * Asks the member with `ask.handle` to connect. Only a member whose profile is visible to members
 * can be asked; anyone else looks unknown. A pair holds one request: it starts again only after a
 * withdrawal, or when the one who declined now asks.
 */
export async function sendRequest(db: Db, me: string, ask: Ask, now: Date): Promise<SendOutcome> {
  const [other] = await db<{ id: string }[]>`
    select u.id from app_user u join user_profile p on p.user_id = u.id
    where u.handle = ${ask.handle} and u.id <> ${me} and p.visibility in ('members', 'public')`;
  if (other === undefined) return { ok: false, error: "not_found" };
  const [sent] = await db<{ id: string }[]>`
    insert into connection_request (id, from_id, to_id, pair_key, note, created_at)
    values (gen_random_uuid(), ${me}, ${other.id},
            least(${me}::uuid, ${other.id}::uuid)::text || ':' || greatest(${me}::uuid, ${other.id}::uuid)::text,
            ${ask.note}, ${now})
    on conflict (pair_key) do update set from_id = excluded.from_id, to_id = excluded.to_id,
      note = excluded.note, status = 'pending', created_at = excluded.created_at, responded_at = null
    where connection_request.status = 'withdrawn'
       or (connection_request.status = 'declined' and connection_request.to_id = excluded.from_id)
    returning id`;
  if (sent !== undefined) return { ok: true, id: sent.id, to: other.id };
  const [held] = await db<{ status: RequestStatus }[]>`
    select status::text as status from connection_request
    where pair_key = least(${me}::uuid, ${other.id}::uuid)::text || ':' || greatest(${me}::uuid, ${other.id}::uuid)::text`;
  return { ok: false, error: held?.status === "accepted" ? "connected" : "request_exists" };
}

/** The recipient accepts or declines a waiting request; the sender's id, or null when it is not
 *  theirs to answer or no longer waits. */
export async function answerRequest(
  db: Db,
  me: string,
  id: string,
  answer: "accept" | "decline",
  now: Date,
): Promise<string | null> {
  const status = answer === "accept" ? "accepted" : "declined";
  const [row] = await db<{ fromId: string }[]>`
    update connection_request set status = ${status}, responded_at = ${now}
    where id = ${id} and to_id = ${me} and status = 'pending'
    returning from_id as "fromId"`;
  return row?.fromId ?? null;
}

/** The sender takes back a waiting request; the recipient's id, or null when it is not theirs. */
export async function withdrawRequest(
  db: Db,
  me: string,
  id: string,
  now: Date,
): Promise<string | null> {
  const [row] = await db<{ toId: string }[]>`
    update connection_request set status = 'withdrawn', responded_at = ${now}
    where id = ${id} and from_id = ${me} and status = 'pending'
    returning to_id as "toId"`;
  return row?.toId ?? null;
}

/** Every request you sent or received, newest first; withdrawn ones are gone for both sides.
 *  Each says whether a notification of yours about it is still unread. */
export async function requestsOf(db: Db, me: string): Promise<ConnectionView[]> {
  const rows = await db<Row[]>`
    select r.id, r.status::text as status, r.from_id = ${me} as outgoing, r.note,
           r.created_at as "createdAt", r.responded_at as "respondedAt",
           u.handle, u.display_name as "displayName",
           exists (select 1 from notification n
                   where n.user_id = ${me} and n.kind = 'connection' and n.ref = r.id
                     and n.read_at is null) as unread
    from connection_request r
    join app_user u on u.id = case when r.from_id = ${me} then r.to_id else r.from_id end
    where (r.from_id = ${me} or r.to_id = ${me}) and r.status <> 'withdrawn'
    order by r.created_at desc, r.id`;
  return rows.map(view);
}
