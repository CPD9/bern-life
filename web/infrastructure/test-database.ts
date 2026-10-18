// The throwaway database the database tests run against. Tests empty the account and message
// tables, so a database whose name is not a throwaway one is refused, the same rule as
// make db-reset-throwaway.
import postgres from "postgres";
import type { Sql } from "./db";
import { testDatabaseUrl } from "./env";

const THROWAWAY = /^bernlife_(l[123]|ci)$/;

function throwawayUrl(): string | null {
  const url = testDatabaseUrl();
  if (url === null || !URL.canParse(url)) return null;
  return THROWAWAY.test(new URL(url).pathname.slice(1)) ? url : null;
}

/** A pool of its own for each test file, which closes it when done; null when no throwaway
 *  database is configured. */
export function openTestDb(): Sql | null {
  const url = throwawayUrl();
  return url === null ? null : postgres(url, { max: 4, onnotice: () => {} });
}

export const SKIPPED =
  "database tests need DATABASE_URL pointing at a migrated throwaway database (bernlife_l1..l3 or bernlife_ci)";

export async function emptyTables(sql: Sql): Promise<void> {
  await sql`truncate app_user, invite, rate_limit, conversation cascade`;
}
