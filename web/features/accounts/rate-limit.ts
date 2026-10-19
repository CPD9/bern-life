// Attempt counters in the database, in fixed 15-minute windows, so limits hold across restarts and
// server processes without another service.
import type { Db, Sql } from "@/infrastructure/db";

export const WINDOW_MS = 15 * 60 * 1000;
export const LIMITS = { signInPerHandle: 5, signInPerIp: 20, signUpPerIp: 10 } as const;

function windowOpenedAfter(now: Date): Date {
  return new Date(now.getTime() - WINDOW_MS);
}

export async function attempts(db: Db, key: string, now: Date): Promise<number> {
  const [row] = await db<{ count: number }[]>`
    select count from rate_limit where key = ${key} and window_start > ${windowOpenedAfter(now)}`;
  return row?.count ?? 0;
}

export async function recordAttempt(db: Db, key: string, now: Date): Promise<void> {
  const stale = windowOpenedAfter(now);
  await db`insert into rate_limit (key, window_start, count) values (${key}, ${now}, 1)
    on conflict (key) do update set
      count = case when rate_limit.window_start <= ${stale} then 1 else rate_limit.count + 1 end,
      window_start = case when rate_limit.window_start <= ${stale} then ${now}
                          else rate_limit.window_start end`;
}

export async function clearAttempts(db: Db, key: string): Promise<void> {
  await db`delete from rate_limit where key = ${key}`;
}

/** Counts this attempt, then says whether it is within `limit` for the window. Counting first gives
 *  requests in flight together each their own place in line, so a burst cannot all read the same
 *  count and all pass; the upsert holds the key's row until the transaction ends. */
export async function admit(sql: Sql, key: string, limit: number, now: Date): Promise<boolean> {
  const count = await sql.begin(async (tx) => {
    await recordAttempt(tx, key, now);
    return attempts(tx, key, now);
  });
  return count <= limit;
}
