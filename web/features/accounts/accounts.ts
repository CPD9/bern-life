// What a person can do with an account: join with an invite, sign in and out, save the onboarding
// profile, delete everything. Errors are markers; no password, hash or token leaves this module
// except the new session token handed to the cookie.
import { randomBytes } from "node:crypto";
import type { Db, Sql } from "@/infrastructure/db";
import { newToken, sessionExpiry, tokenHash } from "@/infrastructure/session";
import type { ProfileInput, SignIn, SignUp } from "./input";
import { decoyHash, hashPassword, verifyPassword } from "./passwords";
import { LIMITS, attempts, clearAttempts, recordAttempt } from "./rate-limit";
import * as store from "./store";

export type AccountError =
  | "bad_request"
  | "invalid_credentials"
  | "invite_invalid"
  | "handle_taken"
  | "rate_limited"
  | "unauthenticated";
export type Outcome<T> = { ok: true; value: T } | { ok: false; error: AccountError };
export type SignedIn = { user: store.User; token: string };

export const INVITE_DAYS = 7;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });
const fail = <T>(error: AccountError): Outcome<T> => ({ ok: false, error });

/** 128 random bits as 26 base32 characters in groups of four, easy to read out and type. */
export function newInviteCode(): string {
  let bits = "";
  for (const byte of randomBytes(16)) bits += byte.toString(2).padStart(8, "0");
  const chars = (bits.padEnd(130, "0").match(/.{5}/g) ?? []).map((b) => BASE32[parseInt(b, 2)]);
  return (chars.join("").match(/.{1,4}/g) ?? []).join("-");
}

export function inviteHash(code: string): string {
  return tokenHash(code.replace(/[\s-]/g, "").toUpperCase());
}

export async function createInvites(
  db: Db,
  count: number,
  now: Date,
  createdBy: string | null,
): Promise<string[]> {
  const codes = Array.from({ length: count }, newInviteCode);
  const expires = new Date(now.getTime() + INVITE_DAYS * 24 * 60 * 60 * 1000);
  await store.insertInvites(db, codes.map(inviteHash), expires, createdBy);
  return codes;
}

async function startSession(
  db: Db,
  userId: string,
  now: Date,
  previous: string | null,
): Promise<string> {
  if (previous !== null) await store.deleteSession(db, tokenHash(previous));
  await store.deleteExpiredSessions(db, now);
  const token = newToken();
  await store.insertSession(db, tokenHash(token), userId, sessionExpiry(now));
  return token;
}

export async function signUp(
  sql: Sql,
  input: SignUp,
  ip: string,
  now: Date,
): Promise<Outcome<SignedIn>> {
  const ipKey = `sign-up:ip:${ip}`;
  if ((await attempts(sql, ipKey, now)) >= LIMITS.signUpPerIp) return fail("rate_limited");
  await recordAttempt(sql, ipKey, now);
  const passwordHash = await hashPassword(input.password);
  const created = await store.createUser(
    sql,
    { ...input, inviteHash: inviteHash(input.invite), passwordHash },
    now,
  );
  if (typeof created === "string") return fail(created);
  return ok({ user: created, token: await startSession(sql, created.id, now, null) });
}

export async function signIn(
  db: Db,
  input: SignIn,
  ip: string,
  now: Date,
  previous: string | null,
): Promise<Outcome<SignedIn>> {
  const handleKey = `sign-in:handle:${input.handle}`;
  const ipKey = `sign-in:ip:${ip}`;
  const blocked =
    (await attempts(db, handleKey, now)) >= LIMITS.signInPerHandle ||
    (await attempts(db, ipKey, now)) >= LIMITS.signInPerIp;
  if (blocked) return fail("rate_limited");
  const credential = await store.credentialFor(db, input.handle);
  const valid = await verifyPassword(credential?.hash ?? (await decoyHash()), input.password);
  if (credential === null || !valid) {
    await recordAttempt(db, handleKey, now);
    await recordAttempt(db, ipKey, now);
    return fail("invalid_credentials");
  }
  await clearAttempts(db, handleKey);
  return ok({
    user: credential.user,
    token: await startSession(db, credential.user.id, now, previous),
  });
}

export async function signOut(db: Db, token: string): Promise<void> {
  await store.deleteSession(db, tokenHash(token));
}

export async function currentUser(
  db: Db,
  token: string | null,
  now: Date,
): Promise<store.User | null> {
  return token === null ? null : store.sessionUser(db, tokenHash(token), now);
}

export async function deleteAccount(
  db: Db,
  user: store.User,
  password: string,
): Promise<Outcome<null>> {
  const credential = await store.credentialFor(db, user.handle);
  if (credential === null || !(await verifyPassword(credential.hash, password))) {
    return fail("invalid_credentials");
  }
  await store.deleteUser(db, user.id);
  return ok(null);
}

export async function saveProfile(
  db: Db,
  user: store.User,
  profile: ProfileInput,
  now: Date,
): Promise<void> {
  await store.saveProfile(db, user.id, profile, now);
}
