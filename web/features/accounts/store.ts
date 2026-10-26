// The SQL behind accounts. Each function takes the connection, so tests run it against a
// throwaway database and the routes pass the app's pool.
import type { Db, Sql } from "@/infrastructure/db";
import type { ProfileInput } from "./input";

export type UserRole = "member" | "admin";
export type User = { id: string; handle: string; displayName: string; role: UserRole };
export type Profile = ProfileInput & { updatedAt: Date };
type NewUser = { inviteHash: string; handle: string; displayName: string; passwordHash: string };
type JsonValue = Parameters<Db["json"]>[0];

const UNIQUE_VIOLATION = "23505";

export async function insertInvites(
  db: Db,
  codeHashes: string[],
  expiresAt: Date,
  createdBy: string | null,
): Promise<void> {
  for (const codeHash of codeHashes) {
    await db`insert into invite (code_hash, created_by, expires_at)
             values (${codeHash}, ${createdBy}, ${expiresAt})`;
  }
}

/** The new user, or why not. The invite is checked first, so only an invite holder learns
 *  whether a handle is taken. */
export async function createUser(
  sql: Sql,
  user: NewUser,
  now: Date,
): Promise<User | "invite_invalid" | "handle_taken"> {
  try {
    return await sql.begin(async (tx) => {
      const [invite] = await tx`select code_hash from invite
        where code_hash = ${user.inviteHash} and used_by is null and expires_at > ${now}
        for update`;
      if (invite === undefined) return "invite_invalid" as const;
      const [created] = await tx<User[]>`insert into app_user (id, handle, display_name)
        values (gen_random_uuid(), ${user.handle}, ${user.displayName})
        returning id, handle, display_name as "displayName", role::text as role`;
      if (created === undefined) throw new Error("insert returned no row");
      await tx`update invite set used_by = ${created.id}, used_at = ${now}
               where code_hash = ${user.inviteHash}`;
      await tx`insert into credential (user_id, hash) values (${created.id}, ${user.passwordHash})`;
      return created;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return "handle_taken";
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === UNIQUE_VIOLATION
  );
}

export async function credentialFor(
  db: Db,
  handle: string,
): Promise<{ user: User; hash: string } | null> {
  const [row] = await db<(User & { hash: string })[]>`
    select u.id, u.handle, u.display_name as "displayName", u.role::text as role, c.hash
    from app_user u join credential c on c.user_id = u.id
    where u.handle = ${handle}`;
  if (row === undefined) return null;
  const { hash, ...user } = row;
  return { user, hash };
}

export async function insertSession(
  db: Db,
  idHash: string,
  userId: string,
  expiresAt: Date,
): Promise<void> {
  await db`insert into session (id_hash, user_id, expires_at) values (${idHash}, ${userId}, ${expiresAt})`;
}

export async function deleteSession(db: Db, idHash: string): Promise<void> {
  await db`delete from session where id_hash = ${idHash}`;
}

export async function deleteExpiredSessions(db: Db, now: Date): Promise<void> {
  await db`delete from session where expires_at <= ${now}`;
}

export async function sessionUser(db: Db, idHash: string, now: Date): Promise<User | null> {
  const [user] = await db<User[]>`
    select u.id, u.handle, u.display_name as "displayName", u.role::text as role
    from session s join app_user u on u.id = s.user_id
    where s.id_hash = ${idHash} and s.expires_at > ${now}`;
  return user ?? null;
}

/** A user created by the operator, without an invite (the team and demo accounts); "handle_taken"
 *  when the handle exists, so seeding twice changes nothing. */
export async function insertSeededUser(
  sql: Sql,
  user: { handle: string; displayName: string; passwordHash: string; role: UserRole },
): Promise<User | "handle_taken"> {
  return sql.begin(async (tx) => {
    const [created] = await tx<User[]>`insert into app_user (id, handle, display_name, role)
      values (gen_random_uuid(), ${user.handle}, ${user.displayName}, ${user.role}::"UserRole")
      on conflict (handle) do nothing
      returning id, handle, display_name as "displayName", role::text as role`;
    if (created === undefined) return "handle_taken" as const;
    await tx`insert into credential (user_id, hash) values (${created.id}, ${user.passwordHash})`;
    return created;
  });
}

/** Sets the role of an existing account; false when no account has the handle. Only the
 *  operator's seeding script calls this: the app itself grants no role. */
export async function setRole(db: Db, handle: string, role: UserRole): Promise<boolean> {
  const updated = await db`update app_user set role = ${role}::"UserRole" where handle = ${handle}`;
  return updated.count === 1;
}

/** Everything of the user goes with the row: credential, sessions, profile, the invites they
 *  made, their memberships and messages (foreign keys cascade); an invite they redeemed keeps no
 *  link to them, and a conversation nobody is left in goes too. */
export async function deleteUser(db: Db, userId: string): Promise<void> {
  await db`delete from app_user where id = ${userId}`;
  await db`delete from conversation c
           where not exists (select 1 from member m where m.conversation_id = c.id)`;
}

export async function saveProfile(
  db: Db,
  userId: string,
  profile: ProfileInput,
  now: Date,
): Promise<void> {
  const avatar = profile.avatar === null ? null : db.json(profile.avatar as JsonValue);
  await db`insert into user_profile (user_id, role, goal, expertise, visibility, avatar, updated_at)
    values (${userId}, ${profile.role}, ${profile.goal}, ${profile.expertise}, ${profile.visibility},
            ${avatar}, ${now})
    on conflict (user_id) do update set role = excluded.role, goal = excluded.goal,
      expertise = excluded.expertise, visibility = excluded.visibility, avatar = excluded.avatar,
      updated_at = excluded.updated_at`;
}

export async function profileOf(db: Db, userId: string): Promise<Profile | null> {
  const [profile] = await db<Profile[]>`
    select role, goal, expertise, visibility::text as visibility, avatar, updated_at as "updatedAt"
    from user_profile where user_id = ${userId}`;
  return profile ?? null;
}
