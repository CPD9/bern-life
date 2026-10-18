// The SQL behind labs. Membership is part of every query that reads or changes a lab, and the
// lead's rights are part of the query that uses them, so no check made beforehand can go stale.
// A listing only ever writes `lab_listing`; it never touches `app_user`.
import { INVITE_DAYS, inviteHash, newInviteCode } from "@/features/accounts/accounts";
import type { Db, Sql } from "@/infrastructure/db";
import type { LabDetail, LabInput, LabSummary } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

function isLead(db: Db, me: string, labId: string) {
  return db`exists (select 1 from lab where id = ${labId} and lead_id = ${me})`;
}

function isMember(db: Db, me: string, labId: string) {
  return db`exists (select 1 from lab_member where lab_id = ${labId} and user_id = ${me})`;
}

/** Your new lab with you as its lead, or "lab_exists": one lab per lead for now. */
export async function createLab(
  sql: Sql,
  me: string,
  lab: LabInput,
  now: Date,
): Promise<LabSummary | "lab_exists"> {
  return sql.begin(async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      insert into lab (id, name, unit, description, lead_id, created_at)
      values (gen_random_uuid(), ${lab.name}, ${lab.unit}, ${lab.description}, ${me}, ${now})
      on conflict (lead_id) do nothing
      returning id`;
    if (row === undefined) return "lab_exists" as const;
    await tx`insert into lab_member (lab_id, user_id, role, accepted_at)
             values (${row.id}, ${me}, 'lead', ${now})`;
    return { id: row.id, ...lab, role: "lead" as const };
  });
}

export async function labsOf(db: Db, me: string): Promise<LabSummary[]> {
  return db<LabSummary[]>`
    select l.id, l.name, l.unit, l.description, m.role::text as role
    from lab l join lab_member m on m.lab_id = l.id and m.user_id = ${me}
    order by l.name, l.id`;
}

/** The lab with its members and listings, or null when you are not a member. */
export async function labFor(db: Db, me: string, labId: string): Promise<LabDetail | null> {
  const [lab] = await db<LabDetail[]>`
    select l.id, l.name, l.unit, l.description,
      (select json_agg(json_build_object('handle', u.handle, 'displayName', u.display_name,
                                         'role', m.role, 'acceptedAt',
                                         to_char(m.accepted_at at time zone 'UTC',
                                                 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
                       order by m.role, u.handle)
         from lab_member m join app_user u on u.id = m.user_id
         where m.lab_id = l.id) as members,
      (select coalesce(json_agg(json_build_object('profileId', x.profile_id, 'name', p.name,
                                'kind', p.kind, 'sourceUrl', p.source_url,
                                'addedBy', json_build_object('handle', a.handle,
                                                             'displayName', a.display_name))
                       order by x.created_at, x.profile_id), '[]'::json)
         from lab_listing x join app_user a on a.id = x.added_by
         left join profile p on p.id = x.profile_id
         where x.lab_id = l.id) as listings
    from lab l
    where l.id = ${labId} and ${isMember(db, me, labId)}`;
  return lab ?? null;
}

/** A one-time invite code (only its hash is kept), or "not_lead" when you do not lead the lab. */
export async function createLabInvite(
  db: Db,
  me: string,
  labId: string,
  now: Date,
): Promise<{ code: string; expiresAt: Date } | "not_lead"> {
  const code = newInviteCode();
  const expiresAt = new Date(now.getTime() + INVITE_DAYS * DAY_MS);
  const made = await db`
    insert into lab_invite (code_hash, lab_id, expires_at, created_at)
    select ${inviteHash(code)}, ${labId}, ${expiresAt}, ${now}
    where ${isLead(db, me, labId)}
    returning lab_id`;
  return made.count === 0 ? "not_lead" : { code, expiresAt };
}

/** The lab you joined, or "invite_invalid" for an unknown, used or expired code. */
export async function acceptLabInvite(
  sql: Sql,
  me: string,
  code: string,
  now: Date,
): Promise<string | "invite_invalid"> {
  return sql.begin(async (tx) => {
    const [invite] = await tx<{ labId: string }[]>`
      update lab_invite set used_at = ${now}
      where code_hash = ${inviteHash(code)} and used_at is null and expires_at > ${now}
      returning lab_id as "labId"`;
    if (invite === undefined) return "invite_invalid" as const;
    await tx`insert into lab_member (lab_id, user_id, role, accepted_at)
             values (${invite.labId}, ${me}, 'member', ${now}) on conflict do nothing`;
    return invite.labId;
  });
}

/** Leaves a lab you are a member of; the lead cannot leave their own lab. */
export async function leaveLab(
  db: Db,
  me: string,
  labId: string,
): Promise<"left" | "lead" | "not_member"> {
  const [row] = await db<{ role: string }[]>`
    select role::text as role from lab_member where lab_id = ${labId} and user_id = ${me}`;
  if (row === undefined) return "not_member";
  if (row.role === "lead") return "lead";
  await db`delete from lab_member where lab_id = ${labId} and user_id = ${me} and role = 'member'`;
  return "left";
}

/** Removes a member by handle; only the lead can, and never themselves. */
export async function removeMember(
  db: Db,
  me: string,
  labId: string,
  handle: string,
): Promise<"removed" | "not_lead" | "not_found"> {
  const removed = await db`
    delete from lab_member m using app_user u
    where m.user_id = u.id and u.handle = ${handle} and m.lab_id = ${labId} and m.role = 'member'
      and ${isLead(db, me, labId)}
    returning m.user_id`;
  if (removed.count > 0) return "removed";
  const [lead] = await db`select 1 where ${isLead(db, me, labId)}`;
  return lead === undefined ? "not_lead" : "not_found";
}

/** Links a public profile to a lab you are in; the profile must exist in the engine's tables. */
export async function linkProfile(
  db: Db,
  me: string,
  labId: string,
  profileId: string,
  now: Date,
): Promise<"linked" | "not_member" | "unknown_profile"> {
  const [checks] = await db<{ member: boolean; known: boolean }[]>`
    select ${isMember(db, me, labId)} as member,
           exists (select 1 from profile where id = ${profileId}) as known`;
  if (!checks?.member) return "not_member";
  if (!checks.known) return "unknown_profile";
  await db`insert into lab_listing (lab_id, profile_id, added_by, created_at)
           values (${labId}, ${profileId}, ${me}, ${now}) on conflict do nothing`;
  return "linked";
}

/** Unlinks a listing; whoever added it or the lead can. */
export async function unlinkProfile(
  db: Db,
  me: string,
  labId: string,
  profileId: string,
): Promise<boolean> {
  const removed = await db`
    delete from lab_listing
    where lab_id = ${labId} and profile_id = ${profileId}
      and (added_by = ${me} or ${isLead(db, me, labId)})
    returning profile_id`;
  return removed.count > 0;
}
